import type Database from "better-sqlite3";
import type {
  AuthSession,
  AccessScopeType,
} from "../../src/shared/types/access";
import type {
  HrDashboardStats,
  HrEntityKey,
  HrFilterCondition,
  HrListParams,
  HrRecord,
} from "../../src/shared/types/hr";
import { AuthenticationService } from "./authenticationService";

const entityPermissions: Record<
  HrEntityKey,
  { view: string; manage: string }
> = {
  enterprises: { view: "organization.view", manage: "organization.manage" },
  departments: { view: "organization.view", manage: "organization.manage" },
  positions: { view: "organization.view", manage: "organization.manage" },
  employees: { view: "employees.view", manage: "employees.manage" },
  employee_education: { view: "employees.view", manage: "employees.manage" },
  employee_experience: { view: "employees.view", manage: "employees.manage" },
  employment_history: { view: "employees.view", manage: "employees.manage" },
  vacations: { view: "vacations.view", manage: "vacations.manage" },
  payroll: { view: "payroll.view", manage: "payroll.manage" },
};

export class AuthorizationService {
  constructor(
    private readonly database: Database.Database,
    private readonly authenticationService: AuthenticationService,
  ) {}

  requirePermission(permissionCode: string): AuthSession {
    const session = this.authenticationService.requireSession();
    if (!session.permissionCodes.includes(permissionCode)) {
      throw new Error("Недостаточно прав для выполнения действия");
    }
    return session;
  }

  requireGlobalPermission(permissionCode: string): AuthSession {
    const session = this.requirePermission(permissionCode);
    if (session.scopeType !== "global") {
      throw new Error("Это действие доступно только роли с глобальной областью данных");
    }
    return session;
  }

  scopeListParams(entity: HrEntityKey, params: HrListParams): HrListParams {
    const session = this.requireViewPermission(entity);
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
    this.assertRecordInScope(entity, record, session);
  }

  assertCanCreate(entity: HrEntityKey, data: HrRecord): void {
    const session = this.requireManagePermission(entity);
    if (entity === "enterprises" && session.scopeType !== "global") {
      throw new Error("Создание предприятия доступно только в глобальной области");
    }
    this.assertRecordInScope(entity, data, session);
  }

  assertCanUpdate(entity: HrEntityKey, existing: HrRecord, data: HrRecord): void {
    const session = this.requireManagePermission(entity);
    this.assertRecordInScope(entity, existing, session);
    this.assertRecordInScope(entity, { ...existing, ...data }, session);
  }

  assertCanDelete(entity: HrEntityKey, existing: HrRecord): void {
    const session = this.requireManagePermission(entity);
    this.assertRecordInScope(entity, existing, session);
  }

  assertCanChangeEmployment(employee: HrRecord): void {
    const session = this.requirePermission("employees.manage");
    this.assertRecordInScope("employees", employee, session);
  }

  filterVacancies(records: HrRecord[]): HrRecord[] {
    const session = this.requirePermission("recruitment.view");
    return records.filter((record) => this.isVacancyInScope(record, session));
  }

  assertCanViewVacancy(record: HrRecord): void {
    const session = this.requirePermission("recruitment.view");
    if (!this.isVacancyInScope(record, session)) {
      throw new Error("Вакансия находится вне доступной области данных");
    }
  }

  assertCanManageVacancy(record: HrRecord): void {
    const session = this.requirePermission("recruitment.manage");
    if (!this.isVacancyInScope(record, session)) {
      throw new Error("Вакансия находится вне доступной области данных");
    }
  }

  filterCandidates(records: HrRecord[]): HrRecord[] {
    const session = this.requirePermission("recruitment.view");
    return records.filter((record) => this.isCandidateInScope(record, session));
  }

  assertCanViewCandidate(record: HrRecord): void {
    const session = this.requirePermission("recruitment.view");
    if (!this.isCandidateInScope(record, session)) {
      throw new Error("Кандидат находится вне доступной области данных");
    }
  }

  assertCanManageCandidate(record: HrRecord): void {
    const session = this.requirePermission("recruitment.manage");
    if (!this.isCandidateInScope(record, session)) {
      throw new Error("Кандидат находится вне доступной области данных");
    }
  }

  dashboard(): HrDashboardStats {
    const session = this.requirePermission("dashboard.view");
    if (session.scopeType === "global") {
      return this.globalDashboard();
    }

    const employeeIds = this.getAllowedEmployeeIds(session);
    const departmentIds = this.getAllowedDepartmentIds(session);
    const currentMonth = new Date().toISOString().slice(0, 7);

    return {
      employeesTotal: employeeIds.length,
      departmentsTotal: departmentIds.length,
      positionsTotal: this.countIn("positions", "department_id", departmentIds),
      activeVacations: this.countWithEmployeeIds(
        `SELECT COUNT(*) FROM vacations
         WHERE status IN ('planned', 'approved')`,
        employeeIds,
      ),
      payrollMonthTotal: this.sumPayroll(employeeIds, currentMonth),
    };
  }

  private requireViewPermission(
    entity: HrEntityKey,
    record?: HrRecord,
  ): AuthSession {
    const session = this.authenticationService.requireSession();
    const regularPermission = entityPermissions[entity].view;
    const canUseProfilePermission =
      ["employees", "employee_education", "employee_experience", "employment_history"].includes(
        entity,
      ) &&
      session.permissionCodes.includes("profile.view") &&
      (!record || this.resolveEmployeeId(entity, record) === session.employeeId);

    if (
      !session.permissionCodes.includes(regularPermission) &&
      !canUseProfilePermission
    ) {
      throw new Error("Недостаточно прав для просмотра данных");
    }
    return session;
  }

  private requireManagePermission(entity: HrEntityKey): AuthSession {
    return this.requirePermission(entityPermissions[entity].manage);
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
      return {
        column: "department_id",
        values: this.getAllowedDepartmentIds(session),
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
        enterpriseId: this.getEnterpriseIdForDepartment(departmentId),
      };
    }

    if (
      ["employee_education", "employee_experience", "employment_history", "vacations", "payroll"].includes(
        entity,
      )
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
                department.enterprise_id AS enterpriseId
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

  private getAllowedEmployeeIds(session: AuthSession): number[] {
    if (session.scopeType === "self") return [session.employeeId];
    const departmentIds = this.getAllowedDepartmentIds(session);
    if (departmentIds.length === 0) return [];
    const placeholders = departmentIds.map(() => "?").join(", ");
    return (
      this.database
        .prepare(
          `SELECT id FROM employees WHERE department_id IN (${placeholders})`,
        )
        .all(...departmentIds) as Array<{ id: number }>
    ).map((row) => row.id);
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
    const currentMonth = new Date().toISOString().slice(0, 7);
    return {
      employeesTotal: this.scalar("SELECT COUNT(*) FROM employees"),
      departmentsTotal: this.scalar("SELECT COUNT(*) FROM departments"),
      positionsTotal: this.scalar("SELECT COUNT(*) FROM positions"),
      activeVacations: this.scalar(
        "SELECT COUNT(*) FROM vacations WHERE status IN ('planned', 'approved')",
      ),
      payrollMonthTotal: this.scalar(
        "SELECT COALESCE(SUM(net_amount), 0) FROM payroll WHERE accrual_month = ?",
        [currentMonth],
      ),
    };
  }

  private countIn(table: string, column: string, ids: number[]): number {
    if (ids.length === 0) return 0;
    const placeholders = ids.map(() => "?").join(", ");
    return this.scalar(
      `SELECT COUNT(*) FROM ${table} WHERE ${column} IN (${placeholders})`,
      ids,
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

  private sumPayroll(employeeIds: number[], currentMonth: string): number {
    if (employeeIds.length === 0) return 0;
    const placeholders = employeeIds.map(() => "?").join(", ");
    return this.scalar(
      `SELECT COALESCE(SUM(net_amount), 0)
       FROM payroll
       WHERE accrual_month = ?
         AND employee_id IN (${placeholders})`,
      [currentMonth, ...employeeIds],
    );
  }

  private scalar(sql: string, params: unknown[] = []): number {
    return Number(this.database.prepare(sql).pluck().get(...params) ?? 0);
  }
}

function intersectFilter(
  existing: HrListParams["filters"] extends Record<string, infer Value>
    ? Value | undefined
    : never,
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
  return { operator: "in", value: intersection.length > 0 ? intersection : [-1] };
}

function compactIds(values: Array<number | null>): number[] {
  return values.filter((value): value is number => Boolean(value && value > 0));
}

function toPositiveNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}
