import type Database from "better-sqlite3";
import type { AuthSession } from "../../src/shared/types/access";
import type {
  DocumentTypeRecord,
  SaveDocumentTypeParams,
} from "../../src/shared/types/documentTypes";

interface DocumentTypeRow {
  id: number;
  enterprise_id: number;
  enterprise_name: string;
  name: string;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export class DocumentTypeService {
  constructor(private readonly database: Database.Database) {}

  list(session: AuthSession): DocumentTypeRecord[] {
    const enterpriseId = this.resolveReadEnterprise(session);
    const rows = enterpriseId
      ? (this.database
          .prepare(
            `SELECT type.*, enterprise.name AS enterprise_name
             FROM document_types AS type
             JOIN enterprises AS enterprise ON enterprise.id = type.enterprise_id
             WHERE type.enterprise_id = ?
             ORDER BY type.is_active DESC, type.name COLLATE NOCASE`,
          )
          .all(enterpriseId) as DocumentTypeRow[])
      : (this.database
          .prepare(
            `SELECT type.*, enterprise.name AS enterprise_name
             FROM document_types AS type
             JOIN enterprises AS enterprise ON enterprise.id = type.enterprise_id
             ORDER BY enterprise.name COLLATE NOCASE, type.is_active DESC, type.name COLLATE NOCASE`,
          )
          .all() as DocumentTypeRow[]);
    return rows.map(mapRow);
  }

  save(params: SaveDocumentTypeParams, session: AuthSession): DocumentTypeRecord {
    const name = params.name.trim();
    if (!name) throw new Error("Укажите название типа документа");
    if (name.length > 200) throw new Error("Название типа документа слишком длинное");

    if (params.id) {
      const existing = this.getRow(params.id);
      this.assertInScope(existing, session);
      if (params.enterpriseId && params.enterpriseId !== existing.enterprise_id) {
        throw new Error("Нельзя перенести тип документа в другое предприятие");
      }
      try {
        this.database
          .prepare(
            `UPDATE document_types
             SET name = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
          )
          .run(name, params.isActive ? 1 : 0, params.id);
      } catch (error) {
        throw normalizeWriteError(error);
      }
      return mapRow(this.getRow(params.id));
    }

    const enterpriseId = this.resolveWriteEnterprise(params.enterpriseId, session);
    try {
      const result = this.database
        .prepare(
          `INSERT INTO document_types (enterprise_id, name, is_active)
           VALUES (?, ?, ?)`,
        )
        .run(enterpriseId, name, params.isActive ? 1 : 0);
      return mapRow(this.getRow(Number(result.lastInsertRowid)));
    } catch (error) {
      throw normalizeWriteError(error);
    }
  }

  delete(id: number, session: AuthSession): { success: true } {
    const existing = this.getRow(id);
    this.assertInScope(existing, session);
    try {
      this.database.prepare("DELETE FROM document_types WHERE id = ?").run(id);
      return { success: true };
    } catch (error) {
      throw normalizeWriteError(error);
    }
  }

  private resolveReadEnterprise(session: AuthSession): number | null {
    if (session.scopeType === "global") return null;
    if (session.scopeType !== "enterprise" && session.scopeType !== "department") {
      throw new Error("Справочник типов документов недоступен в личной области данных");
    }
    if (!session.enterpriseId) {
      throw new Error("Для текущего пользователя не определено предприятие");
    }
    return session.enterpriseId;
  }

  private resolveWriteEnterprise(
    requestedEnterpriseId: number | undefined,
    session: AuthSession,
  ): number {
    if (session.scopeType === "global") {
      const enterpriseId = positiveNumber(requestedEnterpriseId);
      if (!enterpriseId) throw new Error("Выберите предприятие для типа документа");
      return enterpriseId;
    }
    if (session.scopeType !== "enterprise") {
      throw new Error("Изменять типы документов можно только на уровне предприятия");
    }
    if (!session.enterpriseId) {
      throw new Error("Для текущего пользователя не определено предприятие");
    }
    return session.enterpriseId;
  }

  private assertInScope(row: DocumentTypeRow, session: AuthSession): void {
    if (session.scopeType === "global") return;
    if (
      (session.scopeType === "enterprise" || session.scopeType === "department") &&
      session.enterpriseId === row.enterprise_id
    ) {
      return;
    }
    throw new Error("Тип документа принадлежит другому предприятию");
  }

  private getRow(id: number): DocumentTypeRow {
    const row = this.database
      .prepare(
        `SELECT type.*, enterprise.name AS enterprise_name
         FROM document_types AS type
         JOIN enterprises AS enterprise ON enterprise.id = type.enterprise_id
         WHERE type.id = ?
         LIMIT 1`,
      )
      .get(id) as DocumentTypeRow | undefined;
    if (!row) throw new Error("Тип документа не найден");
    return row;
  }
}

function mapRow(row: DocumentTypeRow): DocumentTypeRecord {
  return {
    id: row.id,
    enterpriseId: row.enterprise_id,
    enterpriseName: row.enterprise_name,
    name: row.name,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function positiveNumber(value: unknown): number | null {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function normalizeWriteError(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("UNIQUE constraint failed")) {
    return new Error("Тип документа с таким названием уже существует в предприятии");
  }
  if (message.includes("Тип документа уже используется")) {
    return new Error("Этот тип документа уже используется. Отключите его вместо удаления");
  }
  return error instanceof Error ? error : new Error(message);
}
