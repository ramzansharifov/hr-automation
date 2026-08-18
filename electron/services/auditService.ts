import type Database from "better-sqlite3";
import type { AuthSession } from "../../src/shared/types/access";
import type {
  AuditEvent,
  AuditListParams,
  HrRecord,
} from "../../src/shared/types/hr";

interface AuditRow {
  id: number;
  occurred_at: string;
  actor_account_type: "system_admin" | "employee_user" | "system";
  actor_account_id: number | null;
  actor_username: string;
  action: string;
  entity_type: string;
  entity_id: number | null;
  before_json: string | null;
  after_json: string | null;
  metadata_json: string | null;
}

export class AuditService {
  constructor(private readonly database: Database.Database) {}

  record(
    session: AuthSession | null,
    action: string,
    entityType: string,
    entityId?: number | null,
    before?: HrRecord | null,
    after?: HrRecord | null,
    metadata?: HrRecord | null,
  ): void {
    const actorAccountType = session
      ? session.employeeId === 0
        ? "system_admin"
        : "employee_user"
      : "system";
    const actorUsername = session?.username ?? "system";

    this.database
      .prepare(
        `INSERT INTO audit_events (
           actor_account_type, actor_account_id, actor_username,
           action, entity_type, entity_id,
           before_json, after_json, metadata_json
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        actorAccountType,
        session?.userId ?? null,
        actorUsername,
        action,
        entityType,
        entityId ?? null,
        stringify(before),
        stringify(after),
        stringify(metadata),
      );
  }

  list(params: AuditListParams = {}): AuditEvent[] {
    const search = params.search?.trim() ?? "";
    const limit = Math.min(Math.max(Math.floor(params.limit ?? 200), 1), 500);
    const rows = this.database
      .prepare(
        `SELECT * FROM audit_events
         WHERE @search = ''
            OR actor_username LIKE @pattern
            OR action LIKE @pattern
            OR entity_type LIKE @pattern
            OR metadata_json LIKE @pattern
         ORDER BY occurred_at DESC, id DESC
         LIMIT @limit`,
      )
      .all({ search, pattern: `%${search}%`, limit }) as AuditRow[];

    return rows.map((row) => ({
      id: row.id,
      occurredAt: row.occurred_at,
      actorAccountType: row.actor_account_type,
      actorAccountId: row.actor_account_id,
      actorUsername: row.actor_username,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      before: parseJson(row.before_json),
      after: parseJson(row.after_json),
      metadata: parseJson(row.metadata_json),
    }));
  }
}

function stringify(value: HrRecord | null | undefined): string | null {
  return value ? JSON.stringify(value) : null;
}

function parseJson(value: string | null): HrRecord | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as HrRecord)
      : null;
  } catch {
    return null;
  }
}
