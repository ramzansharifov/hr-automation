import { app, dialog, shell } from "electron";
import { createHash, randomUUID } from "node:crypto";
import {
  copyFileSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
} from "node:fs";
import path from "node:path";
import type Database from "better-sqlite3";
import type { AuthSession } from "../../src/shared/types/access";
import type { DocumentTypeRecord } from "../../src/shared/types/documentTypes";
import type {
  AddEmployeeDocumentParams,
  EmployeeDocumentSummary,
  HrRecord,
} from "../../src/shared/types/hr";

interface EmployeeContextRow extends HrRecord {
  id: number;
  enterprise_id: number | null;
  department_id: number | null;
}

export class EmployeeDocumentService {
  constructor(private readonly database: Database.Database) {}

  list(employeeId: number, session: AuthSession): EmployeeDocumentSummary[] {
    const employee = this.getEmployee(employeeId);
    this.assertEmployeeInScope(employee, session);
    const rows = this.database
      .prepare(
        `SELECT document.*,
                TRIM(employee.last_name || ' ' || employee.first_name || ' ' || COALESCE(employee.middle_name, '')) AS employee_name,
                COALESCE(type.name, document.document_type) AS resolved_document_type
         FROM employee_documents AS document
         JOIN employees AS employee ON employee.id = document.employee_id
         LEFT JOIN document_types AS type ON type.id = document.document_type_id
         WHERE document.status = 'active'
           AND document.employee_id = ?
         ORDER BY COALESCE(document.expires_at, '9999-12-31'), document.created_at DESC`,
      )
      .all(employeeId) as Array<Record<string, unknown>>;
    return rows.map(toDocumentSummary);
  }

  listTypesForEmployee(employeeId: number, session: AuthSession): DocumentTypeRecord[] {
    const employee = this.getEmployee(employeeId);
    this.assertEmployeeInScope(employee, session);
    const enterpriseId = positiveNumber(employee.enterprise_id);
    if (!enterpriseId) return [];
    const rows = this.database
      .prepare(
        `SELECT type.*, enterprise.name AS enterprise_name
         FROM document_types AS type
         JOIN enterprises AS enterprise ON enterprise.id = type.enterprise_id
         WHERE type.enterprise_id = ? AND type.is_active = 1
         ORDER BY type.name COLLATE NOCASE`,
      )
      .all(enterpriseId) as Array<Record<string, unknown>>;
    return rows.map((row) => ({
      id: Number(row.id),
      enterpriseId: Number(row.enterprise_id),
      enterpriseName: String(row.enterprise_name ?? ""),
      name: String(row.name ?? ""),
      isActive: Number(row.is_active) === 1,
      createdAt: String(row.created_at ?? ""),
      updatedAt: String(row.updated_at ?? ""),
    }));
  }

  add(
    params: AddEmployeeDocumentParams,
    session: AuthSession,
  ): EmployeeDocumentSummary | null {
    const employee = this.getEmployee(params.employeeId);
    this.assertEmployeeInScope(employee, session);
    const enterpriseId = positiveNumber(employee.enterprise_id);
    if (!enterpriseId) {
      throw new Error("Сначала назначьте сотруднику предприятие");
    }

    const title = params.title.trim();
    const requestedType = params.documentType.trim();
    if (!requestedType || !title) {
      throw new Error("Укажите тип и название документа");
    }
    const documentType = this.database
      .prepare(
        `SELECT id, name
         FROM document_types
         WHERE enterprise_id = ?
           AND is_active = 1
           AND LOWER(TRIM(name)) = LOWER(TRIM(?))
         LIMIT 1`,
      )
      .get(enterpriseId, requestedType) as { id: number; name: string } | undefined;
    if (!documentType) {
      throw new Error("Выбранный тип документа недоступен для предприятия сотрудника");
    }

    if (params.issuedAt) assertDate(params.issuedAt, "Некорректная дата выдачи документа");
    if (params.expiresAt) assertDate(params.expiresAt, "Некорректный срок действия документа");
    if (params.issuedAt && params.expiresAt && params.expiresAt < params.issuedAt) {
      throw new Error("Срок действия документа не может быть раньше даты выдачи");
    }

    if (params.employmentHistoryId) {
      const event = this.database
        .prepare("SELECT employee_id FROM employment_history WHERE id = ? LIMIT 1")
        .get(params.employmentHistoryId) as { employee_id: number } | undefined;
      if (!event || event.employee_id !== params.employeeId) {
        throw new Error("Кадровое событие не принадлежит выбранному сотруднику");
      }
    }

    const selected = dialog.showOpenDialogSync({
      title: "Выберите документ сотрудника",
      properties: ["openFile"],
      filters: [
        {
          name: "Документы",
          extensions: ["pdf", "doc", "docx", "xls", "xlsx", "png", "jpg", "jpeg", "txt"],
        },
        { name: "Все файлы", extensions: ["*"] },
      ],
    });
    const sourcePath = selected?.[0];
    if (!sourcePath) return null;

    const stat = statSync(sourcePath);
    if (!stat.isFile()) throw new Error("Выбранный путь не является файлом");
    if (stat.size > 100 * 1024 * 1024) {
      throw new Error("Размер документа не должен превышать 100 МБ");
    }

    const root = this.documentStorageRoot();
    const employeeDirectory = path.join(root, String(params.employeeId));
    mkdirSync(employeeDirectory, { recursive: true });
    const extension = path.extname(sourcePath).toLowerCase();
    const storedName = `${Date.now()}-${randomUUID()}${extension}`;
    const destination = path.join(employeeDirectory, storedName);
    copyFileSync(sourcePath, destination);
    const hash = sha256File(destination);
    const relativePath = path.relative(root, destination).replace(/\\/g, "/");

    try {
      const result = this.database
        .prepare(
          `INSERT INTO employee_documents (
             employee_id, employment_history_id,
             document_type_id, document_type, title,
             original_name, stored_name, relative_path, mime_type,
             size_bytes, sha256, issued_at, expires_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          params.employeeId,
          params.employmentHistoryId ?? null,
          documentType.id,
          documentType.name,
          title,
          path.basename(sourcePath),
          storedName,
          relativePath,
          mimeTypeForExtension(extension),
          stat.size,
          hash,
          params.issuedAt ?? null,
          params.expiresAt ?? null,
        );
      return this.getDocument(Number(result.lastInsertRowid), session);
    } catch (error) {
      rmSync(destination, { force: true });
      throw error;
    }
  }

  open(id: number, session: AuthSession): { success: true } {
    const document = this.getDocumentRow(id, session);
    if (String(document.status) !== "active") throw new Error("Документ удалён");
    const absolutePath = this.resolveDocumentPath(String(document.relative_path));
    const actualHash = sha256File(absolutePath);
    if (actualHash !== String(document.sha256)) {
      throw new Error("Проверка целостности документа не пройдена");
    }
    void shell.openPath(absolutePath);
    return { success: true };
  }

  delete(id: number, reason: string, session: AuthSession): { success: true } {
    if (!reason.trim()) throw new Error("Укажите основание удаления документа");
    const document = this.getDocumentRow(id, session);
    if (String(document.status) !== "active") return { success: true };
    const absolutePath = this.resolveDocumentPath(String(document.relative_path));
    rmSync(absolutePath, { force: true });
    this.database
      .prepare(
        `UPDATE employee_documents
         SET status = 'deleted', deleted_at = CURRENT_TIMESTAMP,
             delete_reason = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
      )
      .run(reason.trim(), id);
    return { success: true };
  }

  private getDocument(id: number, session: AuthSession): EmployeeDocumentSummary {
    return toDocumentSummary(this.getDocumentRow(id, session));
  }

  private getDocumentRow(id: number, session: AuthSession): Record<string, unknown> {
    const row = this.database
      .prepare(
        `SELECT document.*,
                employee.enterprise_id,
                employee.department_id,
                TRIM(employee.last_name || ' ' || employee.first_name || ' ' || COALESCE(employee.middle_name, '')) AS employee_name,
                COALESCE(type.name, document.document_type) AS resolved_document_type
         FROM employee_documents AS document
         JOIN employees AS employee ON employee.id = document.employee_id
         LEFT JOIN document_types AS type ON type.id = document.document_type_id
         WHERE document.id = ?
         LIMIT 1`,
      )
      .get(id) as Record<string, unknown> | undefined;
    if (!row) throw new Error("Документ не найден");
    this.assertEmployeeInScope(
      {
        id: Number(row.employee_id),
        enterprise_id: positiveNumber(row.enterprise_id),
        department_id: positiveNumber(row.department_id),
      },
      session,
    );
    return row;
  }

  private getEmployee(employeeId: number): EmployeeContextRow {
    const employee = this.database
      .prepare("SELECT * FROM employees WHERE id = ? LIMIT 1")
      .get(employeeId) as EmployeeContextRow | undefined;
    if (!employee) throw new Error("Сотрудник не найден");
    return employee;
  }

  private assertEmployeeInScope(employee: HrRecord, session: AuthSession): void {
    const id = Number(employee.id);
    if (session.scopeType === "global") return;
    if (session.scopeType === "enterprise" && Number(employee.enterprise_id) === session.enterpriseId) return;
    if (session.scopeType === "department" && Number(employee.department_id) === session.departmentId) return;
    if (session.scopeType === "self" && id === session.employeeId) return;
    throw new Error("Сотрудник находится вне доступной области данных");
  }

  private documentStorageRoot(): string {
    const root = path.join(app.getPath("userData"), "employee-documents");
    mkdirSync(root, { recursive: true });
    return root;
  }

  private resolveDocumentPath(relativePath: string): string {
    const root = path.resolve(this.documentStorageRoot());
    const target = path.resolve(root, relativePath);
    if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
      throw new Error("Некорректный путь документа");
    }
    return target;
  }
}

function toDocumentSummary(row: Record<string, unknown>): EmployeeDocumentSummary {
  return {
    id: Number(row.id),
    employeeId: Number(row.employee_id),
    employmentHistoryId: positiveNumber(row.employment_history_id),
    employeeName: String(row.employee_name ?? "").trim(),
    enterpriseIdSnapshot: positiveNumber(row.enterprise_id_snapshot),
    enterpriseNameSnapshot: row.enterprise_name_snapshot
      ? String(row.enterprise_name_snapshot)
      : null,
    documentType: String(row.resolved_document_type ?? row.document_type ?? ""),
    title: String(row.title ?? ""),
    originalName: String(row.original_name ?? ""),
    mimeType: row.mime_type ? String(row.mime_type) : null,
    sizeBytes: Number(row.size_bytes ?? 0),
    sha256: String(row.sha256 ?? ""),
    issuedAt: nullableDate(row.issued_at),
    expiresAt: nullableDate(row.expires_at),
    status: String(row.status) === "deleted" ? "deleted" : "active",
    createdAt: String(row.created_at ?? ""),
  };
}

function sha256File(filePath: string): string {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function mimeTypeForExtension(extension: string): string | null {
  const types: Record<string, string> = {
    ".pdf": "application/pdf",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xls": "application/vnd.ms-excel",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".txt": "text/plain",
  };
  return types[extension] ?? null;
}

function positiveNumber(value: unknown): number | null {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function nullableDate(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : null;
}

function assertDate(value: string, message: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(message);
}
