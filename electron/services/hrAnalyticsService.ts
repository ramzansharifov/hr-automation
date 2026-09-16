import type Database from "better-sqlite3";
import type { AuthSession } from "../../src/shared/types/access";
import type {
  AnalyticsScopeSummary,
  AnalyticsSeriesPoint,
  HrAnalyticsReport,
} from "../../src/shared/types/hr";

interface ScopedSql {
  sql: string;
  params: Record<string, unknown>;
}

export class HrAnalyticsService {
  constructor(private readonly database: Database.Database) {}

  getReport(session: AuthSession): HrAnalyticsReport {
    const employeeScope = this.employeeScope(session, "employee");
    const employeeParams = employeeScope.params;

    const activeEmployees = this.scalar(
      `SELECT COUNT(*) FROM employees AS employee
       WHERE employee.lifecycle_status = 'active' AND (${employeeScope.sql})`,
      employeeParams,
    );
    const pendingEmployees = this.scalar(
      `SELECT COUNT(*) FROM employees AS employee
       WHERE employee.lifecycle_status IN ('draft', 'pending_assignment')
         AND (${employeeScope.sql})`,
      employeeParams,
    );
    const terminatedEmployees = this.scalar(
      `SELECT COUNT(*) FROM employees AS employee
       WHERE employee.lifecycle_status = 'terminated' AND (${employeeScope.sql})`,
      employeeParams,
    );
    const averageAgeValue = this.scalarNullable(
      `SELECT AVG((julianday('now') - julianday(employee.birth_date)) / 365.2425)
       FROM employees AS employee
       WHERE employee.lifecycle_status = 'active'
         AND employee.birth_date IS NOT NULL
         AND (${employeeScope.sql})`,
      employeeParams,
    );
    const averageTenureValue = this.scalarNullable(
      `SELECT AVG(
         (julianday(DATE('now')) - julianday(employee.employment_started_at)) / 365.2425
       )
       FROM employees AS employee
       WHERE employee.lifecycle_status = 'active'
         AND employee.employment_started_at IS NOT NULL
         AND (${employeeScope.sql})`,
      employeeParams,
    );

    const vacancyScope = this.vacancyScope(
      session,
      "position",
      "department",
    );
    const historyScope = this.employmentHistoryScope(session, "history");
    const vacationScope = this.vacationScope(session, "vacation");

    const openVacancies = this.scalar(
      `SELECT COUNT(*) FROM vacancies AS vacancy
       JOIN positions AS position ON position.id = vacancy.position_id
       JOIN departments AS department ON department.id = position.department_id
       WHERE vacancy.status = 'open'
         AND vacancy.is_archived = 0
         AND (${vacancyScope.sql})`,
      vacancyScope.params,
    );

    const candidatesInProcess = this.scalar(
      `SELECT COUNT(*)
       FROM candidates AS candidate
       JOIN vacancies AS vacancy ON vacancy.id = candidate.vacancy_id
       JOIN positions AS position ON position.id = vacancy.position_id
       JOIN departments AS department ON department.id = position.department_id
       WHERE candidate.status IN ('new', 'screening', 'interview', 'offer')
         AND vacancy.is_archived = 0
         AND (${vacancyScope.sql})`,
      vacancyScope.params,
    );

    const averageTimeToHireDays = this.scalarNullable(
      `SELECT AVG(
         julianday(employee.employment_started_at) - julianday(candidate.created_at)
       )
       FROM candidates AS candidate
       JOIN vacancies AS vacancy ON vacancy.id = candidate.vacancy_id
       JOIN positions AS position ON position.id = vacancy.position_id
       JOIN departments AS department ON department.id = position.department_id
       JOIN employees AS employee ON employee.id = candidate.employee_id
       WHERE candidate.status = 'hired'
         AND employee.employment_started_at IS NOT NULL
         AND (${vacancyScope.sql})`,
      vacancyScope.params,
    );

    const employeesOnLeaveToday = this.scalar(
      `SELECT COUNT(DISTINCT vacation.employee_id)
       FROM vacations AS vacation
       WHERE vacation.status = 'approved'
         AND DATE('now') BETWEEN vacation.starts_at AND vacation.ends_at
         AND (${vacationScope.sql})`,
      vacationScope.params,
    );

    const headcountByEnterprise = this.series(
      `SELECT COALESCE(enterprise.name, 'Без предприятия') AS label,
              COUNT(*) AS value
       FROM employees AS employee
       LEFT JOIN enterprises AS enterprise ON enterprise.id = employee.enterprise_id
       WHERE employee.lifecycle_status = 'active' AND (${employeeScope.sql})
       GROUP BY enterprise.id, enterprise.name
       ORDER BY value DESC, label`,
      employeeParams,
    );
    const headcountByDepartment = this.series(
      `SELECT COALESCE(department.name, 'Без отдела') AS label,
              COUNT(*) AS value
       FROM employees AS employee
       LEFT JOIN departments AS department ON department.id = employee.department_id
       WHERE employee.lifecycle_status = 'active' AND (${employeeScope.sql})
       GROUP BY department.id, department.name
       ORDER BY value DESC, label`,
      employeeParams,
    );
    const headcountByPosition = this.series(
      `SELECT COALESCE(position.name, 'Без должности') AS label,
              COUNT(*) AS value
       FROM employees AS employee
       LEFT JOIN positions AS position ON position.id = employee.position_id
       WHERE employee.lifecycle_status = 'active' AND (${employeeScope.sql})
       GROUP BY position.id, position.name
       ORDER BY value DESC, label`,
      employeeParams,
    );

    const hiresByMonth = this.series(
      `SELECT SUBSTR(history.effective_at, 1, 7) AS label, COUNT(*) AS value
       FROM employment_history AS history
       WHERE history.change_type = 'hired'
         AND history.effective_at >= DATE('now', '-11 months', 'start of month')
         AND (${historyScope.sql})
       GROUP BY label
       ORDER BY label`,
      historyScope.params,
    );
    const terminationsByMonth = this.series(
      `SELECT SUBSTR(history.effective_at, 1, 7) AS label, COUNT(*) AS value
       FROM employment_history AS history
       WHERE history.change_type = 'terminated'
         AND history.effective_at >= DATE('now', '-11 months', 'start of month')
         AND (${historyScope.sql})
       GROUP BY label
       ORDER BY label`,
      historyScope.params,
    );
    const vacanciesByStatus = this.series(
      `SELECT vacancy.status AS label, COUNT(*) AS value
       FROM vacancies AS vacancy
       JOIN positions AS position ON position.id = vacancy.position_id
       JOIN departments AS department ON department.id = position.department_id
       WHERE vacancy.is_archived = 0 AND (${vacancyScope.sql})
       GROUP BY vacancy.status
       ORDER BY value DESC, vacancy.status`,
      vacancyScope.params,
    );
    const candidatesByStatus = this.series(
      `SELECT candidate.status AS label, COUNT(*) AS value
       FROM candidates AS candidate
       JOIN vacancies AS vacancy ON vacancy.id = candidate.vacancy_id
       JOIN positions AS position ON position.id = vacancy.position_id
       JOIN departments AS department ON department.id = position.department_id
       WHERE vacancy.is_archived = 0
         AND (${vacancyScope.sql})
       GROUP BY candidate.status
       ORDER BY value DESC, candidate.status`,
      vacancyScope.params,
    );
    const leaveByType = this.series(
      `SELECT COALESCE(vacation_type.name, 'Без вида') AS label,
              SUM(vacation.days_count) AS value
       FROM vacations AS vacation
       LEFT JOIN vacation_types AS vacation_type
         ON vacation_type.id = vacation.vacation_type_id
       WHERE vacation.status IN ('approved', 'completed')
         AND SUBSTR(vacation.starts_at, 1, 4) = STRFTIME('%Y', 'now')
         AND (${vacationScope.sql})
       GROUP BY vacation_type.id, vacation_type.name
       ORDER BY value DESC, label`,
      vacationScope.params,
    );

    const hiresLast12Months = sumSeries(hiresByMonth);
    const terminationsLast12Months = sumSeries(terminationsByMonth);

    return {
      generatedAt: new Date().toISOString(),
      scope: this.scopeSummary(session),
      activeEmployees,
      pendingEmployees,
      terminatedEmployees,
      averageAge: roundNullable(averageAgeValue, 1),
      averageTenureYears: roundNullable(averageTenureValue, 1),
      openVacancies,
      averageTimeToHireDays: roundNullable(averageTimeToHireDays, 1),
      employeesOnLeaveToday,
      hiresLast12Months,
      terminationsLast12Months,
      netChangeLast12Months: hiresLast12Months - terminationsLast12Months,
      candidatesInProcess,
      headcountByEnterprise,
      headcountByDepartment,
      headcountByPosition,
      hiresByMonth,
      terminationsByMonth,
      vacanciesByStatus,
      candidatesByStatus,
      leaveByType,
    };
  }

  private scopeSummary(session: AuthSession): AnalyticsScopeSummary {
    if (session.scopeType === "global") {
      return {
        type: "global",
        label: "Вся система",
        enterpriseId: null,
        departmentId: null,
      };
    }
    if (session.scopeType === "enterprise") {
      return {
        type: "enterprise",
        label:
          session.enterpriseName ||
          (session.enterpriseId ? `Предприятие #${session.enterpriseId}` : "Предприятие"),
        enterpriseId: session.enterpriseId,
        departmentId: null,
      };
    }
    if (session.scopeType === "department") {
      return {
        type: "department",
        label:
          session.departmentName ||
          (session.departmentId ? `Отдел #${session.departmentId}` : "Отдел"),
        enterpriseId: session.enterpriseId,
        departmentId: session.departmentId,
      };
    }
    return {
      type: "self",
      label: "Только мои данные",
      enterpriseId: session.enterpriseId,
      departmentId: session.departmentId,
    };
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

  private employmentHistoryScope(
    session: AuthSession,
    alias: string,
  ): ScopedSql {
    if (session.scopeType === "global") return { sql: "1 = 1", params: {} };
    if (session.scopeType === "enterprise") {
      return {
        sql: `(${alias}.previous_enterprise_id = @scopeEnterpriseId OR ${alias}.new_enterprise_id = @scopeEnterpriseId)`,
        params: { scopeEnterpriseId: session.enterpriseId },
      };
    }
    if (session.scopeType === "department") {
      return {
        sql: `(${alias}.previous_department_id = @scopeDepartmentId OR ${alias}.new_department_id = @scopeDepartmentId)`,
        params: { scopeDepartmentId: session.departmentId },
      };
    }
    return {
      sql: `${alias}.employee_id = @scopeEmployeeId`,
      params: { scopeEmployeeId: session.employeeId },
    };
  }

  private vacationScope(session: AuthSession, alias: string): ScopedSql {
    if (session.scopeType === "global") return { sql: "1 = 1", params: {} };
    if (session.scopeType === "enterprise") {
      return {
        sql: `${alias}.enterprise_id_snapshot = @scopeEnterpriseId`,
        params: { scopeEnterpriseId: session.enterpriseId },
      };
    }
    if (session.scopeType === "department") {
      return {
        sql: `${alias}.department_id_snapshot = @scopeDepartmentId`,
        params: { scopeDepartmentId: session.departmentId },
      };
    }
    return {
      sql: `${alias}.employee_id = @scopeEmployeeId`,
      params: { scopeEmployeeId: session.employeeId },
    };
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

  private scalar(
    sql: string,
    params: Record<string, unknown> = {},
  ): number {
    const value = this.database.prepare(sql).pluck().get(params) as unknown;
    return Number(value ?? 0);
  }

  private scalarNullable(
    sql: string,
    params: Record<string, unknown> = {},
  ): number | null {
    const value = this.database.prepare(sql).pluck().get(params) as unknown;
    if (value === null || value === undefined) return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  private series(
    sql: string,
    params: Record<string, unknown>,
  ): AnalyticsSeriesPoint[] {
    const rows = this.database.prepare(sql).all(params) as Array<{
      label: string | null;
      value: number | null;
    }>;
    return rows.map((row) => ({
      label: row.label ?? "Не указано",
      value: Number(row.value ?? 0),
    }));
  }
}

function roundNullable(value: number | null, digits: number): number | null {
  if (value === null) return null;
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}

function sumSeries(points: AnalyticsSeriesPoint[]): number {
  return points.reduce((sum, point) => sum + point.value, 0);
}
