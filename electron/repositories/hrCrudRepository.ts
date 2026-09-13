import type Database from "better-sqlite3";
import type {
  EmployeeDuplicateCheckParams,
  EmployeeDuplicateCheckResult,
  EmployeeDuplicateFieldMatch,
  HrDashboardStats,
  HrFilterCondition,
  HrEmploymentChangeParams,
  HrHireDateCorrectionParams,
  HrListParams,
  HrListResult,
  HrRecord,
  HrRehireParams,
  HrTerminationParams,
} from "../../src/shared/types/hr";
import type { HrCrudEntityConfig } from "../admin/hrCrudEntities";

interface SqlWhereResult {
  sql: string;
  params: Record<string, unknown>;
}

type HrFilterInput = NonNullable<HrListParams["filters"]>[string];
type ArchivableOrganizationEntity = "enterprises" | "departments" | "positions";

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

  checkEmployeeDuplicates(
    params: EmployeeDuplicateCheckParams,
    scope: { enterpriseId?: number | null; departmentId?: number | null } = {},
    options: { excludeEmployeeId?: number | null } = {},
  ): EmployeeDuplicateCheckResult {
    const employeeNumber = normalizeDuplicateText(params.employeeNumber);
    const lastName = normalizeDuplicateText(params.lastName);
    const firstName = normalizeDuplicateText(params.firstName);
    const middleName = normalizeDuplicateText(params.middleName);
    const birthDate = normalizeDuplicateText(params.birthDate);
    const phone = normalizePhoneComparable(params.phone);
    const email = normalizeDuplicateText(params.email);
    const contractNumber = normalizeDuplicateText(params.contractNumber);
    const effectiveEnterpriseId = scope.enterpriseId ?? params.enterpriseId ?? null;
    const effectiveDepartmentId = scope.departmentId ?? null;

    const hasIdentity = Boolean(lastName && firstName);
    if (
      !employeeNumber &&
      !hasIdentity &&
      !phone &&
      !email &&
      !contractNumber
    ) {
      return { matches: [], hasBlockingMatches: false };
    }

    const scopeConditions: string[] = [];
    const queryParams: Record<string, unknown> = {};
    if (effectiveEnterpriseId) {
      scopeConditions.push("employees.enterprise_id = @scopeEnterpriseId");
      queryParams.scopeEnterpriseId = effectiveEnterpriseId;
    }
    if (effectiveDepartmentId) {
      scopeConditions.push("employees.department_id = @scopeDepartmentId");
      queryParams.scopeDepartmentId = effectiveDepartmentId;
    }

    const matchConditions: string[] = [];
    if (employeeNumber && effectiveEnterpriseId) {
      matchConditions.push(
        "LOWER(TRIM(COALESCE(employees.employee_number, ''))) = @employeeNumber",
      );
      queryParams.employeeNumber = employeeNumber;
    }
    if (hasIdentity) {
      const identityParts = [
        "LOWER(TRIM(COALESCE(employees.last_name, ''))) = @lastName",
        "LOWER(TRIM(COALESCE(employees.first_name, ''))) = @firstName",
      ];
      queryParams.lastName = lastName;
      queryParams.firstName = firstName;
      if (middleName) {
        identityParts.push(
          "LOWER(TRIM(COALESCE(employees.middle_name, ''))) = @middleName",
        );
        queryParams.middleName = middleName;
      }
      if (birthDate) {
        identityParts.push(
          "TRIM(COALESCE(employees.birth_date, '')) = @birthDate",
        );
        queryParams.birthDate = birthDate;
      }
      matchConditions.push(`(${identityParts.join(" AND ")})`);
    }
    if (phone) {
      matchConditions.push(
        `${phoneComparableSql("employees.phone")} = @phone`,
      );
      queryParams.phone = phone;
    }
    if (email) {
      matchConditions.push(
        "LOWER(TRIM(COALESCE(employees.email, ''))) = @email",
      );
      queryParams.email = email;
    }
    if (contractNumber && effectiveEnterpriseId) {
      matchConditions.push(
        "LOWER(TRIM(COALESCE(employees.contract_number, ''))) = @contractNumber",
      );
      queryParams.contractNumber = contractNumber;
    }

    if (matchConditions.length === 0) {
      return { matches: [], hasBlockingMatches: false };
    }

    const where = [
      ...scopeConditions,
      options.excludeEmployeeId
        ? "employees.id <> @excludeEmployeeId"
        : "",
      `(${matchConditions.join(" OR ")})`,
    ].filter(Boolean);
    if (options.excludeEmployeeId) {
      queryParams.excludeEmployeeId = options.excludeEmployeeId;
    }

    const rows = this.database
      .prepare(
        `SELECT
           employees.id,
           employees.enterprise_id,
           employees.employee_number,
           employees.last_name,
           employees.first_name,
           employees.middle_name,
           employees.birth_date,
           employees.phone,
           employees.email,
           employees.contract_number,
           employees.lifecycle_status,
           enterprise.name AS enterprise_name,
           department.name AS department_name
         FROM employees
         LEFT JOIN enterprises AS enterprise
           ON enterprise.id = employees.enterprise_id
         LEFT JOIN departments AS department
           ON department.id = employees.department_id
         WHERE ${where.join(" AND ")}
         ORDER BY
           CASE WHEN employees.lifecycle_status = 'active' THEN 0 ELSE 1 END,
           employees.last_name,
           employees.first_name,
           employees.id
         LIMIT 25`,
      )
      .all(queryParams) as Array<Record<string, unknown>>;

    const matches = rows
      .map((row) => {
        const fields: EmployeeDuplicateFieldMatch[] = [];
        const rowEmployeeNumber = normalizeDuplicateText(row.employee_number);
        const rowLastName = normalizeDuplicateText(row.last_name);
        const rowFirstName = normalizeDuplicateText(row.first_name);
        const rowMiddleName = normalizeDuplicateText(row.middle_name);
        const rowBirthDate = normalizeDuplicateText(row.birth_date);
        const rowPhone = normalizePhoneComparable(row.phone);
        const rowEmail = normalizeDuplicateText(row.email);
        const rowContractNumber = normalizeDuplicateText(row.contract_number);
        const rowEnterpriseId = nullablePositiveNumber(row.enterprise_id);

        if (
          employeeNumber &&
          effectiveEnterpriseId &&
          rowEnterpriseId === effectiveEnterpriseId &&
          rowEmployeeNumber === employeeNumber
        ) {
          fields.push({
            field: "employee_number",
            label: "Табельный номер",
            value: String(row.employee_number ?? ""),
            blocking: true,
          });
        }

        const sameIdentity =
          hasIdentity &&
          rowLastName === lastName &&
          rowFirstName === firstName &&
          (!middleName || rowMiddleName === middleName);
        if (sameIdentity) {
          const identityBlocking = Boolean(
            birthDate && rowBirthDate && rowBirthDate === birthDate,
          );
          if (!birthDate || identityBlocking) {
            fields.push({
              field: "identity",
              label: identityBlocking
                ? "ФИО и дата рождения"
                : "ФИО",
              value: [
                row.last_name,
                row.first_name,
                row.middle_name,
                row.birth_date ? `(${String(row.birth_date)})` : null,
              ]
                .filter(Boolean)
                .join(" "),
              blocking: identityBlocking,
            });
          }
        }

        if (phone && rowPhone && rowPhone === phone) {
          fields.push({
            field: "phone",
            label: "Телефон",
            value: String(row.phone ?? ""),
            blocking: false,
          });
        }

        if (email && rowEmail && rowEmail === email) {
          fields.push({
            field: "email",
            label: "Email",
            value: String(row.email ?? ""),
            blocking: false,
          });
        }

        if (
          contractNumber &&
          effectiveEnterpriseId &&
          rowEnterpriseId === effectiveEnterpriseId &&
          rowContractNumber === contractNumber
        ) {
          fields.push({
            field: "contract_number",
            label: "Номер трудового договора",
            value: String(row.contract_number ?? ""),
            blocking: false,
          });
        }

        if (fields.length === 0) return null;
        const employeeName = [
          row.last_name,
          row.first_name,
          row.middle_name,
        ]
          .filter(Boolean)
          .join(" ")
          .trim();

        return {
          employeeId: Number(row.id),
          employeeName: employeeName || `Сотрудник #${String(row.id)}`,
          employeeNumber: row.employee_number
            ? String(row.employee_number)
            : null,
          enterpriseId: rowEnterpriseId,
          enterpriseName: row.enterprise_name
            ? String(row.enterprise_name)
            : null,
          departmentName: row.department_name
            ? String(row.department_name)
            : null,
          lifecycleStatus: row.lifecycle_status
            ? String(row.lifecycle_status)
            : null,
          blocking: fields.some((field) => field.blocking),
          fields,
        };
      })
      .filter(
        (
          match,
        ): match is NonNullable<typeof match> => Boolean(match),
      );

    return {
      matches,
      hasBlockingMatches: matches.some((match) => match.blocking),
    };
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

  archiveOrDeleteOrganization(entity: ArchivableOrganizationEntity, id: number): void {
    const execute = this.database.transaction(() => {
      const row = this.database
        .prepare(`SELECT id, is_archived FROM ${entity} WHERE id = ? LIMIT 1`)
        .get(id) as { id: number; is_archived: number } | undefined;
      if (!row) throw new Error("Элемент организационной структуры не найден");

      const used = this.isOrganizationEntityUsed(entity, id);
      if (!used) {
        this.database.prepare(`DELETE FROM ${entity} WHERE id = ?`).run(id);
        return;
      }

      const reason = "Архивировано вместо удаления: объект используется в кадровой истории";
      this.database
        .prepare(
          `UPDATE ${entity}
           SET is_archived = 1,
               archived_at = COALESCE(archived_at, CURRENT_TIMESTAMP),
               archive_reason = COALESCE(NULLIF(TRIM(archive_reason), ''), @reason),
               updated_at = CURRENT_TIMESTAMP
           WHERE id = @id`,
        )
        .run({ id, reason });

      if (entity === "enterprises") {
        this.database
          .prepare(
            `UPDATE departments
             SET is_archived = 1,
                 archived_at = COALESCE(archived_at, CURRENT_TIMESTAMP),
                 archive_reason = COALESCE(NULLIF(TRIM(archive_reason), ''), @reason),
                 updated_at = CURRENT_TIMESTAMP
             WHERE enterprise_id = @id`,
          )
          .run({ id, reason });
        this.database
          .prepare(
            `UPDATE positions
             SET is_archived = 1,
                 archived_at = COALESCE(archived_at, CURRENT_TIMESTAMP),
                 archive_reason = COALESCE(NULLIF(TRIM(archive_reason), ''), @reason),
                 updated_at = CURRENT_TIMESTAMP
             WHERE department_id IN (SELECT id FROM departments WHERE enterprise_id = @id)`,
          )
          .run({ id, reason });
      }

      if (entity === "departments") {
        this.database
          .prepare(
            `UPDATE positions
             SET is_archived = 1,
                 archived_at = COALESCE(archived_at, CURRENT_TIMESTAMP),
                 archive_reason = COALESCE(NULLIF(TRIM(archive_reason), ''), @reason),
                 updated_at = CURRENT_TIMESTAMP
             WHERE department_id = @id`,
          )
          .run({ id, reason });
      }
    });

    execute();
  }

  changeEmployment(params: HrEmploymentChangeParams): HrRecord {
    const change = this.database.transaction(() => {
      const employee = this.getEmployee(params.employeeId);
      const lifecycleStatus = String(employee.lifecycle_status ?? employee.status ?? "active");
      const isStartingEmployment = lifecycleStatus === "pending_assignment" || lifecycleStatus === "draft";
      if (!isStartingEmployment && lifecycleStatus !== "active") {
        throw new Error("Кадровые изменения недоступны для завершённого трудоустройства");
      }

      const enterprise = this.database
        .prepare("SELECT id, is_archived FROM enterprises WHERE id = ? LIMIT 1")
        .get(params.enterpriseId) as { id: number; is_archived: number } | undefined;
      if (!enterprise) throw new Error("Предприятие не найдено");
      if (enterprise.is_archived) throw new Error("Нельзя назначить сотрудника в архивное предприятие");

      const department = this.database
        .prepare("SELECT id, enterprise_id, is_archived FROM departments WHERE id = ? LIMIT 1")
        .get(params.departmentId) as
        | { id: number; enterprise_id: number | null; is_archived: number }
        | undefined;
      if (!department) throw new Error("Отдел не найден");
      if (department.is_archived) throw new Error("Нельзя назначить сотрудника в архивный отдел");
      if (Number(department.enterprise_id) !== params.enterpriseId) {
        throw new Error("Выбранный отдел не принадлежит указанному предприятию");
      }

      if (params.positionId !== null) {
        const position = this.database
          .prepare("SELECT id, department_id, is_archived FROM positions WHERE id = ? LIMIT 1")
          .get(params.positionId) as
          | { id: number; department_id: number | null; is_archived: number }
          | undefined;
        if (!position) throw new Error("Должность не найдена");
        if (position.is_archived) throw new Error("Нельзя назначить сотрудника на архивную должность");
        if (Number(position.department_id) !== params.departmentId) {
          throw new Error("Выбранная должность не принадлежит указанному отделу");
        }
      }

      const leadership = params.leadershipAssignment;
      if (leadership) {
        this.assertLeadershipAssignmentAvailable(
          params.employeeId,
          leadership.type,
          leadership.targetId,
          params.enterpriseId,
          params.departmentId,
        );
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
      const actualEmploymentChanged =
        currentDepartmentId !== params.departmentId ||
        currentPositionId !== params.positionId ||
        Number(employee.salary ?? 0) !== nextSalary;
      const hasEmploymentChanges = actualEmploymentChanged || isStartingEmployment;
      if (!hasEmploymentChanges && !leadership) {
        throw new Error("Новые условия не отличаются от текущих");
      }

      const leadershipChangeType =
        leadership?.type === "enterprise_director"
          ? "enterprise_director"
          : leadership?.type === "department_head"
            ? "department_leader"
            : null;

      let historyId: number | null = null;
      if (hasEmploymentChanges) {
        this.database
          .prepare(
            `UPDATE employees
             SET enterprise_id = @enterpriseId,
                 department_id = @departmentId,
                 position_id = @positionId,
                 salary = @salary,
                 status = CASE WHEN @isStarting = 1 THEN 'active' ELSE status END,
                 lifecycle_status = CASE WHEN @isStarting = 1 THEN 'active' ELSE lifecycle_status END,
                 employment_started_at = CASE
                   WHEN @isStarting = 1 THEN @effectiveAt
                   ELSE employment_started_at
                 END,
                 hire_date = CASE WHEN @isStarting = 1 THEN @effectiveAt ELSE hire_date END,
                 terminated_at = CASE WHEN @isStarting = 1 THEN NULL ELSE terminated_at END,
                 termination_reason = CASE WHEN @isStarting = 1 THEN NULL ELSE termination_reason END,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = @employeeId`,
          )
          .run({
            departmentId: params.departmentId,
            effectiveAt: params.effectiveAt,
            employeeId: params.employeeId,
            enterpriseId: params.enterpriseId,
            isStarting: isStartingEmployment ? 1 : 0,
            positionId: params.positionId,
            salary: nextSalary,
          });

        if (actualEmploymentChanged) {
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
        } else if (isStartingEmployment) {
          const insertedHistory = this.database
            .prepare(
              `INSERT INTO employment_history (
                 employee_id, change_type,
                 previous_department_id, new_department_id,
                 previous_position_id, new_position_id,
                 previous_salary, new_salary,
                 effective_at, reason
               ) VALUES (?, 'hired', ?, ?, ?, ?, ?, ?, ?, ?)`,
            )
            .run(
              params.employeeId,
              employee.department_id ?? null,
              params.departmentId,
              employee.position_id ?? null,
              params.positionId,
              Number(employee.salary ?? 0),
              nextSalary,
              params.effectiveAt,
              params.reason.trim(),
            );
          historyId = Number(insertedHistory.lastInsertRowid);
        }
      } else if (leadershipChangeType) {
        const insertedHistory = this.database
          .prepare(
            `INSERT INTO employment_history (
               employee_id, change_type,
               previous_department_id, new_department_id,
               previous_position_id, new_position_id,
               previous_salary, new_salary,
               effective_at, reason
             ) VALUES (
               @employeeId, @changeType,
               @departmentId, @departmentId,
               @positionId, @positionId,
               @salary, @salary,
               @effectiveAt, @reason
             )`,
          )
          .run({
            changeType: leadershipChangeType,
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
                 change_type = @changeType
             WHERE id = @id`,
          )
          .run({
            changeType: isStartingEmployment
              ? "hired"
              : (leadershipChangeType ?? "employment_change"),
            effectiveAt: params.effectiveAt,
            id: historyId,
            reason: params.reason.trim(),
          });
      }

      if (leadership?.type === "enterprise_director") {
        this.database
          .prepare(
            `UPDATE enterprises
             SET general_director_employee_id = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
          )
          .run(params.employeeId, leadership.targetId);
      }

      if (leadership?.type === "department_head") {
        this.database
          .prepare(
            `UPDATE departments
             SET director_employee_id = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
          )
          .run(params.employeeId, leadership.targetId);
      }

      return this.getEmployee(params.employeeId);
    });

    return change();
  }

  rehireEmployee(params: HrRehireParams): HrRecord {
    const rehire = this.database.transaction(() => {
      const employee = this.getEmployee(params.employeeId);
      const lifecycleStatus = String(
        employee.lifecycle_status ?? employee.status ?? "",
      );
      if (lifecycleStatus !== "terminated") {
        throw new Error("Повторно принять можно только уволенного сотрудника");
      }

      const enterprise = this.database
        .prepare(
          "SELECT id, is_archived FROM enterprises WHERE id = ? LIMIT 1",
        )
        .get(params.enterpriseId) as
        | { id: number; is_archived: number }
        | undefined;
      if (!enterprise) throw new Error("Предприятие не найдено");
      if (enterprise.is_archived) {
        throw new Error("Нельзя принять сотрудника в архивное предприятие");
      }

      const department = this.database
        .prepare(
          "SELECT id, enterprise_id, is_archived FROM departments WHERE id = ? LIMIT 1",
        )
        .get(params.departmentId) as
        | { id: number; enterprise_id: number | null; is_archived: number }
        | undefined;
      if (!department) throw new Error("Отдел не найден");
      if (department.is_archived) {
        throw new Error("Нельзя принять сотрудника в архивный отдел");
      }
      if (Number(department.enterprise_id) !== params.enterpriseId) {
        throw new Error(
          "Выбранный отдел не принадлежит указанному предприятию",
        );
      }

      const position = this.database
        .prepare(
          "SELECT id, department_id, is_archived FROM positions WHERE id = ? LIMIT 1",
        )
        .get(params.positionId) as
        | { id: number; department_id: number | null; is_archived: number }
        | undefined;
      if (!position) throw new Error("Должность не найдена");
      if (position.is_archived) {
        throw new Error("Нельзя принять сотрудника на архивную должность");
      }
      if (Number(position.department_id) !== params.departmentId) {
        throw new Error(
          "Выбранная должность не принадлежит указанному отделу",
        );
      }

      this.assertLifecycleDate(
        params.employeeId,
        params.effectiveAt,
        employee,
      );
      if (!Number.isFinite(params.salary) || params.salary < 0) {
        throw new Error("Оклад указан неверно");
      }

      const currentDepartmentId = nullablePositiveNumber(
        employee.department_id,
      );
      const currentPositionId = nullablePositiveNumber(employee.position_id);
      const currentSalary = Number(employee.salary ?? 0);
      const generatedByTrigger =
        currentDepartmentId !== params.departmentId ||
        currentPositionId !== params.positionId ||
        currentSalary !== params.salary;

      this.database
        .prepare(
          `UPDATE employees
           SET enterprise_id = @enterpriseId,
               department_id = @departmentId,
               position_id = @positionId,
               employee_number = @employeeNumber,
               salary = @salary,
               employment_type = @employmentType,
               contract_number = @contractNumber,
               contract_date = @contractDate,
               contract_end_date = @contractEndDate,
               probation_end_date = @probationEndDate,
               workplace = @workplace,
               hire_date = @effectiveAt,
               employment_started_at = @effectiveAt,
               status = 'active',
               lifecycle_status = 'active',
               terminated_at = NULL,
               termination_reason = NULL,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = @employeeId`,
        )
        .run({
          contractDate: nullableString(params.contractDate),
          contractEndDate: nullableString(params.contractEndDate),
          contractNumber: nullableString(params.contractNumber),
          departmentId: params.departmentId,
          effectiveAt: params.effectiveAt,
          employeeId: params.employeeId,
          employeeNumber:
            nullableString(params.employeeNumber) ??
            nullableString(employee.employee_number),
          employmentType:
            nullableString(params.employmentType) ??
            nullableString(employee.employment_type) ??
            "full_time",
          enterpriseId: params.enterpriseId,
          positionId: params.positionId,
          probationEndDate: nullableString(params.probationEndDate),
          salary: params.salary,
          workplace: nullableString(params.workplace),
        });

      if (generatedByTrigger) {
        const generatedHistory = this.database
          .prepare(
            `SELECT id FROM employment_history
             WHERE employee_id = ?
             ORDER BY id DESC LIMIT 1`,
          )
          .get(params.employeeId) as { id: number } | undefined;
        if (!generatedHistory) {
          throw new Error(
            "Не удалось создать запись о повторном приёме",
          );
        }
        this.database
          .prepare(
            `UPDATE employment_history
             SET change_type = 'rehired',
                 effective_at = @effectiveAt,
                 reason = @reason
             WHERE id = @historyId`,
          )
          .run({
            effectiveAt: params.effectiveAt,
            historyId: generatedHistory.id,
            reason: params.reason.trim(),
          });
      } else {
        this.database
          .prepare(
            `INSERT INTO employment_history (
               employee_id, change_type,
               previous_department_id, new_department_id,
               previous_position_id, new_position_id,
               previous_salary, new_salary,
               effective_at, reason
             ) VALUES (?, 'rehired', ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            params.employeeId,
            currentDepartmentId,
            params.departmentId,
            currentPositionId,
            params.positionId,
            currentSalary,
            params.salary,
            params.effectiveAt,
            params.reason.trim(),
          );
      }

      return this.getEmployee(params.employeeId);
    });

    return rehire();
  }

  terminateEmployee(params: HrTerminationParams): HrRecord {
    const terminate = this.database.transaction(() => {
      const employee = this.getEmployee(params.employeeId);
      if (String(employee.lifecycle_status ?? employee.status) !== "active") {
        throw new Error("Уволить можно только активного сотрудника");
      }
      this.assertLifecycleDate(params.employeeId, params.effectiveAt, employee);

      this.database
        .prepare(
          `UPDATE employees
           SET status = 'terminated',
               lifecycle_status = 'terminated',
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
      if (String(employee.lifecycle_status ?? employee.status) === "pending_assignment") {
        throw new Error("Дата приёма появится после первого кадрового назначения");
      }
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
           SET hire_date = ?, employment_started_at = ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
        )
        .run(params.hireDate, params.hireDate, params.employeeId);

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
      employeesTotal: this.getNumber("SELECT COUNT(*) FROM employees WHERE lifecycle_status <> 'terminated'"),
      departmentsTotal: this.getNumber("SELECT COUNT(*) FROM departments WHERE is_archived = 0"),
      positionsTotal: this.getNumber("SELECT COUNT(*) FROM positions WHERE is_archived = 0"),
      activeVacations: this.getNumber(
        "SELECT COUNT(*) FROM vacations WHERE status IN ('planned', 'approved')",
      ),
      upcomingVacations: this.getNumber(
        `SELECT COUNT(*) FROM vacations
         WHERE status IN ('planned', 'approved')
           AND starts_at >= DATE('now')
           AND starts_at <= DATE('now', '+30 day')`,
      ),
      openVacancies: this.getNumber("SELECT COUNT(*) FROM vacancies WHERE status = 'open' AND is_archived = 0"),
      candidatesOnOffer: this.getNumber("SELECT COUNT(*) FROM candidates WHERE status = 'offer'"),
      blockedUsers: this.getNumber("SELECT COUNT(*) FROM users WHERE status = 'blocked'"),
      employeesMissingAssignment: this.getNumber(
        "SELECT COUNT(*) FROM employees WHERE lifecycle_status = 'pending_assignment' OR department_id IS NULL OR position_id IS NULL",
      ),
      emailConflicts: this.getNumber("SELECT COUNT(*) FROM email_conflicts"),
    };
  }

  private isOrganizationEntityUsed(entity: ArchivableOrganizationEntity, id: number): boolean {
    if (entity === "enterprises") {
      return this.getNumber(
        `SELECT CASE WHEN
           EXISTS (SELECT 1 FROM departments WHERE enterprise_id = ?)
           OR EXISTS (SELECT 1 FROM employees WHERE enterprise_id = ?)
           OR EXISTS (SELECT 1 FROM vacation_types WHERE enterprise_id = ?)
           OR EXISTS (SELECT 1 FROM roles WHERE enterprise_id = ?)
           OR EXISTS (SELECT 1 FROM leadership_history WHERE target_type = 'enterprise' AND target_id = ?)
         THEN 1 ELSE 0 END`,
        [id, id, id, id, id],
      ) === 1;
    }
    if (entity === "departments") {
      return this.getNumber(
        `SELECT CASE WHEN
           EXISTS (SELECT 1 FROM positions WHERE department_id = ?)
           OR EXISTS (SELECT 1 FROM employees WHERE department_id = ?)
           OR EXISTS (SELECT 1 FROM employment_history WHERE previous_department_id = ? OR new_department_id = ?)
           OR EXISTS (SELECT 1 FROM roles WHERE department_id = ?)
           OR EXISTS (SELECT 1 FROM leadership_history WHERE target_type = 'department' AND target_id = ?)
         THEN 1 ELSE 0 END`,
        [id, id, id, id, id, id],
      ) === 1;
    }
    return this.getNumber(
      `SELECT CASE WHEN
         EXISTS (SELECT 1 FROM employees WHERE position_id = ?)
         OR EXISTS (SELECT 1 FROM employment_history WHERE previous_position_id = ? OR new_position_id = ?)
         OR EXISTS (SELECT 1 FROM vacancies WHERE position_id = ?)
       THEN 1 ELSE 0 END`,
      [id, id, id, id],
    ) === 1;
  }

  private getEmployee(employeeId: number): HrRecord {
    const employee = this.database
      .prepare("SELECT * FROM employees WHERE id = ? LIMIT 1")
      .get(employeeId) as HrRecord | undefined;
    if (!employee) throw new Error("Сотрудник не найден");
    return employee;
  }

  private assertLeadershipAssignmentAvailable(
    employeeId: number,
    type: "enterprise_director" | "department_head",
    targetId: number,
    enterpriseId: number,
    departmentId: number,
  ): void {
    if (type === "enterprise_director" && targetId !== enterpriseId) {
      throw new Error("Предприятие назначения не совпадает с кадровым переводом");
    }
    if (type === "department_head" && targetId !== departmentId) {
      throw new Error("Отдел назначения не совпадает с кадровым переводом");
    }

    const enterpriseLeadership = this.database
      .prepare(
        "SELECT id FROM enterprises WHERE general_director_employee_id = ? LIMIT 1",
      )
      .get(employeeId) as { id: number } | undefined;
    const departmentLeadership = this.database
      .prepare(
        "SELECT id FROM departments WHERE director_employee_id = ? LIMIT 1",
      )
      .get(employeeId) as { id: number } | undefined;

    if (
      enterpriseLeadership &&
      (type !== "enterprise_director" || enterpriseLeadership.id !== targetId)
    ) {
      throw new Error(
        "Сотрудник уже является руководителем другого предприятия. Сначала снимите текущее назначение",
      );
    }
    if (
      departmentLeadership &&
      (type !== "department_head" || departmentLeadership.id !== targetId)
    ) {
      throw new Error(
        "Сотрудник уже является руководителем другого отдела. Сначала снимите текущее назначение",
      );
    }
    if (type === "enterprise_director" && departmentLeadership) {
      throw new Error(
        "Сотрудник уже является руководителем отдела. Сначала снимите текущее назначение",
      );
    }
    if (type === "department_head" && enterpriseLeadership) {
      throw new Error(
        "Сотрудник уже является руководителем предприятия. Сначала снимите текущее назначение",
      );
    }
  }

  private assertLifecycleDate(
    employeeId: number,
    effectiveAt: string,
    employee: HrRecord,
  ): void {
    const lifecycleStatus = String(employee.lifecycle_status ?? employee.status ?? "active");
    const employmentStart = String(employee.employment_started_at ?? employee.hire_date ?? "");
    if (lifecycleStatus === "active" && employmentStart && effectiveAt < employmentStart) {
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
          !config.filterableColumns.includes(column) ||
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

function nullableString(value: unknown): string | null {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function normalizeDuplicateText(value: unknown): string {
  return String(value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizePhoneComparable(value: unknown): string {
  return String(value ?? "").replace(/\D/g, "");
}

function phoneComparableSql(column: string): string {
  return `REPLACE(
    REPLACE(
      REPLACE(
        REPLACE(
          REPLACE(
            REPLACE(TRIM(COALESCE(${column}, '')), ' ', ''),
            '-', ''
          ),
          '(', ''
        ),
        ')', ''
      ),
      '+', ''
    ),
    '.', ''
  )`;
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
