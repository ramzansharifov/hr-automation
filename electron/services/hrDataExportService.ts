import { dialog } from "electron";
import { writeFileSync } from "node:fs";
import path from "node:path";
import type Database from "better-sqlite3";
import type { AuthSession } from "../../src/shared/types/access";
import type {
  DataExportDomain,
  ExportDataParams,
} from "../../src/shared/types/hr";
import {
  writeCsv,
  writeXlsx,
  type TabularRow,
} from "./tabularFileService";

interface ScopedSql {
  sql: string;
  params: Record<string, unknown>;
}

export class HrDataExportService {
  constructor(private readonly database: Database.Database) {}

  export(
    params: ExportDataParams,
    session: AuthSession,
  ): { success: true; canceled?: boolean } {
    const table = this.buildTable(params.domain, session);
    const extension = params.format === "xlsx" ? "xlsx" : "csv";
    const selected = dialog.showSaveDialogSync({
      title: "Экспорт HR-данных",
      defaultPath: `hr-${params.domain}-${today()}.${extension}`,
      filters: [
        params.format === "xlsx"
          ? { name: "Excel", extensions: ["xlsx"] }
          : { name: "CSV", extensions: ["csv"] },
      ],
    });
    if (!selected) return { success: true, canceled: true };

    const buffer =
      params.format === "xlsx"
        ? writeXlsx(table.headers, table.rows)
        : writeCsv(table.headers, table.rows);
    writeFileSync(selected, buffer);

    this.database
      .prepare(
        `INSERT INTO data_exchange_runs (
           direction, domain, format, file_name,
           total_rows, successful_rows, failed_rows
         ) VALUES ('export', ?, ?, ?, ?, ?, 0)`,
      )
      .run(
        params.domain,
        params.format,
        path.basename(selected),
        table.rows.length,
        table.rows.length,
      );
    return { success: true };
  }

  private buildTable(
    domain: DataExportDomain,
    session: AuthSession,
  ): { headers: string[]; rows: TabularRow[] } {
    const employeeScope = this.employeeScope(session, "employee");

    if (domain === "employees") {
      const headers = [
        "ID",
        "Табельный номер",
        "Фамилия",
        "Имя",
        "Отчество",
        "Предприятие",
        "Отдел",
        "Должность",
        "Статус",
        "Дата приёма",
        "Оклад",
        "Телефон",
        "Email",
      ];
      const rows = this.database
        .prepare(
          `SELECT employee.id AS "ID",
                  employee.employee_number AS "Табельный номер",
                  employee.last_name AS "Фамилия",
                  employee.first_name AS "Имя",
                  employee.middle_name AS "Отчество",
                  enterprise.name AS "Предприятие",
                  department.name AS "Отдел",
                  position.name AS "Должность",
                  employee.lifecycle_status AS "Статус",
                  employee.employment_started_at AS "Дата приёма",
                  employee.salary AS "Оклад",
                  employee.phone AS "Телефон",
                  employee.email AS "Email"
           FROM employees AS employee
           LEFT JOIN enterprises AS enterprise
             ON enterprise.id = employee.enterprise_id
           LEFT JOIN departments AS department
             ON department.id = employee.department_id
           LEFT JOIN positions AS position
             ON position.id = employee.position_id
           WHERE (${employeeScope.sql})
           ORDER BY employee.last_name, employee.first_name`,
        )
        .all(employeeScope.params) as TabularRow[];
      return { headers, rows };
    }

    if (domain === "organization") {
      const headers = ["Тип", "ID", "Название", "Родитель", "Статус"];
      const enterpriseRows = this.enterpriseRows(session);
      const departmentScope = this.departmentScope(session, "department");
      const departmentRows = this.database
        .prepare(
          `SELECT 'Отдел' AS "Тип",
                  department.id AS "ID",
                  department.name AS "Название",
                  enterprise.name AS "Родитель",
                  CASE department.is_archived
                    WHEN 1 THEN 'Архив' ELSE 'Активно'
                  END AS "Статус"
           FROM departments AS department
           JOIN enterprises AS enterprise
             ON enterprise.id = department.enterprise_id
           WHERE (${departmentScope.sql})
           ORDER BY department.name`,
        )
        .all(departmentScope.params) as TabularRow[];
      const positionScope = this.positionScope(
        session,
        "position",
        "department",
      );
      const positionRows = this.database
        .prepare(
          `SELECT 'Должность' AS "Тип",
                  position.id AS "ID",
                  position.name AS "Название",
                  department.name AS "Родитель",
                  CASE position.is_archived
                    WHEN 1 THEN 'Архив' ELSE 'Активно'
                  END AS "Статус"
           FROM positions AS position
           JOIN departments AS department
             ON department.id = position.department_id
           WHERE (${positionScope.sql})
           ORDER BY department.name, position.name`,
        )
        .all(positionScope.params) as TabularRow[];
      return {
        headers,
        rows: [...enterpriseRows, ...departmentRows, ...positionRows],
      };
    }

    if (domain === "vacations") {
      const headers = [
        "ID",
        "Сотрудник",
        "Предприятие оформления",
        "Вид",
        "Начало",
        "Окончание",
        "Календарные дни",
        "Статус",
        "Основание",
      ];
      const rows = this.database
        .prepare(
          `SELECT vacation.id AS "ID",
                  TRIM(employee.last_name || ' ' || employee.first_name)
                    AS "Сотрудник",
                  COALESCE(
                    vacation.enterprise_name_snapshot,
                    enterprise.name,
                    'Не зафиксировано'
                  ) AS "Предприятие оформления",
                  vacation_type.name AS "Вид",
                  vacation.starts_at AS "Начало",
                  vacation.ends_at AS "Окончание",
                  vacation.days_count AS "Календарные дни",
                  vacation.status AS "Статус",
                  vacation.reason AS "Основание"
           FROM vacations AS vacation
           JOIN employees AS employee ON employee.id = vacation.employee_id
           LEFT JOIN enterprises AS enterprise
             ON enterprise.id = vacation.enterprise_id_snapshot
           LEFT JOIN vacation_types AS vacation_type
             ON vacation_type.id = vacation.vacation_type_id
           WHERE (${employeeScope.sql})
           ORDER BY vacation.starts_at DESC`,
        )
        .all(employeeScope.params) as TabularRow[];
      return { headers, rows };
    }

    if (domain === "employment_history") {
      const headers = [
        "ID",
        "Сотрудник",
        "Событие",
        "Дата",
        "Основание",
        "Предыдущее предприятие",
        "Новое предприятие",
        "Предыдущий отдел",
        "Новый отдел",
        "Предыдущая должность",
        "Новая должность",
      ];
      const rows = this.database
        .prepare(
          `SELECT history.id AS "ID",
                  TRIM(employee.last_name || ' ' || employee.first_name)
                    AS "Сотрудник",
                  history.change_type AS "Событие",
                  history.effective_at AS "Дата",
                  history.reason AS "Основание",
                  history.previous_enterprise_name AS "Предыдущее предприятие",
                  history.new_enterprise_name AS "Новое предприятие",
                  previous_department.name AS "Предыдущий отдел",
                  next_department.name AS "Новый отдел",
                  previous_position.name AS "Предыдущая должность",
                  next_position.name AS "Новая должность"
           FROM employment_history AS history
           JOIN employees AS employee ON employee.id = history.employee_id
           LEFT JOIN departments AS previous_department
             ON previous_department.id = history.previous_department_id
           LEFT JOIN departments AS next_department
             ON next_department.id = history.new_department_id
           LEFT JOIN positions AS previous_position
             ON previous_position.id = history.previous_position_id
           LEFT JOIN positions AS next_position
             ON next_position.id = history.new_position_id
           WHERE (${employeeScope.sql})
           ORDER BY history.effective_at DESC, history.id DESC`,
        )
        .all(employeeScope.params) as TabularRow[];
      return { headers, rows };
    }

    if (domain === "vacancies") {
      const headers = [
        "ID",
        "Предприятие",
        "Должность",
        "Отдел",
        "Статус",
        "Количество мест",
        "Тип занятости",
        "Создано",
      ];
      const vacancyScope = this.positionScope(
        session,
        "position",
        "department",
      );
      const rows = this.database
        .prepare(
          `SELECT vacancy.id AS "ID",
                  enterprise.name AS "Предприятие",
                  position.name AS "Должность",
                  department.name AS "Отдел",
                  vacancy.status AS "Статус",
                  vacancy.openings_count AS "Количество мест",
                  vacancy.employment_type AS "Тип занятости",
                  vacancy.created_at AS "Создано"
           FROM vacancies AS vacancy
           JOIN positions AS position ON position.id = vacancy.position_id
           JOIN departments AS department
             ON department.id = position.department_id
           JOIN enterprises AS enterprise
             ON enterprise.id = department.enterprise_id
           WHERE (${vacancyScope.sql})
           ORDER BY vacancy.created_at DESC`,
        )
        .all(vacancyScope.params) as TabularRow[];
      return { headers, rows };
    }

    const headers = [
      "ID",
      "Дата",
      "Пользователь",
      "Действие",
      "Сущность",
      "ID сущности",
    ];
    const auditScope = this.auditScope(session, "audit");
    const rows = this.database
      .prepare(
        `SELECT audit.id AS "ID",
                audit.occurred_at AS "Дата",
                audit.actor_username AS "Пользователь",
                audit.action AS "Действие",
                audit.entity_type AS "Сущность",
                audit.entity_id AS "ID сущности"
         FROM audit_events AS audit
         WHERE (${auditScope.sql})
         ORDER BY audit.occurred_at DESC`,
      )
      .all(auditScope.params) as TabularRow[];
    return { headers, rows };
  }

  private enterpriseRows(session: AuthSession): TabularRow[] {
    if (session.scopeType === "global") {
      return this.database
        .prepare(
          `SELECT 'Предприятие' AS "Тип",
                  id AS "ID",
                  name AS "Название",
                  '' AS "Родитель",
                  CASE is_archived
                    WHEN 1 THEN 'Архив' ELSE 'Активно'
                  END AS "Статус"
           FROM enterprises
           ORDER BY name`,
        )
        .all() as TabularRow[];
    }
    if (!session.enterpriseId) return [];
    return this.database
      .prepare(
        `SELECT 'Предприятие' AS "Тип",
                id AS "ID",
                name AS "Название",
                '' AS "Родитель",
                CASE is_archived
                  WHEN 1 THEN 'Архив' ELSE 'Активно'
                END AS "Статус"
         FROM enterprises
         WHERE id = ?`,
      )
      .all(session.enterpriseId) as TabularRow[];
  }

  private employeeScope(session: AuthSession, alias: string): ScopedSql {
    if (session.scopeType === "global") return { sql: "1 = 1", params: {} };
    if (session.scopeType === "enterprise") {
      return {
        sql: `${alias}.enterprise_id = @scopeEnterpriseId`,
        params: { scopeEnterpriseId: session.enterpriseId },
      };
    }
    if (session.scopeType === "department") {
      return {
        sql: `${alias}.department_id = @scopeDepartmentId`,
        params: { scopeDepartmentId: session.departmentId },
      };
    }
    return {
      sql: `${alias}.id = @scopeEmployeeId`,
      params: { scopeEmployeeId: session.employeeId },
    };
  }

  private departmentScope(session: AuthSession, alias: string): ScopedSql {
    if (session.scopeType === "global") return { sql: "1 = 1", params: {} };
    if (session.scopeType === "enterprise") {
      return {
        sql: `${alias}.enterprise_id = @scopeEnterpriseId`,
        params: { scopeEnterpriseId: session.enterpriseId },
      };
    }
    if (session.scopeType === "department") {
      return {
        sql: `${alias}.id = @scopeDepartmentId`,
        params: { scopeDepartmentId: session.departmentId },
      };
    }
    return { sql: "1 = 0", params: {} };
  }

  private positionScope(
    session: AuthSession,
    positionAlias: string,
    departmentAlias: string,
  ): ScopedSql {
    if (session.scopeType === "global") return { sql: "1 = 1", params: {} };
    if (session.scopeType === "enterprise") {
      return {
        sql: `${departmentAlias}.enterprise_id = @scopeEnterpriseId`,
        params: { scopeEnterpriseId: session.enterpriseId },
      };
    }
    if (session.scopeType === "department") {
      return {
        sql: `${positionAlias}.department_id = @scopeDepartmentId`,
        params: { scopeDepartmentId: session.departmentId },
      };
    }
    return { sql: "1 = 0", params: {} };
  }

  private auditScope(session: AuthSession, alias: string): ScopedSql {
    if (session.scopeType === "global") return { sql: "1 = 1", params: {} };
    if (session.scopeType === "enterprise") {
      return {
        sql: `${alias}.enterprise_id = @scopeEnterpriseId`,
        params: { scopeEnterpriseId: session.enterpriseId },
      };
    }
    if (session.scopeType === "department") {
      return {
        sql: `${alias}.department_id = @scopeDepartmentId`,
        params: { scopeDepartmentId: session.departmentId },
      };
    }
    return { sql: "1 = 0", params: {} };
  }
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}
