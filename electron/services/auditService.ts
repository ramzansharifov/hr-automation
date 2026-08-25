import type Database from "better-sqlite3";
import type {
  AccessScopeType,
  AuthSession,
} from "../../src/shared/types/access";
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
  enterprise_id: number | null;
  department_id: number | null;
  before_json: string | null;
  after_json: string | null;
  metadata_json: string | null;
}

export interface AuditTenantScope {
  scopeType: AccessScopeType;
  enterpriseId: number | null;
  departmentId: number | null;
}

interface TenantContext {
  enterpriseId: number | null;
  departmentId: number | null;
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
    metadata?: Record<string, unknown> | null,
  ): void {
    const actorAccountType = session
      ? session.employeeId === 0
        ? "system_admin"
        : "employee_user"
      : "system";
    const actorUsername = session?.username ?? "system";
    const tenant = this.resolveTenantContext(
      session,
      entityType,
      entityId ?? null,
      before ?? null,
      after ?? null,
      metadata ?? null,
    );

    this.database
      .prepare(
        `INSERT INTO audit_events (
           actor_account_type, actor_account_id, actor_username,
           action, entity_type, entity_id, enterprise_id, department_id,
           before_json, after_json, metadata_json
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        actorAccountType,
        session?.userId ?? null,
        actorUsername,
        action,
        entityType,
        entityId ?? null,
        tenant.enterpriseId,
        tenant.departmentId,
        stringify(before),
        stringify(after),
        stringify(metadata),
      );
  }

  list(params: AuditListParams = {}, scope?: AuditTenantScope): AuditEvent[] {
    const search = params.search?.trim() ?? "";
    const limit = Math.min(Math.max(Math.floor(params.limit ?? 200), 1), 500);
    const effectiveScope = scope ?? {
      scopeType: "global" as const,
      enterpriseId: null,
      departmentId: null,
    };
    const rows = this.database
      .prepare(
        `SELECT * FROM audit_events
         WHERE (
           @scopeType = 'global'
           OR (@scopeType = 'enterprise' AND enterprise_id = @enterpriseId)
           OR (@scopeType = 'department' AND department_id = @departmentId)
         )
           AND (
             @search = ''
             OR actor_username LIKE @pattern
             OR action LIKE @pattern
             OR entity_type LIKE @pattern
             OR metadata_json LIKE @pattern
           )
         ORDER BY occurred_at DESC, id DESC
         LIMIT @limit`,
      )
      .all({
        scopeType: effectiveScope.scopeType,
        enterpriseId: effectiveScope.enterpriseId,
        departmentId: effectiveScope.departmentId,
        search,
        pattern: `%${search}%`,
        limit,
      }) as AuditRow[];

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

  private resolveTenantContext(
    session: AuthSession | null,
    entityType: string,
    entityId: number | null,
    before: HrRecord | null,
    after: HrRecord | null,
    metadata: Record<string, unknown> | null,
  ): TenantContext {
    const sources = [metadata, after, before].filter(
      (value): value is Record<string, unknown> => Boolean(value),
    );
    let enterpriseId = firstPositiveNumber(sources, ["enterprise_id", "enterpriseId"]);
    let departmentId = firstPositiveNumber(sources, ["department_id", "departmentId"]);

    if (entityType === "enterprises" && entityId) enterpriseId = entityId;
    if (entityType === "departments" && entityId) departmentId = entityId;

    if (entityType === "positions") {
      departmentId ??= firstPositiveNumber(sources, ["department_id", "departmentId"]);
      if (!departmentId && entityId) {
        departmentId = this.lookupNumber(
          "SELECT department_id FROM positions WHERE id = ?",
          entityId,
        );
      }
    }

    if (entityType === "employees") {
      departmentId ??= firstPositiveNumber(sources, ["department_id", "departmentId"]);
      if (!departmentId && entityId) {
        departmentId = this.lookupNumber(
          "SELECT department_id FROM employees WHERE id = ?",
          entityId,
        );
      }
    }

    if (
      [
        "employee_education",
        "employee_experience",
        "employment_history",
        "vacations",
      ].includes(entityType)
    ) {
      const employeeId =
        firstPositiveNumber(sources, ["employee_id", "employeeId"]) ??
        (entityType === "employment_history" ? entityId : null);
      if (employeeId) {
        const employeeContext = this.getEmployeeContext(employeeId);
        departmentId ??= employeeContext.departmentId;
        enterpriseId ??= employeeContext.enterpriseId;
      }
    }

    if (entityType === "vacation_types") {
      enterpriseId ??= firstPositiveNumber(sources, ["enterprise_id", "enterpriseId"]);
      departmentId = null;
    }

    if (entityType === "vacancies") {
      const positionId = firstPositiveNumber(sources, ["position_id", "positionId"]);
      if (positionId) {
        const positionContext = this.getPositionContext(positionId);
        departmentId ??= positionContext.departmentId;
        enterpriseId ??= positionContext.enterpriseId;
      }
    }

    if (entityType === "candidates") {
      const vacancyId = firstPositiveNumber(sources, ["vacancy_id", "vacancyId"]);
      if (vacancyId) {
        const vacancyContext = this.getVacancyContext(vacancyId);
        departmentId ??= vacancyContext.departmentId;
        enterpriseId ??= vacancyContext.enterpriseId;
      }
    }

    if (departmentId && !enterpriseId) {
      enterpriseId = this.lookupNumber(
        "SELECT enterprise_id FROM departments WHERE id = ?",
        departmentId,
      );
    }

    if (!enterpriseId && session?.enterpriseId) {
      enterpriseId = session.enterpriseId;
    }

    const hasExplicitEntityContext = Boolean(
      enterpriseId || departmentId || entityType === "enterprises" || entityType === "vacation_types",
    );
    if (!departmentId && !hasExplicitEntityContext && session?.departmentId) {
      departmentId = session.departmentId;
    }
    if (departmentId && !enterpriseId) {
      enterpriseId = this.lookupNumber(
        "SELECT enterprise_id FROM departments WHERE id = ?",
        departmentId,
      );
    }

    return { enterpriseId, departmentId };
  }

  private getEmployeeContext(employeeId: number): TenantContext {
    const row = this.database
      .prepare(
        `SELECT employee.department_id AS departmentId,
                department.enterprise_id AS enterpriseId
         FROM employees AS employee
         LEFT JOIN departments AS department ON department.id = employee.department_id
         WHERE employee.id = ?
         LIMIT 1`,
      )
      .get(employeeId) as TenantContext | undefined;
    return row ?? { enterpriseId: null, departmentId: null };
  }

  private getPositionContext(positionId: number): TenantContext {
    const row = this.database
      .prepare(
        `SELECT position.department_id AS departmentId,
                department.enterprise_id AS enterpriseId
         FROM positions AS position
         LEFT JOIN departments AS department ON department.id = position.department_id
         WHERE position.id = ?
         LIMIT 1`,
      )
      .get(positionId) as TenantContext | undefined;
    return row ?? { enterpriseId: null, departmentId: null };
  }

  private getVacancyContext(vacancyId: number): TenantContext {
    const row = this.database
      .prepare(
        `SELECT position.department_id AS departmentId,
                department.enterprise_id AS enterpriseId
         FROM vacancies AS vacancy
         LEFT JOIN positions AS position ON position.id = vacancy.position_id
         LEFT JOIN departments AS department ON department.id = position.department_id
         WHERE vacancy.id = ?
         LIMIT 1`,
      )
      .get(vacancyId) as TenantContext | undefined;
    return row ?? { enterpriseId: null, departmentId: null };
  }

  private lookupNumber(sql: string, id: number): number | null {
    const value = this.database.prepare(sql).pluck().get(id);
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : null;
  }
}

function firstPositiveNumber(
  sources: Record<string, unknown>[],
  keys: string[],
): number | null {
  for (const source of sources) {
    for (const key of keys) {
      const number = Number(source[key]);
      if (Number.isFinite(number) && number > 0) return number;
    }
  }
  return null;
}

function stringify(
  value: Record<string, unknown> | null | undefined,
): string | null {
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
