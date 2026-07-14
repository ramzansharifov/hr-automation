import type Database from "better-sqlite3";
import type {
  HrDashboardStats,
  HrFilterCondition,
  HrEmploymentChangeParams,
  HrListParams,
  HrListResult,
  HrRecord,
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
        `
        SELECT ${config.tableName}.*${computedSelect ? `,\n          ${computedSelect}` : ""}
        FROM ${config.tableName}
        ${where.sql}
        ORDER BY ${orderBy} ${orderDirection}
        LIMIT @limit OFFSET @offset
      `,
      )
      .all({
        ...where.params,
        limit: pageSize,
        offset,
      }) as HrRecord[];

    const countResult = this.database
      .prepare(
        `
        SELECT COUNT(*) as total
        FROM ${config.tableName}
        ${where.sql}
      `,
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
    const row = this.database
      .prepare(
        `
        SELECT *
        FROM ${config.tableName}
        WHERE ${config.primaryKey} = ?
        LIMIT 1
      `,
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
        `
        INSERT INTO ${config.tableName} (${columns.join(", ")})
        VALUES (${placeholders.join(", ")})
      `,
      )
      .run(safeData);

    const created = this.getById(config, Number(result.lastInsertRowid));

    if (!created) {
      throw new Error("Созданная запись не найдена");
    }

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

    if (config.hasUpdatedAt) {
      setParts.push("updated_at = CURRENT_TIMESTAMP");
    }

    this.database
      .prepare(
        `
        UPDATE ${config.tableName}
        SET ${setParts.join(", ")}
        WHERE ${config.primaryKey} = @id
      `,
      )
      .run({
        ...safeData,
        id,
      });

    const updated = this.getById(config, id);

    if (!updated) {
      throw new Error("Обновлённая запись не найдена");
    }

    return updated;
  }

  delete(config: HrCrudEntityConfig, id: number): void {
    this.database
      .prepare(
        `
        DELETE FROM ${config.tableName}
        WHERE ${config.primaryKey} = ?
      `,
      )
      .run(id);
  }

  changeEmployment(params: HrEmploymentChangeParams): HrRecord {
    const change = this.database.transaction(() => {
      const employee = this.database
        .prepare("SELECT * FROM employees WHERE id = ? LIMIT 1")
        .get(params.employeeId) as HrRecord | undefined;

      if (!employee) {
        throw new Error("Сотрудник не найден");
      }

      if (employee.status !== "active") {
        throw new Error(
          "Кадровые изменения доступны только активным сотрудникам",
        );
      }

      const position = this.database
        .prepare("SELECT * FROM positions WHERE id = ? LIMIT 1")
        .get(params.positionId) as HrRecord | undefined;

      if (!position) {
        throw new Error("Должность не найдена");
      }

      if (Number(position.department_id) !== params.departmentId) {
        throw new Error("Выбранная должность не принадлежит указанному отделу");
      }

      const latestHistory = this.database
        .prepare(
          `SELECT effective_at FROM employment_history
           WHERE employee_id = ? ORDER BY effective_at DESC, id DESC LIMIT 1`,
        )
        .get(params.employeeId) as { effective_at?: string } | undefined;

      const hireDate = String(employee.hire_date ?? "");
      if (params.effectiveAt < hireDate) {
        throw new Error("Дата изменения не может быть раньше даты приёма");
      }

      if (
        latestHistory?.effective_at &&
        params.effectiveAt < latestHistory.effective_at
      ) {
        throw new Error(
          "Дата изменения не может быть раньше последней записи журнала",
        );
      }

      const nextSalary =
        params.salaryMode === "keep"
          ? Number(employee.salary ?? 0)
          : params.salaryMode === "position"
            ? Number(position.base_salary ?? 0)
            : Number(params.salary);

      if (!Number.isFinite(nextSalary) || nextSalary < 0) {
        throw new Error("Заработная плата указана неверно");
      }

      const hasChanges =
        Number(employee.department_id) !== params.departmentId ||
        Number(employee.position_id) !== params.positionId ||
        Number(employee.salary ?? 0) !== nextSalary;

      if (!hasChanges) {
        throw new Error("Новые условия не отличаются от текущих");
      }

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

      this.database
        .prepare(
          `UPDATE employment_history
           SET effective_at = @effectiveAt, reason = @reason, note = @note
           WHERE id = @id`,
        )
        .run({
          effectiveAt: params.effectiveAt,
          id: generatedHistory.id,
          note: params.note?.trim() || null,
          reason: params.reason.trim(),
        });

      return this.database
        .prepare("SELECT * FROM employees WHERE id = ? LIMIT 1")
        .get(params.employeeId) as HrRecord;
    });

    return change();
  }

  dashboard(): HrDashboardStats {
    const currentMonth = new Date().toISOString().slice(0, 7);

    const employeesTotal = this.getNumber("SELECT COUNT(*) FROM employees");
    const departmentsTotal = this.getNumber("SELECT COUNT(*) FROM departments");
    const positionsTotal = this.getNumber("SELECT COUNT(*) FROM positions");
    const activeVacations = this.getNumber(`
      SELECT COUNT(*)
      FROM vacations
      WHERE status IN ('planned', 'approved')
    `);

    const payrollMonthTotal = this.getNumber(
      `
      SELECT COALESCE(SUM(net_amount), 0)
      FROM payroll
      WHERE accrual_month = ?
    `,
      [currentMonth],
    );

    return {
      employeesTotal,
      departmentsTotal,
      positionsTotal,
      activeVacations,
      payrollMonthTotal,
    };
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
        const value = condition.value;

        if (value === undefined || value === null || value === "") {
          return;
        }

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
      if (ignoredColumns.has(key)) {
        return;
      }

      if (!config.allowedColumns.includes(key)) {
        return;
      }

      result[key] = value;
    });

    return result;
  }

  private getNumber(sql: string, params: unknown[] = []): number {
    const result = this.database
      .prepare(sql)
      .pluck()
      .get(...params) as number | null | undefined;

    return Number(result ?? 0);
  }
}

function normalizeFilterCondition(filter: HrFilterInput): HrFilterCondition {
  if (isFilterCondition(filter)) {
    return filter;
  }

  return {
    operator: Array.isArray(filter) ? "in" : "equals",
    value: filter,
  };
}

function isFilterCondition(filter: HrFilterInput): filter is HrFilterCondition {
  if (!filter || typeof filter !== "object" || Array.isArray(filter)) {
    return false;
  }

  return "operator" in filter && "value" in filter;
}

function normalizePage(page?: number): number {
  if (!page || page < 1) {
    return 1;
  }

  return Math.floor(page);
}

function normalizePageSize(pageSize?: number): number {
  if (!pageSize || pageSize < 1) {
    return 20;
  }

  return Math.min(Math.floor(pageSize), maxHrPageSize);
}
