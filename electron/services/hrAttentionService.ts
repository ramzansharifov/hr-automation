import type Database from "better-sqlite3";
import type { AuthSession } from "../../src/shared/types/access";
import type { AttentionItem } from "../../src/shared/types/hr";

interface ScopedSql {
  sql: string;
  params: Record<string, unknown>;
}

export class HrAttentionService {
  constructor(private readonly database: Database.Database) {}

  list(session: AuthSession): AttentionItem[] {
    const items: AttentionItem[] = [];
    const employeeScope = this.employeeScope(session, "employee");
    const employees = this.database
      .prepare(
        `SELECT employee.*,
                TRIM(employee.last_name || ' ' || employee.first_name || ' ' || COALESCE(employee.middle_name, '')) AS full_name
         FROM employees AS employee
         WHERE (${employeeScope.sql})`,
      )
      .all(employeeScope.params) as Array<Record<string, unknown>>;

    for (const employee of employees) {
      const id = Number(employee.id);
      const name = String(employee.full_name ?? "Сотрудник").trim();
      const lifecycle = String(
        employee.lifecycle_status ?? employee.status ?? "active",
      );
      if (lifecycle === "pending_assignment" || lifecycle === "draft") {
        items.push(
          attention(
            `employee-pending-${id}`,
            "employee_pending",
            "warning",
            "Ожидает оформления",
            `${name}: требуется кадровое назначение`,
            `/employees/${id}`,
            null,
          ),
        );
      }
      if (
        lifecycle === "active" &&
        isDateWithin(String(employee.contract_end_date ?? ""), 30)
      ) {
        items.push(
          attention(
            `contract-${id}`,
            "contract_expiry",
            "critical",
            "Заканчивается договор",
            name,
            `/employees/${id}`,
            nullableDate(employee.contract_end_date),
          ),
        );
      }
      if (
        lifecycle === "active" &&
        isDateWithin(String(employee.probation_end_date ?? ""), 7)
      ) {
        items.push(
          attention(
            `probation-${id}`,
            "probation_expiry",
            "warning",
            "Завершается испытательный срок",
            name,
            `/employees/${id}`,
            nullableDate(employee.probation_end_date),
          ),
        );
      }
    }

    const pendingVacations = this.database
      .prepare(
        `SELECT vacation.id, vacation.starts_at,
                TRIM(employee.last_name || ' ' || employee.first_name) AS employee_name
         FROM vacations AS vacation
         JOIN employees AS employee ON employee.id = vacation.employee_id
         WHERE vacation.status = 'planned' AND (${employeeScope.sql})
         ORDER BY vacation.starts_at
         LIMIT 100`,
      )
      .all(employeeScope.params) as Array<Record<string, unknown>>;
    for (const vacation of pendingVacations) {
      items.push(
        attention(
          `vacation-${vacation.id}`,
          "vacation_pending",
          "warning",
          "Отпуск ожидает решения",
          String(vacation.employee_name),
          "/vacations",
          nullableDate(vacation.starts_at),
        ),
      );
    }

    const departmentScope = this.departmentScope(session, "department");
    const departments = this.database
      .prepare(
        `SELECT department.id, department.name
         FROM departments AS department
         WHERE department.is_archived = 0
           AND department.director_employee_id IS NULL
           AND (${departmentScope.sql})
         ORDER BY department.name`,
      )
      .all(departmentScope.params) as Array<{ id: number; name: string }>;
    for (const department of departments) {
      items.push(
        attention(
          `department-head-${department.id}`,
          "department_without_head",
          "warning",
          "Отдел без руководителя",
          department.name,
          "/enterprises",
          null,
        ),
      );
    }

    const noUsers = this.database
      .prepare(
        `SELECT employee.id,
                TRIM(employee.last_name || ' ' || employee.first_name) AS employee_name
         FROM employees AS employee
         LEFT JOIN users AS user ON user.employee_id = employee.id
         WHERE employee.lifecycle_status = 'active'
           AND user.id IS NULL
           AND (${employeeScope.sql})
         ORDER BY employee.last_name
         LIMIT 100`,
      )
      .all(employeeScope.params) as Array<Record<string, unknown>>;
    for (const employee of noUsers) {
      items.push(
        attention(
          `employee-user-${employee.id}`,
          "employee_without_user",
          "info",
          "Нет учётной записи",
          String(employee.employee_name),
          "/users",
          null,
        ),
      );
    }

    const blockedUsers = this.database
      .prepare(
        `SELECT user.id, user.username, employee.id AS employee_id
         FROM users AS user
         JOIN employees AS employee ON employee.id = user.employee_id
         WHERE user.status = 'blocked' AND (${employeeScope.sql})`,
      )
      .all(employeeScope.params) as Array<Record<string, unknown>>;
    for (const user of blockedUsers) {
      items.push(
        attention(
          `blocked-user-${user.id}`,
          "blocked_user",
          "critical",
          "Учётная запись заблокирована",
          String(user.username),
          "/users",
          null,
        ),
      );
    }

    const vacancyScope = this.vacancyScope(
      session,
      "position",
      "department",
    );
    const staleVacancies = this.database
      .prepare(
        `SELECT vacancy.id, position.name
         FROM vacancies AS vacancy
         JOIN positions AS position ON position.id = vacancy.position_id
         JOIN departments AS department ON department.id = position.department_id
         WHERE vacancy.status = 'open'
           AND vacancy.is_archived = 0
           AND vacancy.created_at <= DATETIME('now', '-30 day')
           AND (${vacancyScope.sql})`,
      )
      .all(vacancyScope.params) as Array<Record<string, unknown>>;
    for (const vacancy of staleVacancies) {
      items.push(
        attention(
          `vacancy-stale-${vacancy.id}`,
          "vacancy_stale",
          "warning",
          "Вакансия долго не закрывается",
          String(vacancy.name),
          `/vacancies/${vacancy.id}`,
          null,
        ),
      );
    }

    const expiringDocuments = this.database
      .prepare(
        `SELECT document.id, document.title, document.expires_at, document.employee_id
         FROM employee_documents AS document
         JOIN employees AS employee ON employee.id = document.employee_id
         WHERE document.status = 'active'
           AND document.expires_at BETWEEN DATE('now') AND DATE('now', '+30 day')
           AND (${employeeScope.sql})`,
      )
      .all(employeeScope.params) as Array<Record<string, unknown>>;
    for (const document of expiringDocuments) {
      items.push(
        attention(
          `document-expiry-${document.id}`,
          "document_expiry",
          "warning",
          "Истекает документ",
          String(document.title),
          `/employees/${document.employee_id}`,
          nullableDate(document.expires_at),
        ),
      );
    }

    return items.sort(
      (a, b) =>
        severityRank(b.severity) - severityRank(a.severity) ||
        String(a.dueDate ?? "9999").localeCompare(
          String(b.dueDate ?? "9999"),
        ),
    );
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

  private vacancyScope(
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
}

function attention(
  id: string,
  type: string,
  severity: AttentionItem["severity"],
  title: string,
  description: string,
  path: string,
  dueDate: string | null,
): AttentionItem {
  return { id, type, severity, title, description, path, dueDate };
}

function severityRank(severity: AttentionItem["severity"]): number {
  return severity === "critical" ? 3 : severity === "warning" ? 2 : 1;
}

function nullableDate(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : null;
}

function isDateWithin(value: string, days: number): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`).getTime();
  const start = new Date(`${today()}T00:00:00Z`).getTime();
  const end = start + days * 86_400_000;
  return date >= start && date <= end;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}
