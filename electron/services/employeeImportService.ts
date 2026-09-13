import { dialog } from "electron";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import type Database from "better-sqlite3";

import type { AuthSession } from "../../src/shared/types/access";
import type {
  ApplyEmployeeImportParams,
  EmployeeImportColumnMap,
  EmployeeImportError,
  EmployeeImportPreview,
  EmployeeImportResult,
  EmployeeImportSelection,
  EmployeeImportWarning,
  PreviewEmployeeImportParams,
} from "../../src/shared/types/hr";
import { HrCrudRepository } from "../repositories/hrCrudRepository";
import { EmployeeEmploymentService } from "./employeeEmploymentService";
import { parseCsv, parseXlsx, type ParsedTable } from "./tabularFileService";

interface ImportCacheEntry extends ParsedTable {
  fileName: string;
}

interface ImportResolvedRow {
  rowNumber: number;
  lastName: string;
  firstName: string;
  middleName: string | null;
  birthDate: string | null;
  email: string | null;
  phone: string | null;
  employeeNumber: string | null;
  contractNumber: string | null;
  enterpriseId: number;
  departmentId: number | null;
  positionId: number | null;
  hireDate: string | null;
  salary: number;
}

interface ImportEvaluation {
  totalRows: number;
  duplicateRows: number;
  errors: EmployeeImportError[];
  warnings: EmployeeImportWarning[];
  validRows: ImportResolvedRow[];
}

export class EmployeeImportService {
  private readonly importCache = new Map<string, ImportCacheEntry>();
  private readonly employmentService: EmployeeEmploymentService;

  constructor(private readonly database: Database.Database) {
    this.employmentService = new EmployeeEmploymentService(
      new HrCrudRepository(database),
    );
  }

  selectFile(): EmployeeImportSelection | null {
    const selected = dialog.showOpenDialogSync({
      title: "Выберите файл сотрудников",
      properties: ["openFile"],
      filters: [
        { name: "Таблицы", extensions: ["csv", "xlsx"] },
        { name: "CSV", extensions: ["csv"] },
        { name: "Excel", extensions: ["xlsx"] },
      ],
    });
    const filePath = selected?.[0];
    if (!filePath) return null;

    const extension = path.extname(filePath).toLowerCase();
    const parsed =
      extension === ".xlsx"
        ? parseXlsx(readFileSync(filePath))
        : parseCsv(readFileSync(filePath, "utf8"));
    if (parsed.headers.length === 0) {
      throw new Error("В файле не найдены заголовки колонок");
    }

    const previewId = randomUUID();
    this.importCache.set(previewId, {
      ...parsed,
      fileName: path.basename(filePath),
    });
    this.trimCache();

    return {
      previewId,
      fileName: path.basename(filePath),
      headers: parsed.headers,
      sampleRows: parsed.rows.slice(0, 20),
      totalRows: parsed.rows.length,
    };
  }

  preview(
    params: PreviewEmployeeImportParams,
    session: AuthSession,
  ): EmployeeImportPreview {
    const evaluation = this.evaluate(params.previewId, params.columnMap, session);
    return {
      previewId: params.previewId,
      totalRows: evaluation.totalRows,
      validRows: evaluation.validRows.length,
      duplicateRows: evaluation.duplicateRows,
      warningRows: new Set(evaluation.warnings.map((warning) => warning.row)).size,
      errors: evaluation.errors.slice(0, 200),
      warnings: evaluation.warnings.slice(0, 200),
    };
  }

  apply(
    params: ApplyEmployeeImportParams,
    session: AuthSession,
  ): EmployeeImportResult {
    const evaluation = this.evaluate(params.previewId, params.columnMap, session);
    if (params.dryRun) {
      return {
        totalRows: evaluation.totalRows,
        importedRows: 0,
        skippedRows: evaluation.totalRows - evaluation.validRows.length,
        errors: evaluation.errors.slice(0, 200),
        warnings: evaluation.warnings.slice(0, 200),
      };
    }

    let importedRows = 0;
    const errors = [...evaluation.errors];
    const warnings = [...evaluation.warnings];
    const insertPending = this.database.prepare(
      `INSERT INTO employees (
         enterprise_id, department_id, position_id, employee_number,
         last_name, first_name, middle_name, birth_date, email, phone,
         contract_number, hire_date, employment_started_at,
         status, lifecycle_status, salary, registered_at
       ) VALUES (
         @enterpriseId, @departmentId, @positionId, @employeeNumber,
         @lastName, @firstName, @middleName, @birthDate, @email, @phone,
         @contractNumber, @hireDateTechnical, NULL,
         'pending_assignment', 'pending_assignment', @salary, CURRENT_TIMESTAMP
       )`,
    );

    const transaction = this.database.transaction(() => {
      for (const row of evaluation.validRows) {
        const complete = Boolean(
          row.hireDate && row.departmentId && row.positionId,
        );
        try {
          if (complete) {
            this.employmentService.createHiredEmployee(
              {
                enterprise_id: row.enterpriseId,
                department_id: row.departmentId,
                position_id: row.positionId,
                employee_number: row.employeeNumber,
                last_name: row.lastName,
                first_name: row.firstName,
                middle_name: row.middleName,
                birth_date: row.birthDate,
                email: row.email,
                phone: row.phone,
                contract_number: row.contractNumber,
                hire_date: row.hireDate,
                salary: row.salary,
                employment_type: "full_time",
              },
              {
                enterpriseId: row.enterpriseId,
                departmentId:
                  session.scopeType === "department"
                    ? session.departmentId
                    : null,
              },
            );
          } else {
            insertPending.run({
              birthDate: row.birthDate,
              contractNumber: row.contractNumber,
              departmentId: row.departmentId,
              email: row.email,
              employeeNumber: row.employeeNumber,
              enterpriseId: row.enterpriseId,
              firstName: row.firstName,
              hireDateTechnical: row.hireDate ?? today(),
              lastName: row.lastName,
              middleName: row.middleName,
              phone: row.phone,
              positionId: row.positionId,
              salary: row.salary,
            });
          }
          importedRows += 1;
        } catch (error) {
          errors.push({ row: row.rowNumber, message: errorMessage(error) });
        }
      }
    });
    transaction();

    this.database
      .prepare(
        `INSERT INTO data_exchange_runs (
           direction, domain, format, file_name, total_rows,
           successful_rows, failed_rows, summary_json
         ) VALUES ('import', 'employees', 'table', ?, ?, ?, ?, ?)`,
      )
      .run(
        this.importCache.get(params.previewId)?.fileName ?? null,
        evaluation.totalRows,
        importedRows,
        evaluation.totalRows - importedRows,
        JSON.stringify({
          enterpriseId: session.enterpriseId,
          departmentId: session.departmentId,
          errors: errors.slice(0, 100),
        }),
      );

    this.importCache.delete(params.previewId);
    return {
      totalRows: evaluation.totalRows,
      importedRows,
      skippedRows: evaluation.totalRows - importedRows,
      errors: errors.slice(0, 200),
      warnings: warnings.slice(0, 200),
    };
  }

  private evaluate(
    previewId: string,
    columnMap: EmployeeImportColumnMap,
    session: AuthSession,
  ): ImportEvaluation {
    const cached = this.importCache.get(previewId);
    if (!cached) {
      throw new Error("Предпросмотр импорта устарел. Выберите файл заново");
    }
    if (!columnMap.last_name || !columnMap.first_name) {
      throw new Error("Сопоставьте обязательные колонки «Фамилия» и «Имя»");
    }
    for (const header of Object.values(columnMap)) {
      if (header && !cached.headers.includes(header)) {
        throw new Error(`Колонка «${header}» отсутствует в выбранном файле`);
      }
    }

    const errors: EmployeeImportError[] = [];
    const warnings: EmployeeImportWarning[] = [];
    const validRows: ImportResolvedRow[] = [];
    const seenNumbers = new Set<string>();
    const seenIdentityBirth = new Set<string>();
    const seenNames = new Set<string>();
    const seenPhones = new Set<string>();
    const seenEmails = new Set<string>();
    let duplicateRows = 0;

    cached.rows.forEach((source, index) => {
      const rowNumber = index + 2;
      const rowErrors: string[] = [];
      const lastName = cell(source, columnMap.last_name);
      const firstName = cell(source, columnMap.first_name);
      const middleName = nullableCell(source, columnMap.middle_name);
      const birthDate = nullableCell(source, columnMap.birth_date);
      const email = nullableCell(source, columnMap.email)?.toLowerCase() ?? null;
      const phone = nullableCell(source, columnMap.phone);
      const employeeNumber = nullableCell(source, columnMap.employee_number);
      const contractNumber = nullableCell(source, columnMap.contract_number);
      const enterpriseName = nullableCell(source, columnMap.enterprise);
      const departmentName = nullableCell(source, columnMap.department);
      const positionName = nullableCell(source, columnMap.position);
      const runtimeMap = columnMap as Record<string, string | undefined>;
      const hireDate = nullableCell(source, runtimeMap.hire_date);
      const salaryText = nullableCell(source, runtimeMap.salary);
      const salary = salaryText
        ? Number(salaryText.replace(/\s/g, "").replace(",", "."))
        : 0;

      if (!lastName) rowErrors.push("не указана фамилия");
      if (!firstName) rowErrors.push("не указано имя");
      if (birthDate && !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
        rowErrors.push("дата рождения должна быть в формате ГГГГ-ММ-ДД");
      }
      if (hireDate && !/^\d{4}-\d{2}-\d{2}$/.test(hireDate)) {
        rowErrors.push("дата приёма должна быть в формате ГГГГ-ММ-ДД");
      }
      if (!Number.isFinite(salary) || salary < 0) {
        rowErrors.push("некорректный оклад");
      }

      const enterpriseId = enterpriseName
        ? this.lookupEnterpriseId(enterpriseName)
        : session.enterpriseId;
      const departmentId = departmentName
        ? this.lookupDepartmentId(departmentName, enterpriseId)
        : session.departmentId;
      const positionId = positionName
        ? this.lookupPositionId(positionName, departmentId)
        : null;

      if (!enterpriseId) {
        rowErrors.push("не определено предприятие сотрудника");
      } else if (enterpriseName && !this.lookupEnterpriseId(enterpriseName)) {
        rowErrors.push(`предприятие «${enterpriseName}» не найдено`);
      }
      if (departmentName && !departmentId) {
        rowErrors.push(`отдел «${departmentName}» не найден в выбранном предприятии`);
      }
      if (positionName && !positionId) {
        rowErrors.push(`должность «${positionName}» не найдена в выбранном отделе`);
      }
      if (
        session.scopeType === "enterprise" &&
        enterpriseId &&
        enterpriseId !== session.enterpriseId
      ) {
        rowErrors.push("предприятие находится вне доступной области данных");
      }
      if (
        session.scopeType === "department" &&
        departmentId &&
        departmentId !== session.departmentId
      ) {
        rowErrors.push("отдел находится вне доступной области данных");
      }

      let hardDuplicate = false;
      const normalizedName = [lastName, firstName, middleName ?? ""]
        .map(normalizeDuplicateText)
        .join("|");
      const identityBirthKey =
        birthDate && normalizedName
          ? `${normalizedName}|${birthDate}`
          : "";
      const normalizedPhone = normalizePhone(phone);
      const normalizedEmail = normalizeDuplicateText(email);

      if (employeeNumber && enterpriseId) {
        const normalizedKey = `${enterpriseId}:${normalizeDuplicateText(
          employeeNumber,
        )}`;
        if (seenNumbers.has(normalizedKey)) {
          hardDuplicate = true;
          rowErrors.push(
            "табельный номер повторяется в импортируемом файле",
          );
        }
        seenNumbers.add(normalizedKey);
      }

      if (identityBirthKey) {
        if (seenIdentityBirth.has(identityBirthKey)) {
          hardDuplicate = true;
          rowErrors.push(
            "ФИО и дата рождения повторяются в импортируемом файле",
          );
        }
        seenIdentityBirth.add(identityBirthKey);
      }

      if (normalizedName) {
        if (seenNames.has(normalizedName) && !identityBirthKey) {
          warnings.push({
            row: rowNumber,
            message:
              "В импортируемом файле уже есть строка с таким же ФИО",
          });
        }
        seenNames.add(normalizedName);
      }
      if (normalizedPhone) {
        if (seenPhones.has(normalizedPhone)) {
          warnings.push({
            row: rowNumber,
            message:
              "В импортируемом файле уже есть строка с таким же телефоном",
          });
        }
        seenPhones.add(normalizedPhone);
      }
      if (normalizedEmail) {
        if (seenEmails.has(normalizedEmail)) {
          warnings.push({
            row: rowNumber,
            message:
              "В импортируемом файле уже есть строка с таким же email",
          });
        }
        seenEmails.add(normalizedEmail);
      }

      if (enterpriseId) {
        const duplicateResult = this.employmentService.checkDuplicates(
          {
            enterpriseId,
            employeeNumber: employeeNumber ?? undefined,
            lastName,
            firstName,
            middleName: middleName ?? undefined,
            birthDate: birthDate ?? undefined,
            phone: phone ?? undefined,
            email: email ?? undefined,
            contractNumber: contractNumber ?? undefined,
          },
          {
            enterpriseId:
              session.scopeType === "global"
                ? enterpriseId
                : session.enterpriseId,
            departmentId:
              session.scopeType === "department"
                ? session.departmentId
                : null,
          },
        );

        const blockingMatches = duplicateResult.matches.filter(
          (match) => match.blocking,
        );
        if (blockingMatches.length > 0) {
          hardDuplicate = true;
          for (const match of blockingMatches) {
            rowErrors.push(
              formatImportDuplicate(
                "дубликат",
                match.employeeName,
                match.fields
                  .filter((field) => field.blocking)
                  .map((field) => field.label),
              ),
            );
          }
        }

        for (const match of duplicateResult.matches.filter(
          (candidate) => !candidate.blocking,
        )) {
          warnings.push({
            row: rowNumber,
            message: formatImportDuplicate(
              "возможное совпадение",
              match.employeeName,
              match.fields.map((field) => field.label),
            ),
          });
        }
      }

      if (hardDuplicate) duplicateRows += 1;

      if (rowErrors.length > 0 || !enterpriseId) {
        errors.push({ row: rowNumber, message: rowErrors.join("; ") });
        return;
      }

      validRows.push({
        rowNumber,
        lastName,
        firstName,
        middleName,
        birthDate,
        email,
        phone,
        employeeNumber,
        contractNumber,
        enterpriseId,
        departmentId: departmentId ?? null,
        positionId: positionId ?? null,
        hireDate,
        salary,
      });
    });

    return {
      totalRows: cached.rows.length,
      duplicateRows,
      errors,
      warnings,
      validRows,
    };
  }

  private lookupEnterpriseId(name: string): number | null {
    const row = this.database
      .prepare(
        `SELECT id FROM enterprises
         WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))
           AND is_archived = 0
         LIMIT 1`,
      )
      .get(name) as { id: number } | undefined;
    return row?.id ?? null;
  }

  private lookupDepartmentId(
    name: string,
    enterpriseId: number | null,
  ): number | null {
    if (!enterpriseId) return null;
    const row = this.database
      .prepare(
        `SELECT id FROM departments
         WHERE enterprise_id = ?
           AND LOWER(TRIM(name)) = LOWER(TRIM(?))
           AND is_archived = 0
         LIMIT 1`,
      )
      .get(enterpriseId, name) as { id: number } | undefined;
    return row?.id ?? null;
  }

  private lookupPositionId(
    name: string,
    departmentId: number | null,
  ): number | null {
    if (!departmentId) return null;
    const row = this.database
      .prepare(
        `SELECT id FROM positions
         WHERE department_id = ?
           AND LOWER(TRIM(name)) = LOWER(TRIM(?))
           AND is_archived = 0
         LIMIT 1`,
      )
      .get(departmentId, name) as { id: number } | undefined;
    return row?.id ?? null;
  }

  private trimCache(): void {
    while (this.importCache.size > 5) {
      const firstKey = this.importCache.keys().next().value as string | undefined;
      if (!firstKey) break;
      this.importCache.delete(firstKey);
    }
  }
}

function normalizeDuplicateText(value: unknown): string {
  return String(value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizePhone(value: unknown): string {
  return String(value ?? "").replace(/\D/g, "");
}

function formatImportDuplicate(
  prefix: string,
  employeeName: string,
  fields: string[],
): string {
  const detail = fields.length > 0 ? `: ${fields.join(", ")}` : "";
  return `${prefix} — «${employeeName}»${detail}`;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function cell(source: Record<string, string>, header?: string): string {
  return header ? String(source[header] ?? "").trim() : "";
}

function nullableCell(
  source: Record<string, string>,
  header?: string,
): string | null {
  const value = cell(source, header);
  return value || null;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
