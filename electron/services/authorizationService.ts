import type Database from "better-sqlite3";
import type { AuthSession } from "../../src/shared/types/access";
import type {
  HrDashboardStats,
  HrEntityKey,
  HrFilterCondition,
  HrFilterValue,
  HrListParams,
  HrRecord,
} from "../../src/shared/types/hr";
import { AuthenticationService } from "./authenticationService";

type EntityPermissionSet = {
  view: string;
  create: string;
  edit: string;
  delete: string;
};

const entityPermissions: Record<HrEntityKey, EntityPermissionSet> = {
  enterprises: {
    view: "enterprises.view",
    create: "enterprises.create",
    edit: "enterprises.edit",
    delete: "enterprises.delete",
  },
  departments: {
    view: "departments.view",
    create: "departments.create",
    edit: "departments.edit",
    delete: "departments.delete",
  },
  positions: {
    view: "positions.view",
    create: "positions.create",
    edit: "positions.edit",
    delete: "positions.delete",
  },
  employees: {
    view: "employees.view",
    create: "employees.create",
    edit: "employees.edit",
    delete: "employees.edit",
  },
  employee_education: {
    view: "employee_education.view",
    create: "employee_education.create",
    edit: "employee_education.edit",
    delete: "employee_education.delete",
  },
  employee_experience: {
    view: "employee_experience.view",
    create: "employee_experience.create",
    edit: "employee_experience.edit",
    delete: "employee_experience.delete",
  },
  employment_history: {
    view: "employment_history.view",
    create: "employment_history.manage",
    edit: "employment_history.manage",
    delete: "employment_history.manage",
  },
  vacation_types: {
    view: "vacation_types.view",
    create: "vacation_types.create",
    edit: "vacation_types.edit",
    delete: "vacation_types.delete",
  },
  vacations: {
    view: "vacations.view",
    create: "vacations.create",
    edit: "vacations.edit",
    delete: "vacations.delete",
  },
};

export class AuthorizationService {
  constructor(
    private readonly database: Database.Database,
    private readonly authenticationService: AuthenticationService,
  ) {}

  requirePermission(permissionCode: string): AuthSession {
    const session = this.authenticationService.requireSession();
    const permissionScope = session.permissionScopes[permissionCode];
    if (!permissionScope) {
      throw new Error("Недостаточно прав для выполнения действия");
    }
    return { ...session, scopeType: permissionScope };
  }

  requireGlobalPermission(permissionCode: string): AuthSession {
    const session = this.requirePermission(permissionCode);
    if (session.scopeType !== "global") {
      throw new Error("Это действие доступно только роли с глобальной областью данных");
    }
    return session;
  }

  requireAnyGlobalPermission(permissionCodes: string[]): AuthSession {
    const session = this.authenticationService.requireSession();
    for (const code of permissionCodes) {
      if (session.permissionScopes[code] === "global") {
        return { ...session, scopeType: "global" };
      }
    }
    throw new Error("Недостаточно прав для выполнения действия");
  }

  scopeListParams(entity: HrEntityKey, params: HrListParams): HrListParams {
    const session = this.requireViewPermission(entity);
    if (entity === "vacation_types") return params;

    const restriction = this.getEntityRestriction(entity, session);
    if (!restriction) return params;

    return {
      ...params,
      filters: {
        ...(params.filters ?? {}),
        [restriction.column]: intersectFilter(
          params.filters?.[restriction.column],
          restriction.values,
        ),
      },
    };
  }

  assertCanViewRecord(entity: HrEntityKey, record: HrRecord): void {
    const session = this.requireViewPermission(entity, record);
    if (entity === "vacation_types") return;
    this.assertRecordInScope(entity, record, session);
  }

  assertCanCreate(entity: HrEntityKey, data: HrRecord): void {
    const session = this.requirePermission(entityPermissions[entity].create);
    if (entity === "enterprises" && session.scopeType !== "global") {
      throw new Error("Создавать предприятия можно только в глобальной области данных");
    }
    if (entity === "departments" && session.scopeType === "department") {
      throw new Error("Создавать отделы можно только на уровне предприятия");
    }
    this.assertRecordInScope(entity, data, session);
  }

  assertCanUpdate(entity: HrEntityKey, existing: HrRecord, data: HrRecord): void {
    const changedKeys = Object.keys(data).filter(
      (key) => normalizeComparable(data[key]) !== normalizeComparable(existing[key]),
    );

    if (entity === "departments" && changedKeys.includes("enterprise_id")) {
      const session = this.requirePermission("departments.edit");
      if (session.scopeType !== "global") {
        throw new Error("Переносить отдел между предприятиями может только глобальный администратор");
      }
    }

    const permissionCodes = new Set<string>();

    if (entity === "vacations" && changedKeys.includes("status")) {
      permissionCodes.add("vacations.approve");
    }

    const leaderField =
      entity === "enterprises"
        ? "general_director_employee_id"
        : entity === "departments"
          ? "director_employee_id"
          : null;
    if (leaderField && changedKeys.includes(leaderField)) {
      permissionCodes.add(
        entity === "enterprises"
          ? "enterprises.assign_leader"
          : "departments.assign_leader",
      );
    }

    const specialKeys = new Set(
      [entity === "vacations" ? "status" : null, leaderField].filter(
        (value): value is string => Boolean(value),
      ),
    );
    const hasRegularChanges = changedKeys.some((key) => !specialKeys.has(key));
    if (hasRegularChanges || permissionCodes.size === 0) {
      permissionCodes.add(entityPermissions[entity].edit);
    }

    for (const permissionCode of permissionCodes) {
      const session = this.requirePermission(permissionCode);
      this.assertRecordInScope(entity, existing, session);
      this.assertRecordInScope(entity, { ...existing, ...data }, session);
    }
  }

  assertCanDelete(entity: HrEntityKey, existing: HrRecord): void {
    const session = this.requirePermission(entityPermissions[entity].delete);
    if (entity === "enterprises" && session.scopeType !== "global") {
      throw new Error("Удалять предприятия можно только в глобальной области данных");
    }
    if (entity === "departments" && session.scopeType === "department") {
      throw new Error("Удалять отдел может только администратор предприятия или глобальный администратор");
    }
    this.assertRecordInScope(entity, existing, session);
  }

  assertCanChangeEmployment(
    employee: HrRecord,
    action: "change" | "terminate" = "change",
    target?: { enterpriseId: number; departmentId: number },
  ): void {
    const session = this.requirePermission(
      action === "terminate" ? "employees.terminate" : "employees.change_employment",
    );
    this.assertRecordInScope("employees", employee, session);

    if (action !== "change" || !target || session.scopeType === "global") return;
    if (
      session.scopeType === "enterprise" &&
      target.enterpriseId !== session.enterpriseId
    ) {
      throw new Error("Нельзя перевести сотрудника за пределы своего предприятия");
    }
    if (
      session.scopeType === "department" &&
      target.departmentId !== session.departmentId
    ) {
      throw new Error("Нельзя перевести сотрудника за пределы своего отдела");
    }
  }

  filterVacancies(records: HrRecord[]): HrRecord[] {
    const session = this.requirePermission("vacancies.view");
    return records.filter((record) => this.isVacancyInScope(record, session));
  }

  assertCanViewVacancy(record: HrRecord): void {
    const session = this.requirePermission("vacancies.view");
    if (!this.isVacancyInScope(record, session)) {
      throw new Error("Вакансия находится вне доступной области данных");
    }
  }

  assertCanManageVacancy(
    record: HrRecord,
    action: "create" | "edit" | "delete",
  ): void {
    const session = this.requirePermission(`vacancies.${action}`);
    if (!this.isVacancyInScope(record, session)) {
      throw new Error("Вакансия находится вне доступной области данных");
    }
  }

  filterCandidates(records: HrRecord[]): HrRecord[] {
    const session = this.requirePermission("candidates.view");
    return records.filter((record) => this.isCandidateInScope(record, session));
  }

  assertCanViewCandidate(record: HrRecord): void {
    const session = this.requirePermission("candidates.view");
    if (!this.isCandidateInScope(record, session)) {
      throw new Error("Кандидат находится вне доступной области данных");
    }
  }

  assertCanManageCandidate(
    record: HrRecord,
    action: "create" | "edit" | "delete" | "hire",
  ): void {
    const session = this.requirePermission(`candidates.${action}`);
    if (!this.isCandidateInScope(record, session)) {
      throw new Error("Кандидат находится вне доступной области данных");
    }
  }

  dashboard(): HrDashboardStats {
    const session = this.requirePermission("dashboard.view");
    if (session.scopeType === "global") return this.globalDashboard();

    const employeeIds = this.getAllowedEmployeeIds(session);
    const departmentIds = this.getAllowedDepartmentIds(session);
    const positionIds = this.getAllowedPositionIds(session);
    const vacancyIds = this.getAllowedVacancyIds(positionIds);

    return {
      employeesTotal: employeeIds.length,
      departmentsTotal: departmentIds.length,
      positionsTotal: positionIds.length,
      activeVacations: this.countWithEmployeeIds(
        `SELECT COUNT(*) FROM vacations
         WHERE status IN ('planned', 'approved')`,
        employeeIds,
      ),
      upcomingVacations: this.countWithEmployeeIds(
        `SELECT COUNT(*) FROM vacations
         WHERE status IN ('planned', 'approved')
           AND starts_at >= DATE('now')
           AND starts_at <= DATE('now', '+30 day')`,
        employeeIds,
      ),
      openVacancies: this.countIn("vacancies", "position_id", positionIds, "status = 'open'"),
      candidatesOnOffer: this.countIn("candidates", "vacancy_id", vacancyIds, "status = 'offer'"),
      blockedUsers: this.countUsersForEmployees(employeeIds, "user.status = 'blocked'"),
      employeesMissingAssignment: this.countEmployees(
        employeeIds,
        "(employee.department_id IS NULL OR employee.position_id IS NULL)",
      ),
      emailConflicts: 0,
    };
  }

  private requireViewPermission(
    entity: HrEntityKey,
    record?: HrRecord,
  ): AuthSession {
    const session = this.authenticationService.requireSession();
    const regularPermission = entityPermissions[entity].view;
    const regularScope = session.permissionScopes[regularPermission];

    if (regularScope) return { ...session, scopeType: regularScope };

    const canUseProfilePermission =
      [
        "employees",
        "employee_education",
        "employee_experience",
        "employment_history",
      ].includes(entity) &&
      Boolean(session.permissionScopes["profile.view"]) &&
      (!record || this.resolveEmployeeId(entity, record) === session.employeeId);

    if (canUseProfilePermission) {
      return { ...session, scopeType: "self" };
    }

    throw new Error("Недостаточно прав для просмотра данных");
  }

  private getEntityRestriction(
    entity: HrEntityKey,
    session: AuthSession,
  ): { column: string; values: number[] } | null {
    if (session.scopeType === "global") return null;

    if (entity === "enterprises") {
      return { column: "id", values: compactIds([session.enterpriseId]) };
    }
    if (entity === "departments") {
      if (session.scopeType === "enterprise") {
        return {
          column: "enterprise_id",
          values: compactIds([session.enterpriseId]),
        };
      }
      return { column: "id", values: compactIds([session.departmentId]) };
    }
    if (entity === "positions") {
      return {
        column: "department_id",
        values: this.getAllowedDepartmentIds(session),
      };
    }
    if (entity === "employees") {
      if (session.scopeType === "self") {
        return { column: "id", values: [session.employeeId] };
      }
      if (session.scopeType === "enterprise") {
        return {
          column: "enterprise_id",
          values: compactIds([session.enterpriseId]),
        };
      }
      return {
        column: "department_id",
        values: compactIds([session.departmentId]),
      };
    }

    return {
      column: "employee_id",
      values: this.getAllowedEmployeeIds(session),
    };
  }

  private assertRecordInScope(
    entity: HrEntityKey,
    record: HrRecord,
    session: AuthSession,
  ): void {
    if (session.scopeType === "global") return;
    if (entity === "vacation_types") {
      const enterpriseId = toPositiveNumber(record.enterprise_id);
      if (enterpriseId && enterpriseId === session.enterpriseId) return;
      throw new Error("Вид отпуска находится вне доступной области данных");
    }

    const context = this.resolveRecordContext(entity, record);
    const allowed =
      session.scopeType === "self"
        ? context.employeeId === session.employeeId
        : session.scopeType === "department"
          ? context.departmentId === session.departmentId
          : context.enterpriseId === session.enterpriseId;

    if (!allowed) {
      throw new Error("Запись находится вне доступной области данных");
    }
  }

  private resolveRecordContext(
    entity: HrEntityKey,
    record: HrRecord,
  ): {
    employeeId: number | null;
    departmentId: number | null;
    enterpriseId: number | null;
  } {
    if (entity === "employees") {
      const employeeId = toPositiveNumber(record.id);
      const departmentId = toPositiveNumber(record.department_id);
      return {
        employeeId,
        departmentId,
        enterpriseId:
          toPositiveNumber(record.enterprise_id) ??
          this.getEnterpriseIdForDepartment(departmentId),
      };
    }

    if (
      [
        "employee_education",
        "employee_experience",
        "employment_history",
        "vacations",
      ].includes(entity)
    ) {
      return this.getEmployeeContext(toPositiveNumber(record.employee_id));
    }

    if (entity === "departments") {
      const departmentId = toPositiveNumber(record.id);
      return {
        employeeId: null,
        departmentId,
        enterpriseId: toPositiveNumber(record.enterprise_id),
      };
    }

    if (entity === "positions") {
      const departmentId = toPositiveNumber(record.department_id);
      return {
        employeeId: null,
        departmentId,
        enterpriseId: this.getEnterpriseIdForDepartment(departmentId),
      };
    }

    return {
      employeeId: null,
      departmentId: null,
      enterpriseId: toPositiveNumber(record.id),
    };
  }

  private resolveEmployeeId(entity: HrEntityKey, record: HrRecord): number | null {
    return entity === "employees"
      ? toPositiveNumber(record.id)
      : toPositiveNumber(record.employee_id);
  }

  private getEmployeeContext(employeeId: number | null): {
    employeeId: number | null;
    departmentId: number | null;
    enterpriseId: number | null;
  } {
    if (!employeeId) {
      return { employeeId: null, departmentId: null, enterpriseId: null };
    }
    const row = this.database
      .prepare(
        `SELECT employee.department_id AS departmentId,
                COALESCE(employee.enterprise_id, department.enterprise_id) AS enterpriseId
         FROM employees AS employee
         LEFT JOIN departments AS department ON department.id = employee.department_id
         WHERE employee.id = ?
         LIMIT 1`,
      )
      .get(employeeId) as
      | { departmentId: number | null; enterpriseId: number | null }
      | undefined;
    return {
      employeeId,
      departmentId: row?.departmentId ?? null,
      enterpriseId: row?.enterpriseId ?? null,
    };
  }

  private getEnterpriseIdForDepartment(departmentId: number | null): number | null {
    if (!departmentId) return null;
    const row = this.database
      .prepare("SELECT enterprise_id AS enterpriseId FROM departments WHERE id = ?")
      .get(departmentId) as { enterpriseId: number | null } | undefined;
    return row?.enterpriseId ?? null;
  }

  private getAllowedDepartmentIds(session: AuthSession): number[] {
    if (session.scopeType === "enterprise" && session.enterpriseId) {
      return (
        this.database
          .prepare("SELECT id FROM departments WHERE enterprise_id = ?")
          .all(session.enterpriseId) as Array<{ id: number }>
      ).map((row) => row.id);
    }
    return compactIds([session.departmentId]);
  }

  private getAllowedPositionIds(session: AuthSession): number[] {
    return this.idsIn("positions", "department_id", this.getAllowedDepartmentIds(session));
  }

  private getAllowedEmployeeIds(session: AuthSession): number[] {
    if (session.scopeType === "self") return [session.employeeId];
    if (session.scopeType === "enterprise" && session.enterpriseId) {
      return (
        this.database
          .prepare("SELECT id FROM employees WHERE enterprise_id = ?")
          .all(session.enterpriseId) as Array<{ id: number }>
      ).map((row) => row.id);
    }
    return this.idsIn("employees", "department_id", compactIds([session.departmentId]));
  }

  private getAllowedVacancyIds(positionIds: number[]): number[] {
    return this.idsIn("vacancies", "position_id", positionIds);
  }

  private isVacancyInScope(record: HrRecord, session: AuthSession): boolean {
    if (session.scopeType === "global") return true;
    const positionId = toPositiveNumber(record.position_id);
    if (!positionId) return false;
    const row = this.database
      .prepare(
        `SELECT position.department_id AS departmentId,
                department.enterprise_id AS enterpriseId
         FROM positions AS position
         JOIN departments AS department ON department.id = position.department_id
         WHERE position.id = ?`,
      )
      .get(positionId) as
      | { departmentId: number; enterpriseId: number }
      | undefined;
    if (!row) return false;
    if (session.scopeType === "enterprise") {
      return row.enterpriseId === session.enterpriseId;
    }
    return row.departmentId === session.departmentId;
  }

  private isCandidateInScope(record: HrRecord, session: AuthSession): boolean {
    const vacancyId = toPositiveNumber(record.vacancy_id);
    if (!vacancyId) return false;
    const vacancy = this.database
      .prepare("SELECT position_id FROM vacancies WHERE id = ?")
      .get(vacancyId) as HrRecord | undefined;
    return vacancy ? this.isVacancyInScope(vacancy, session) : false;
  }

  private globalDashboard(): HrDashboardStats {
    return {
      employeesTotal: this.scalar("SELECT COUNT(*) FROM employees"),
      departmentsTotal: this.scalar("SELECT COUNT(*) FROM departments"),
      positionsTotal: this.scalar("SELECT COUNT(*) FROM positions"),
      activeVacations: this.scalar(
        "SELECT COUNT(*) FROM vacations WHERE status IN ('planned', 'approved')",
      ),
      upcomingVacations: this.scalar(
        `SELECT COUNT(*) FROM vacations
         WHERE status IN ('planned', 'approved')
           AND starts_at >= DATE('now')
           AND starts_at <= DATE('now', '+30 day')`,
      ),
      openVacancies: this.scalar("SELECT COUNT(*) FROM vacancies WHERE status = 'open'"),
      candidatesOnOffer: this.scalar("SELECT COUNT(*) FROM candidates WHERE status = 'offer'"),
      blockedUsers: this.scalar("SELECT COUNT(*) FROM users WHERE status = 'blocked'"),
      employeesMissingAssignment: this.scalar(
        "SELECT COUNT(*) FROM employees WHERE department_id IS NULL OR position_id IS NULL",
      ),
      emailConflicts: this.scalar("SELECT COUNT(*) FROM email_conflicts"),
    };
  }

  private idsIn(table: string, column: string, ids: number[]): number[] {
    if (ids.length === 0) return [];
    const placeholders = ids.map(() => "?").join(", ");
    return (
      this.database
        .prepare(`SELECT id FROM ${table} WHERE ${column} IN (${placeholders})`)
        .all(...ids) as Array<{ id: number }>
    ).map((row) => row.id);
  }

  private countIn(
    table: string,
    column: string,
    ids: number[],
    extraCondition?: string,
  ): number {
    if (ids.length === 0) return 0;
    const placeholders = ids.map(() => "?").join(", ");
    return this.scalar(
      `SELECT COUNT(*) FROM ${table}
       WHERE ${column} IN (${placeholders})${extraCondition ? ` AND ${extraCondition}` : ""}`,
      ids,
    );
  }

  private countEmployees(employeeIds: number[], condition: string): number {
    if (employeeIds.length === 0) return 0;
    const placeholders = employeeIds.map(() => "?").join(", ");
    return this.scalar(
      `SELECT COUNT(*) FROM employees AS employee
       WHERE employee.id IN (${placeholders}) AND ${condition}`,
      employeeIds,
    );
  }

  private countUsersForEmployees(employeeIds: number[], condition: string): number {
    if (employeeIds.length === 0) return 0;
    const placeholders = employeeIds.map(() => "?").join(", ");
    return this.scalar(
      `SELECT COUNT(*) FROM users AS user
       WHERE user.employee_id IN (${placeholders}) AND ${condition}`,
      employeeIds,
    );
  }

  private countWithEmployeeIds(baseSql: string, employeeIds: number[]): number {
    if (employeeIds.length === 0) return 0;
    const placeholders = employeeIds.map(() => "?").join(", ");
    return this.scalar(
      `${baseSql} AND employee_id IN (${placeholders})`,
      employeeIds,
    );
  }

  private scalar(sql: string, params: unknown[] = []): number {
    return Number(this.database.prepare(sql).pluck().get(...params) ?? 0);
  }
}

function intersectFilter(
  existing: HrFilterValue | HrFilterCondition | undefined,
  allowedValues: number[],
): HrFilterCondition {
  const allowed = new Set(allowedValues);
  if (allowed.size === 0) return { operator: "in", value: [-1] };
  if (existing === undefined || existing === null || existing === "") {
    return { operator: "in", value: [...allowed] };
  }

  const rawValue =
    typeof existing === "object" &&
    !Array.isArray(existing) &&
    "value" in existing
      ? existing.value
      : existing;
  const requested = (Array.isArray(rawValue) ? rawValue : [rawValue])
    .map(Number)
    .filter(Number.isFinite);
  const intersection = requested.filter((value) => allowed.has(value));
  return {
    operator: "in",
    value: intersection.length > 0 ? intersection : [-1],
  };
}

function compactIds(values: Array<number | null>): number[] {
  return values.filter((value): value is number => Boolean(value && value > 0));
}

function toPositiveNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function normalizeComparable(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}
