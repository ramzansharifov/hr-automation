import type Database from "better-sqlite3";
import type {
  HrDashboardStats,
  HrFilterCondition,
  HrEmploymentChangeParams,
  HrHireDateCorrectionParams,
  HrListParams,
  HrListResult,
  HrRecord,
  HrTerminationParams,
} from "../../src/shared/types/hr";
import type { HrCrudEntityConfig } from "../admin/hrCrudEntities";

interface SqlWhereResult {
  sql: string;
  params: Record<string, unknown>;
}

type HrFilterInput = NonNullable<HrListParams["filters"]>[string];

const maxHrPageSize = 100;

export class HrCrudRepository {
  constructor(private readonly database: Database.Database) {}

  list(config: HrCrudEntityConfig, params: HrListParams): HrListResult {
    const page = normalizePage(params.page);
    const pageSize = normalizePageSize(params.pageSize);
    const offset = (page - 1) * pageSize;
    const where = this.buildWhere(config, params);
    const orderBy = this.normalizeOrderBy(config, params.orderBy);
    const orderDirection = params.orderDirection === "desc" ? "DESC" : "ASC";
    const listColumnEntries = Object.entries(config.listColumns);
    const computedSelect = listColumnEntries
      .map(([alias, expression]) => `${expression} AS ${alias}`)
      .join(",\n          ");

    const items = this.database
      .prepare(
        `SELECT ${config.tableName}.*${computedSelect ? `,\n          ${computedSelect}` : ""}
         FROM ${config.tableName}
         ${where.sql}
         ORDER BY ${orderBy} ${orderDirection}
         LIMIT @limit OFFSET @offset`,
      )
      .all({ ...where.params, limit: pageSize, offset }) as HrRecord[];

    const countResult = this.database
      .prepare(
        `SELECT COUNT(*) as total
         FROM ${config.tableName}
         ${where.sql}`,
      )
      .get(where.params) as { total: number };

    return {
      items,
      total: countResult.total,
      page,
      pageSize,
      totalPages: Math.ceil(countResult.total / pageSize),
    };
  }

  getById(config: HrCrudEntityConfig, id: number): HrRecord | null {
    const listColumnEntries = Object.entries(config.listColumns);
    const computedSelect = listColumnEntries
      .map(([alias, expression]) => `${expression} AS ${alias}`)
      .join(",\n          ");
    const row = this.database
      .prepare(
        `SELECT ${config.tableName}.*${computedSelect ? `,\n          ${computedSelect}` : ""}
         FROM ${config.tableName}
         WHERE ${config.primaryKey} = ?
         LIMIT 1`,
      )
      .get(id) as HrRecord | undefined;

    return row ?? null;
  }

  create(config: HrCrudEntityConfig, data: HrRecord): HrRecord {
    const safeData = this.pickEditableData(config, data);
    if (Object.keys(safeData).length === 0) {
      throw new Error("Нет разрешённых полей для создания записи");
    }

    const columns = Object.keys(safeData);
    const placeholders = columns.map((column) => `@${column}`);
    const result = this.database
      .prepare(
        `INSERT INTO ${config.tableName} (${columns.join(", ")})
         VALUES (${placeholders.join(", ")})`,
      )
      .run(safeData);

    const created = this.getById(config, Number(result.lastInsertRowid));
    if (!created) throw new Error("Созданная запись не найдена");
    return created;
  }

  update(config: HrCrudEntityConfig, id: number, data: HrRecord): HrRecord {
    const safeData = this.pickEditableData(config, data);
    if (Object.keys(safeData).length === 0) {
      throw new Error("Нет разрешённых полей для обновления записи");
    }

    const setParts = Object.keys(safeData).map(
      (column) => `${column} = @${column}`,
    );
    if (config.hasUpdatedAt) setParts.push("updated_at = CURRENT_TIMESTAMP");

    this.database
      .prepare(
        `UPDATE ${config.tableName}
         SET ${setParts.join(", ")}
         WHERE ${config.primaryKey} = @id`,
      )
      .run({ ...safeData, id });

    const updated = this.getById(config, id);
    if (!updated) throw new Error("Обновлённая запись не найдена");
    return updated;
  }

  delete(config: HrCrudEntityConfig, id: number): void {
    this.database
      .prepare(`DELETE FROM ${config.tableName} WHERE ${config.primaryKey} = ?`)
      .run(id);
  }

  changeEmployment(params: HrEmploymentChangeParams): HrRecord {
    const change = this.database.transaction(() => {
      const employee = this.getEmployee(params.employeeId);
      if (employee.status !== "active") {
        throw new Error("Кадровые изменения доступны только активным сотрудникам");
      }

      const enterprise = this.database
        .prepare("SELECT id FROM enterprises WHERE id = ? LIMIT 1")
        .get(params.enterpriseId) as { id: number } | undefined;
      if (!enterprise) throw new Error("Предприятие не найдено");

      const department = this.database
        .prepare("SELECT id, enterprise_id FROM departments WHERE id = ? LIMIT 1")
        .get(params.departmentId) as
        | { id: number; enterprise_id: number | null }
        | undefined;
      if (!department) throw new Error("Отдел не найден");
      if (Number(department.enterprise_id) !== params.enterpriseId) {
        throw new Error("Выбранный отдел не принадлежит указанному предприятию");
      }

      if (params.positionId !== null) {
        const position = this.database
          .prepare("SELECT id, department_id FROM positions WHERE id = ? LIMIT 1")
          .get(params.positionId) as
          | { id: number; department_id: number | null }
          | undefined;
        if (!position) throw new Error("Должность не найдена");
        if (Number(position.department_id) !== params.departmentId) {
          throw new Error("Выбранная должность не принадлежит указанному отделу");
        }
      }

      if (params.assignAsDepartmentLeader) {
        const enterpriseLeadership = this.database
          .prepare(
            "SELECT id FROM enterprises WHERE general_director_employee_id = ? LIMIT 1",
          )
          .get(params.employeeId);
        if (enterpriseLeadership) {
          throw new Error(
            "Сотрудник уже является руководителем предприятия. Сначала снимите текущее назначение",
          );
        }
        const otherDepartmentLeadership = this.database
          .prepare(
            `SELECT id FROM departments
             WHERE director_employee_id = ? AND id <> ? LIMIT 1`,
          )
          .get(params.employeeId, params.departmentId);
        if (otherDepartmentLeadership) {
          throw new Error(
            "Сотрудник уже руководит другим отделом. Сначала снимите текущее назначение",
          );
        }
      }

      this.assertLifecycleDate(params.employeeId, params.effectiveAt, employee);

      const nextSalary =
        params.salaryMode === "keep"
          ? Number(employee.salary ?? 0)
          : Number(params.salary);
      if (!Number.isFinite(nextSalary) || nextSalary < 0) {
        throw new Error("Оклад указан неверно");
      }

      const currentDepartmentId = nullablePositiveNumber(employee.department_id);
      const currentPositionId = nullablePositiveNumber(employee.position_id);
      const hasEmploymentChanges =
        currentDepartmentId !== params.departmentId ||
        currentPositionId !== params.positionId ||
        Number(employee.salary ?? 0) !== nextSalary;
      if (!hasEmploymentChanges && !params.assignAsDepartmentLeader) {
        throw new Error("Новые условия не отличаются от текущих");
      }

      let historyId: number | null = null;
      if (hasEmploymentChanges) {
        this.database
          .prepare(
            `UPDATE employees
             SET department_id = @departmentId,
                 position_id = @positionId,
                 salary = @salary,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = @employeeId`,
          )
          .run({
            departmentId: params.departmentId,
            employeeId: params.employeeId,
            positionId: params.positionId,
            salary: nextSalary,
          });

        const generatedHistory = this.database
          .prepare(
            `SELECT id FROM employment_history
             WHERE employee_id = ? ORDER BY id DESC LIMIT 1`,
          )
          .get(params.employeeId) as { id: number } | undefined;
        if (!generatedHistory) {
          throw new Error("Не удалось создать запись кадрового журнала");
        }
        historyId = generatedHistory.id;
      } else {
        const insertedHistory = this.database
          .prepare(
            `INSERT INTO employment_history (
               employee_id, change_type,
               previous_department_id, new_department_id,
               previous_position_id, new_position_id,
               previous_salary, new_salary,
               effective_at, reason
             ) VALUES (
               @employeeId, 'department_leader',
               @departmentId, @departmentId,
               @positionId, @positionId,
               @salary, @salary,
               @effectiveAt, @reason
             )`,
          )
          .run({
            departmentId: params.departmentId,
            effectiveAt: params.effectiveAt,
            employeeId: params.employeeId,
            positionId: params.positionId,
            reason: params.reason.trim(),
            salary: nextSalary,
          });
        historyId = Number(insertedHistory.lastInsertRowid);
      }

      if (historyId && hasEmploymentChanges) {
        this.database
          .prepare(
            `UPDATE employment_history
             SET effective_at = @effectiveAt,
                 reason = @reason,
                 change_type = CASE
                   WHEN @assignLeader = 1 THEN 'department_leader'
                   ELSE change_type
                 END
             WHERE id = @id`,
          )
          .run({
            assignLeader: params.assignAsDepartmentLeader ? 1 : 0,
            effectiveAt: params.effectiveAt,
            id: historyId,
            reason: params.reason.trim(),
          });
      }

      if (params.assignAsDepartmentLeader) {
        this.database
          .prepare(
            `UPDATE departments
             SET director_employee_id = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
          )
          .run(params.employeeId, params.departmentId);
      }

      return this.getEmployee(params.employeeId);
    });

    return change();
  }

  terminateEmployee(params: HrTerminationParams): HrRecord {
    const terminate = this.database.transaction(() => {
      const employee = this.getEmployee(params.employeeId);
      if (employee.status !== "active") {
        throw new Error("Уволить можно только активного сотрудника");
      }
      this.assertLifecycleDate(params.employeeId, params.effectiveAt, employee);

      this.database
        .prepare(
          `UPDATE employees
           SET status = 'terminated',
               terminated_at = @effectiveAt,
               termination_reason = @reason,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = @employeeId`,
        )
        .run({
          effectiveAt: params.effectiveAt,
          employeeId: params.employeeId,
          reason: params.reason.trim(),
        });

      this.database
        .prepare(
          `INSERT INTO employment_history (
             employee_id, change_type,
             previous_department_id, new_department_id,
             previous_position_id, new_position_id,
             previous_salary, new_salary,
             effective_at, reason
           ) VALUES (?, 'terminated', ?, NULL, ?, NULL, ?, NULL, ?, ?)`,
        )
        .run(
          params.employeeId,
          employee.department_id ?? null,
          employee.position_id ?? null,
          Number(employee.salary ?? 0),
          params.effectiveAt,
          params.reason.trim(),
        );

      return this.getEmployee(params.employeeId);
    });

    return terminate();
  }

  correctHireDate(params: HrHireDateCorrectionParams): HrRecord {
    const correct = this.database.transaction(() => {
      const employee = this.getEmployee(params.employeeId);
      const firstLaterChange = this.database
        .prepare(
          `SELECT effective_at
           FROM employment_history
           WHERE employee_id = ? AND change_type <> 'hired'
           ORDER BY effective_at ASC, id ASC LIMIT 1`,
        )
        .get(params.employeeId) as { effective_at?: string } | undefined;

      if (
        firstLaterChange?.effective_at &&
        params.hireDate > firstLaterChange.effective_at
      ) {
        throw new Error("Дата приёма не может быть позже последующего кадрового события");
      }

      this.database
        .prepare(
          `UPDATE employees
           SET hire_date = ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
        )
        .run(params.hireDate, params.employeeId);

      this.database
        .prepare(
          `UPDATE employment_history
           SET effective_at = ?, reason = ?
           WHERE id = (
             SELECT id FROM employment_history
             WHERE employee_id = ? AND change_type = 'hired'
             ORDER BY id ASC LIMIT 1
           )`,
        )
        .run(
          params.hireDate,
          `Коррекция даты приёма: ${params.reason.trim()}`,
          params.employeeId,
        );

      return { ...employee, ...this.getEmployee(params.employeeId) };
    });

    return correct();
  }

  dashboard(): HrDashboardStats {
    return {
      employeesTotal: this.getNumber("SELECT COUNT(*) FROM employees"),
      departmentsTotal: this.getNumber("SELECT COUNT(*) FROM departments"),
      positionsTotal: this.getNumber("SELECT COUNT(*) FROM positions"),
      activeVacations: this.getNumber(
        "SELECT COUNT(*) FROM vacations WHERE status IN ('planned', 'approved')",
      ),
      upcomingVacations: this.getNumber(
        `SELECT COUNT(*) FROM vacations
         WHERE status IN ('planned', 'approved')
           AND starts_at >= DATE('now')
           AND starts_at <= DATE('now', '+30 day')`,
      ),
      openVacancies: this.getNumber("SELECT COUNT(*) FROM vacancies WHERE status = 'open'"),
      candidatesOnOffer: this.getNumber("SELECT COUNT(*) FROM candidates WHERE status = 'offer'"),
      blockedUsers: this.getNumber("SELECT COUNT(*) FROM users WHERE status = 'blocked'"),
      employeesMissingAssignment: this.getNumber(
        "SELECT COUNT(*) FROM employees WHERE department_id IS NULL OR position_id IS NULL",
      ),
      emailConflicts: this.getNumber("SELECT COUNT(*) FROM email_conflicts"),
    };
  }

  private getEmployee(employeeId: number): HrRecord {
    const employee = this.database
      .prepare("SELECT * FROM employees WHERE id = ? LIMIT 1")
      .get(employeeId) as HrRecord | undefined;
    if (!employee) throw new Error("Сотрудник не найден");
    return employee;
  }

  private assertLifecycleDate(
    employeeId: number,
    effectiveAt: string,
    employee: HrRecord,
  ): void {
    const hireDate = String(employee.hire_date ?? "");
    if (effectiveAt < hireDate) {
      throw new Error("Дата кадрового события не может быть раньше даты приёма");
    }
    const latestHistory = this.database
      .prepare(
        `SELECT effective_at FROM employment_history
         WHERE employee_id = ? ORDER BY effective_at DESC, id DESC LIMIT 1`,
      )
      .get(employeeId) as { effective_at?: string } | undefined;
    if (latestHistory?.effective_at && effectiveAt < latestHistory.effective_at) {
      throw new Error("Дата события не может быть раньше последней записи журнала");
    }
  }

  private buildWhere(
    config: HrCrudEntityConfig,
    params: HrListParams,
  ): SqlWhereResult {
    const conditions: string[] = [];
    const values: Record<string, unknown> = {};

    if (params.search && config.searchableColumns.length > 0) {
      const searchableColumns = [
        ...config.searchableColumns,
        ...Object.values(config.listColumns),
      ];
      const searchConditions = searchableColumns.map((column, index) => {
        const key = `search_${index}`;
        values[key] = `%${params.search}%`;
        return `${column} LIKE @${key}`;
      });
      conditions.push(`(${searchConditions.join(" OR ")})`);
    }

    if (params.filters) {
      Object.entries(params.filters).forEach(([column, filter], index) => {
        if (
          !config.allowedColumns.includes(column) ||
          filter === undefined ||
          filter === null
        ) {
          return;
        }

        const condition = normalizeFilterCondition(filter);
        if (condition.operator === "is_null") {
          conditions.push(`${column} IS NULL`);
          return;
        }

        const value = condition.value;
        if (value === undefined || value === null || value === "") return;

        if (condition.operator === "in") {
          const rawValues = Array.isArray(value) ? value : [value];
          const safeValues = rawValues.filter(
            (item) => item !== null && item !== undefined && item !== "",
          );
          if (safeValues.length === 0) {
            conditions.push("1 = 0");
            return;
          }
          const keys = safeValues.map(
            (_item, itemIndex) => `filter_${index}_${itemIndex}`,
          );
          keys.forEach((key, itemIndex) => {
            values[key] = safeValues[itemIndex];
          });
          conditions.push(
            `${column} IN (${keys.map((key) => `@${key}`).join(", ")})`,
          );
          return;
        }

        const key = `filter_${index}`;
        if (condition.operator === "contains") {
          conditions.push(`${column} LIKE @${key}`);
          values[key] = `%${String(value)}%`;
          return;
        }
        if (condition.operator === "gte") {
          conditions.push(`${column} >= @${key}`);
          values[key] = value;
          return;
        }
        if (condition.operator === "lte") {
          conditions.push(`${column} <= @${key}`);
          values[key] = value;
          return;
        }
        conditions.push(`${column} = @${key}`);
        values[key] = value;
      });
    }

    return {
      sql: conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "",
      params: values,
    };
  }

  private normalizeOrderBy(
    config: HrCrudEntityConfig,
    orderBy?: string,
  ): string {
    if (
      orderBy &&
      (config.allowedColumns.includes(orderBy) || orderBy in config.listColumns)
    ) {
      return orderBy;
    }
    return config.defaultOrderBy;
  }

  private pickEditableData(
    config: HrCrudEntityConfig,
    data: HrRecord,
  ): HrRecord {
    const ignoredColumns = new Set(["id", "created_at", "updated_at"]);
    const result: HrRecord = {};
    Object.entries(data).forEach(([key, value]) => {
      if (ignoredColumns.has(key) || !config.allowedColumns.includes(key)) return;
      result[key] = value;
    });
    return result;
  }

  private getNumber(sql: string, params: unknown[] = []): number {
    const result = this.database.prepare(sql).pluck().get(...params) as
      | number
      | null
      | undefined;
    return Number(result ?? 0);
  }
}

function normalizeFilterCondition(filter: HrFilterInput): HrFilterCondition {
  if (isFilterCondition(filter)) return filter;
  return {
    operator: Array.isArray(filter) ? "in" : "equals",
    value: filter,
  };
}

function isFilterCondition(filter: HrFilterInput): filter is HrFilterCondition {
  if (!filter || typeof filter !== "object" || Array.isArray(filter)) return false;
  return "operator" in filter && "value" in filter;
}

function normalizePage(page?: number): number {
  if (!page || page < 1) return 1;
  return Math.floor(page);
}

function normalizePageSize(pageSize?: number): number {
  if (!pageSize || pageSize < 1) return 20;
  return Math.min(Math.floor(pageSize), maxHrPageSize);
}

function nullablePositiveNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const numberValue = Number(value);
  return Number.isInteger(numberValue) && numberValue > 0 ? numberValue : null;
}
