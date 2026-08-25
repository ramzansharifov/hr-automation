import { app, dialog, shell } from "electron";
import { createHash, randomUUID } from "node:crypto";
import {
  copyFileSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import type Database from "better-sqlite3";
import type { AuthSession } from "../../src/shared/types/access";
import type {
  AddEmployeeDocumentParams,
  AnalyticsSeriesPoint,
  ApplyEmployeeImportParams,
  AttentionItem,
  DataExportDomain,
  EmployeeDocumentSummary,
  EmployeeImportColumnMap,
  EmployeeImportError,
  EmployeeImportPreview,
  EmployeeImportResult,
  EmployeeImportSelection,
  ExportDataParams,
  HrAnalyticsReport,
  HrLeadershipChangeParams,
  HrRecord,
  LeaveBalanceSummary,
  LeaveOverview,
  LeaveOverviewParams,
  PreviewEmployeeImportParams,
  SaveLeaveBalanceParams,
  SaveWorkCalendarDayParams,
} from "../../src/shared/types/hr";
import { HrCrudRepository } from "../repositories/hrCrudRepository";
import {
  parseCsv,
  parseXlsx,
  writeCsv,
  writeXlsx,
  type ParsedTable,
  type TabularRow,
} from "./tabularFileService";

interface ImportCacheEntry extends ParsedTable {
  fileName: string;
}

interface ScopedSql {
  sql: string;
  params: Record<string, unknown>;
}

interface ImportResolvedRow {
  rowNumber: number;
  source: Record<string, string>;
  lastName: string;
  firstName: string;
  middleName: string | null;
  email: string | null;
  phone: string | null;
  employeeNumber: string | null;
  enterpriseId: number | null;
  departmentId: number | null;
  positionId: number | null;
  hireDate: string | null;
  salary: number;
}

interface ImportEvaluation {
  totalRows: number;
  duplicateRows: number;
  errors: EmployeeImportError[];
  validRows: ImportResolvedRow[];
}

interface EmployeeContextRow extends HrRecord {
  id: number;
  enterprise_id: number | null;
  department_id: number | null;
  position_id: number | null;
  salary: number;
}

export class HrCoreExpansionService {
  private readonly importCache = new Map<string, ImportCacheEntry>();

  constructor(private readonly database: Database.Database) {}

  changeLeadership(params: HrLeadershipChangeParams, session: AuthSession): { success: true } {
    assertDate(params.effectiveAt, "Укажите корректную дату кадрового действия");
    if (!params.reason.trim()) throw new Error("Укажите основание кадрового действия");

    const execute = this.database.transaction(() => {
      const target = this.getLeadershipTarget(params.targetType, params.targetId);
      this.assertLeadershipTargetInScope(params.targetType, target, session);
      const previousLeaderId = positiveNumber(target.leader_id);
      const nextLeaderId = positiveNumber(params.newLeaderEmployeeId);

      if (previousLeaderId === nextLeaderId) {
        throw new Error("Выбранный руководитель уже назначен на эту роль");
      }

      if (previousLeaderId) {
        this.clearLeadershipTarget(params.targetType, params.targetId);
        this.applyPreviousLeaderOutcome(previousLeaderId, params, session);
      }

      if (nextLeaderId) {
        const nextLeader = this.getEmployee(nextLeaderId);
        this.assertEmployeeInScope(nextLeader, session);
        const employment = this.resolveNewLeaderEmployment(nextLeader, params, target);
        const repository = new HrCrudRepository(this.database);
        repository.changeEmployment({
          employeeId: nextLeaderId,
          enterpriseId: employment.enterpriseId,
          departmentId: employment.departmentId,
          positionId: null,
          salaryMode: "custom",
          salary: employment.salary,
          effectiveAt: params.effectiveAt,
          reason: params.reason.trim(),
          leadershipAssignment: {
            type:
              params.targetType === "enterprise"
                ? "enterprise_director"
                : "department_head",
            targetId: params.targetId,
          },
        });
      }

      const action = previousLeaderId
        ? nextLeaderId
          ? "replace"
          : "remove"
        : "assign";
      this.database
        .prepare(
          `INSERT INTO leadership_history (
             target_type, target_id, action,
             previous_leader_employee_id, new_leader_employee_id,
             previous_leader_outcome, effective_at, reason
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          params.targetType,
          params.targetId,
          action,
          previousLeaderId,
          nextLeaderId,
          mapPreviousLeaderOutcome(params.previousLeaderOutcome),
          params.effectiveAt,
          params.reason.trim(),
        );
    });

    execute();
    return { success: true };
  }

  listEmployeeDocuments(
    employeeId: number | undefined,
    session: AuthSession,
  ): EmployeeDocumentSummary[] {
    const scope = this.employeeScope(session, "employee");
    const rows = this.database
      .prepare(
        `SELECT document.*,
                TRIM(employee.last_name || ' ' || employee.first_name || ' ' || COALESCE(employee.middle_name, '')) AS employee_name
         FROM employee_documents AS document
         JOIN employees AS employee ON employee.id = document.employee_id
         WHERE document.status = 'active'
           AND (${scope.sql})
           AND (@employeeId IS NULL OR document.employee_id = @employeeId)
         ORDER BY COALESCE(document.expires_at, '9999-12-31'), document.created_at DESC`,
      )
      .all({
        ...scope.params,
        employeeId: employeeId && employeeId > 0 ? employeeId : null,
      }) as Array<Record<string, unknown>>;
    return rows.map(toDocumentSummary);
  }

  addEmployeeDocument(
    params: AddEmployeeDocumentParams,
    session: AuthSession,
  ): EmployeeDocumentSummary | null {
    const employee = this.getEmployee(params.employeeId);
    this.assertEmployeeInScope(employee, session);
    if (!params.documentType.trim() || !params.title.trim()) {
      throw new Error("Укажите вид и название документа");
    }
    if (params.issuedAt) assertDate(params.issuedAt, "Некорректная дата выдачи документа");
    if (params.expiresAt) assertDate(params.expiresAt, "Некорректный срок действия документа");
    if (params.issuedAt && params.expiresAt && params.expiresAt < params.issuedAt) {
      throw new Error("Срок действия документа не может быть раньше даты выдачи");
    }

    if (params.employmentHistoryId) {
      const event = this.database
        .prepare("SELECT employee_id FROM employment_history WHERE id = ? LIMIT 1")
        .get(params.employmentHistoryId) as { employee_id: number } | undefined;
      if (!event || event.employee_id !== params.employeeId) {
        throw new Error("Кадровое событие не принадлежит выбранному сотруднику");
      }
    }

    const selected = dialog.showOpenDialogSync({
      title: "Выберите документ сотрудника",
      properties: ["openFile"],
      filters: [
        { name: "Документы", extensions: ["pdf", "doc", "docx", "xls", "xlsx", "png", "jpg", "jpeg", "txt"] },
        { name: "Все файлы", extensions: ["*"] },
      ],
    });
    const sourcePath = selected?.[0];
    if (!sourcePath) return null;

    const stat = statSync(sourcePath);
    if (!stat.isFile()) throw new Error("Выбранный путь не является файлом");
    if (stat.size > 100 * 1024 * 1024) {
      throw new Error("Размер документа не должен превышать 100 МБ");
    }

    const root = this.documentStorageRoot();
    const employeeDirectory = path.join(root, String(params.employeeId));
    mkdirSync(employeeDirectory, { recursive: true });
    const extension = path.extname(sourcePath).toLowerCase();
    const storedName = `${Date.now()}-${randomUUID()}${extension}`;
    const destination = path.join(employeeDirectory, storedName);
    copyFileSync(sourcePath, destination);
    const hash = sha256File(destination);
    const relativePath = path.relative(root, destination).replace(/\\/g, "/");

    try {
      const result = this.database
        .prepare(
          `INSERT INTO employee_documents (
             employee_id, employment_history_id, document_type, title,
             original_name, stored_name, relative_path, mime_type,
             size_bytes, sha256, issued_at, expires_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          params.employeeId,
          params.employmentHistoryId ?? null,
          params.documentType.trim(),
          params.title.trim(),
          path.basename(sourcePath),
          storedName,
          relativePath,
          mimeTypeForExtension(extension),
          stat.size,
          hash,
          params.issuedAt ?? null,
          params.expiresAt ?? null,
        );
      return this.getDocument(Number(result.lastInsertRowid), session);
    } catch (error) {
      rmSync(destination, { force: true });
      throw error;
    }
  }

  openEmployeeDocument(id: number, session: AuthSession): { success: true } {
    const document = this.getDocumentRow(id, session);
    if (String(document.status) !== "active") throw new Error("Документ удалён");
    const absolutePath = this.resolveDocumentPath(String(document.relative_path));
    const actualHash = sha256File(absolutePath);
    if (actualHash !== String(document.sha256)) {
      throw new Error("Проверка целостности документа не пройдена");
    }
    void shell.openPath(absolutePath);
    return { success: true };
  }

  deleteEmployeeDocument(
    id: number,
    reason: string,
    session: AuthSession,
  ): { success: true } {
    if (!reason.trim()) throw new Error("Укажите основание удаления документа");
    const document = this.getDocumentRow(id, session);
    if (String(document.status) !== "active") return { success: true };
    const absolutePath = this.resolveDocumentPath(String(document.relative_path));
    rmSync(absolutePath, { force: true });
    this.database
      .prepare(
        `UPDATE employee_documents
         SET status = 'deleted', deleted_at = CURRENT_TIMESTAMP,
             delete_reason = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
      )
      .run(reason.trim(), id);
    return { success: true };
  }

  getLeaveOverview(params: LeaveOverviewParams, session: AuthSession): LeaveOverview {
    const year = normalizeYear(params.year);
    const employee = this.getEmployee(params.employeeId);
    this.assertEmployeeInScope(employee, session);
    const enterpriseId = positiveNumber(employee.enterprise_id);
    if (!enterpriseId) throw new Error("У сотрудника не определено предприятие");

    const vacations = this.database
      .prepare(
        `SELECT vacation.*, vacation_type.name AS vacation_type_name
         FROM vacations AS vacation
         LEFT JOIN vacation_types AS vacation_type ON vacation_type.id = vacation.vacation_type_id
         WHERE vacation.employee_id = @employeeId
           AND (vacation.entitlement_year = @year OR SUBSTR(vacation.starts_at, 1, 4) = @yearText)
         ORDER BY vacation.starts_at`,
      )
      .all({ employeeId: params.employeeId, year, yearText: String(year) }) as HrRecord[];

    let usedDays = 0;
    let plannedDays = 0;
    for (const vacation of vacations) {
      const workingDays = this.calculateWorkingDays(
        enterpriseId,
        String(vacation.starts_at ?? ""),
        String(vacation.ends_at ?? ""),
      );
      if (Number(vacation.working_days_count ?? 0) !== workingDays) {
        this.database
          .prepare("UPDATE vacations SET working_days_count = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
          .run(workingDays, Number(vacation.id));
        vacation.working_days_count = workingDays;
      }
      const status = String(vacation.status ?? "planned");
      if (status === "approved" || status === "completed") usedDays += workingDays;
      if (status === "planned") plannedDays += workingDays;
    }

    const balanceRow = this.database
      .prepare(
        `SELECT entitlement_days, carryover_days, adjustment_days
         FROM leave_balances WHERE employee_id = ? AND balance_year = ? LIMIT 1`,
      )
      .get(params.employeeId, year) as
      | { entitlement_days: number; carryover_days: number; adjustment_days: number }
      | undefined;
    const entitlementDays = Number(balanceRow?.entitlement_days ?? 28);
    const carryoverDays = Number(balanceRow?.carryover_days ?? 0);
    const adjustmentDays = Number(balanceRow?.adjustment_days ?? 0);
    const remainingDays = entitlementDays + carryoverDays + adjustmentDays - usedDays;
    const balance: LeaveBalanceSummary = {
      employeeId: params.employeeId,
      year,
      entitlementDays,
      carryoverDays,
      adjustmentDays,
      usedDays,
      plannedDays,
      remainingDays,
    };

    const calendarDays = this.database
      .prepare(
        `SELECT id, enterprise_id, calendar_date, is_workday, name
         FROM work_calendar_days
         WHERE enterprise_id = ? AND calendar_date BETWEEN ? AND ?
         ORDER BY calendar_date`,
      )
      .all(enterpriseId, `${year}-01-01`, `${year}-12-31`) as HrRecord[];

    const warnings: string[] = [];
    if (remainingDays < 0) warnings.push(`Отрицательный остаток отпуска: ${remainingDays} дн.`);
    if (plannedDays > Math.max(remainingDays, 0)) {
      warnings.push("Запланированные отпуска превышают доступный остаток дней");
    }
    warnings.push(...this.departmentAbsenceWarnings(employee, vacations));

    return { balance, vacations, calendarDays, warnings };
  }

  saveLeaveBalance(params: SaveLeaveBalanceParams, session: AuthSession): LeaveBalanceSummary {
    const year = normalizeYear(params.year);
    const employee = this.getEmployee(params.employeeId);
    this.assertEmployeeInScope(employee, session);
    const values = [params.entitlementDays, params.carryoverDays, params.adjustmentDays];
    if (!values.every(Number.isFinite) || params.entitlementDays < 0 || params.carryoverDays < 0) {
      throw new Error("Укажите корректные значения отпускного баланса");
    }
    this.database
      .prepare(
        `INSERT INTO leave_balances (
           employee_id, balance_year, entitlement_days, carryover_days, adjustment_days
         ) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(employee_id, balance_year) DO UPDATE SET
           entitlement_days = excluded.entitlement_days,
           carryover_days = excluded.carryover_days,
           adjustment_days = excluded.adjustment_days,
           updated_at = CURRENT_TIMESTAMP`,
      )
      .run(
        params.employeeId,
        year,
        params.entitlementDays,
        params.carryoverDays,
        params.adjustmentDays,
      );
    return this.getLeaveOverview({ employeeId: params.employeeId, year }, session).balance;
  }

  saveWorkCalendarDay(params: SaveWorkCalendarDayParams, session: AuthSession): { success: true } {
    assertDate(params.date, "Укажите корректную дату производственного календаря");
    this.assertEnterpriseIdInScope(params.enterpriseId, session, false);
    this.database
      .prepare(
        `INSERT INTO work_calendar_days (enterprise_id, calendar_date, is_workday, name)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(enterprise_id, calendar_date) DO UPDATE SET
           is_workday = excluded.is_workday,
           name = excluded.name,
           updated_at = CURRENT_TIMESTAMP`,
      )
      .run(params.enterpriseId, params.date, params.isWorkday ? 1 : 0, params.name?.trim() || null);
    return { success: true };
  }

  listAttentionItems(session: AuthSession): AttentionItem[] {
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
      const lifecycle = String(employee.lifecycle_status ?? employee.status ?? "active");
      if (lifecycle === "pending_assignment" || lifecycle === "draft") {
        items.push(attention(`employee-pending-${id}`, "employee_pending", "warning", "Ожидает оформления", `${name}: требуется кадровое назначение`, `/employees/${id}`, null));
      }
      if (lifecycle === "active" && isDateWithin(String(employee.contract_end_date ?? ""), 30)) {
        items.push(attention(`contract-${id}`, "contract_expiry", "critical", "Заканчивается договор", name, `/employees/${id}`, nullableDate(employee.contract_end_date)));
      }
      if (lifecycle === "active" && isDateWithin(String(employee.probation_end_date ?? ""), 7)) {
        items.push(attention(`probation-${id}`, "probation_expiry", "warning", "Завершается испытательный срок", name, `/employees/${id}`, nullableDate(employee.probation_end_date)));
      }
    }

    const pendingVacations = this.database
      .prepare(
        `SELECT vacation.id, vacation.starts_at,
                TRIM(employee.last_name || ' ' || employee.first_name) AS employee_name
         FROM vacations AS vacation
         JOIN employees AS employee ON employee.id = vacation.employee_id
         WHERE vacation.status = 'planned' AND (${employeeScope.sql})
         ORDER BY vacation.starts_at LIMIT 100`,
      )
      .all(employeeScope.params) as Array<Record<string, unknown>>;
    for (const vacation of pendingVacations) {
      items.push(attention(`vacation-${vacation.id}`, "vacation_pending", "warning", "Отпуск ожидает решения", String(vacation.employee_name), "/vacations", nullableDate(vacation.starts_at)));
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
      items.push(attention(`department-head-${department.id}`, "department_without_head", "warning", "Отдел без руководителя", department.name, `/enterprises`, null));
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
         ORDER BY employee.last_name LIMIT 100`,
      )
      .all(employeeScope.params) as Array<Record<string, unknown>>;
    for (const employee of noUsers) {
      items.push(attention(`employee-user-${employee.id}`, "employee_without_user", "info", "Нет учётной записи", String(employee.employee_name), "/users", null));
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
      items.push(attention(`blocked-user-${user.id}`, "blocked_user", "critical", "Учётная запись заблокирована", String(user.username), "/users", null));
    }

    const vacancyScope = this.vacancyScope(session, "vacancy", "position", "department");
    const staleVacancies = this.database
      .prepare(
        `SELECT vacancy.id, position.name
         FROM vacancies AS vacancy
         JOIN positions AS position ON position.id = vacancy.position_id
         JOIN departments AS department ON department.id = position.department_id
         WHERE vacancy.status = 'open' AND vacancy.is_archived = 0
           AND vacancy.created_at <= DATETIME('now', '-30 day')
           AND (${vacancyScope.sql})`,
      )
      .all(vacancyScope.params) as Array<Record<string, unknown>>;
    for (const vacancy of staleVacancies) {
      items.push(attention(`vacancy-stale-${vacancy.id}`, "vacancy_stale", "warning", "Вакансия долго не закрывается", String(vacancy.name), `/vacancies/${vacancy.id}`, null));
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
      items.push(attention(`document-expiry-${document.id}`, "document_expiry", "warning", "Истекает документ", String(document.title), `/employees/${document.employee_id}`, nullableDate(document.expires_at)));
    }

    return items.sort((a, b) => severityRank(b.severity) - severityRank(a.severity) || String(a.dueDate ?? "9999").localeCompare(String(b.dueDate ?? "9999")));
  }

  getAnalytics(session: AuthSession): HrAnalyticsReport {
    const employeeScope = this.employeeScope(session, "employee");
    const employeeParams = employeeScope.params;
    const activeEmployees = this.scalar(
      `SELECT COUNT(*) FROM employees AS employee WHERE employee.lifecycle_status = 'active' AND (${employeeScope.sql})`,
      employeeParams,
    );
    const pendingEmployees = this.scalar(
      `SELECT COUNT(*) FROM employees AS employee WHERE employee.lifecycle_status IN ('draft', 'pending_assignment') AND (${employeeScope.sql})`,
      employeeParams,
    );
    const terminatedEmployees = this.scalar(
      `SELECT COUNT(*) FROM employees AS employee WHERE employee.lifecycle_status = 'terminated' AND (${employeeScope.sql})`,
      employeeParams,
    );
    const averageAgeValue = this.scalarNullable(
      `SELECT AVG((julianday('now') - julianday(employee.birth_date)) / 365.2425)
       FROM employees AS employee
       WHERE employee.birth_date IS NOT NULL AND (${employeeScope.sql})`,
      employeeParams,
    );
    const averageTenureValue = this.scalarNullable(
      `SELECT AVG((julianday(COALESCE(employee.terminated_at, DATE('now'))) - julianday(employee.employment_started_at)) / 365.2425)
       FROM employees AS employee
       WHERE employee.employment_started_at IS NOT NULL AND (${employeeScope.sql})`,
      employeeParams,
    );

    const vacancyScope = this.vacancyScope(session, "vacancy", "position", "department");
    const openVacancies = this.scalar(
      `SELECT COUNT(*) FROM vacancies AS vacancy
       JOIN positions AS position ON position.id = vacancy.position_id
       JOIN departments AS department ON department.id = position.department_id
       WHERE vacancy.status = 'open' AND vacancy.is_archived = 0 AND (${vacancyScope.sql})`,
      vacancyScope.params,
    );

    const averageTimeToHireDays = this.scalarNullable(
      `SELECT AVG(julianday(employee.employment_started_at) - julianday(candidate.created_at))
       FROM candidates AS candidate
       JOIN employees AS employee ON employee.id = candidate.employee_id
       WHERE employee.employment_started_at IS NOT NULL AND (${employeeScope.sql})`,
      employeeParams,
    );

    const employeesOnLeaveToday = this.scalar(
      `SELECT COUNT(DISTINCT vacation.employee_id)
       FROM vacations AS vacation
       JOIN employees AS employee ON employee.id = vacation.employee_id
       WHERE vacation.status = 'approved'
         AND DATE('now') BETWEEN vacation.starts_at AND vacation.ends_at
         AND (${employeeScope.sql})`,
      employeeParams,
    );

    const headcountByEnterprise = this.series(
      `SELECT COALESCE(enterprise.name, 'Без предприятия') AS label, COUNT(*) AS value
       FROM employees AS employee
       LEFT JOIN enterprises AS enterprise ON enterprise.id = employee.enterprise_id
       WHERE employee.lifecycle_status = 'active' AND (${employeeScope.sql})
       GROUP BY enterprise.id, enterprise.name ORDER BY value DESC`,
      employeeParams,
    );
    const headcountByDepartment = this.series(
      `SELECT COALESCE(department.name, 'Без отдела') AS label, COUNT(*) AS value
       FROM employees AS employee
       LEFT JOIN departments AS department ON department.id = employee.department_id
       WHERE employee.lifecycle_status = 'active' AND (${employeeScope.sql})
       GROUP BY department.id, department.name ORDER BY value DESC`,
      employeeParams,
    );
    const hiresByMonth = this.series(
      `SELECT SUBSTR(history.effective_at, 1, 7) AS label, COUNT(*) AS value
       FROM employment_history AS history
       JOIN employees AS employee ON employee.id = history.employee_id
       WHERE history.change_type = 'hired'
         AND history.effective_at >= DATE('now', '-11 months', 'start of month')
         AND (${employeeScope.sql})
       GROUP BY label ORDER BY label`,
      employeeParams,
    );
    const terminationsByMonth = this.series(
      `SELECT SUBSTR(history.effective_at, 1, 7) AS label, COUNT(*) AS value
       FROM employment_history AS history
       JOIN employees AS employee ON employee.id = history.employee_id
       WHERE history.change_type = 'terminated'
         AND history.effective_at >= DATE('now', '-11 months', 'start of month')
         AND (${employeeScope.sql})
       GROUP BY label ORDER BY label`,
      employeeParams,
    );
    const vacanciesByStatus = this.series(
      `SELECT vacancy.status AS label, COUNT(*) AS value
       FROM vacancies AS vacancy
       JOIN positions AS position ON position.id = vacancy.position_id
       JOIN departments AS department ON department.id = position.department_id
       WHERE vacancy.is_archived = 0 AND (${vacancyScope.sql})
       GROUP BY vacancy.status ORDER BY value DESC`,
      vacancyScope.params,
    );
    const leaveByType = this.series(
      `SELECT COALESCE(vacation_type.name, 'Без вида') AS label,
              SUM(CASE WHEN vacation.working_days_count > 0 THEN vacation.working_days_count ELSE vacation.days_count END) AS value
       FROM vacations AS vacation
       JOIN employees AS employee ON employee.id = vacation.employee_id
       LEFT JOIN vacation_types AS vacation_type ON vacation_type.id = vacation.vacation_type_id
       WHERE vacation.status IN ('approved', 'completed')
         AND SUBSTR(vacation.starts_at, 1, 4) = STRFTIME('%Y', 'now')
         AND (${employeeScope.sql})
       GROUP BY vacation_type.id, vacation_type.name ORDER BY value DESC`,
      employeeParams,
    );

    return {
      activeEmployees,
      pendingEmployees,
      terminatedEmployees,
      averageAge: roundNullable(averageAgeValue, 1),
      averageTenureYears: roundNullable(averageTenureValue, 1),
      openVacancies,
      averageTimeToHireDays: roundNullable(averageTimeToHireDays, 1),
      employeesOnLeaveToday,
      headcountByEnterprise,
      headcountByDepartment,
      hiresByMonth,
      terminationsByMonth,
      vacanciesByStatus,
      leaveByType,
    };
  }

  selectEmployeeImportFile(): EmployeeImportSelection | null {
    const selected = dialog.showOpenDialogSync({
      title: "Выберите файл сотрудников",
      properties: ["openFile"],
      filters: [
        { name: "Таблицы", extensions: ["csv", "xlsx"] },
        { name: "CSV", extensions: ["csv"] },
        { name: "Excel", extensions: ["xlsx"] },
      ],
    });
    const filePath = selected?.[0];
    if (!filePath) return null;
    const extension = path.extname(filePath).toLowerCase();
    const parsed = extension === ".xlsx"
      ? parseXlsx(readFileSync(filePath))
      : parseCsv(readFileSync(filePath, "utf8"));
    if (parsed.headers.length === 0) throw new Error("В файле не найдены заголовки колонок");
    const previewId = randomUUID();
    this.importCache.set(previewId, { ...parsed, fileName: path.basename(filePath) });
    this.trimImportCache();
    return {
      previewId,
      fileName: path.basename(filePath),
      headers: parsed.headers,
      sampleRows: parsed.rows.slice(0, 20),
      totalRows: parsed.rows.length,
    };
  }

  previewEmployeeImport(
    params: PreviewEmployeeImportParams,
    session: AuthSession,
  ): EmployeeImportPreview {
    const evaluation = this.evaluateEmployeeImport(params.previewId, params.columnMap, session);
    return {
      previewId: params.previewId,
      totalRows: evaluation.totalRows,
      validRows: evaluation.validRows.length,
      duplicateRows: evaluation.duplicateRows,
      errors: evaluation.errors.slice(0, 200),
    };
  }

  applyEmployeeImport(
    params: ApplyEmployeeImportParams,
    session: AuthSession,
  ): EmployeeImportResult {
    const evaluation = this.evaluateEmployeeImport(params.previewId, params.columnMap, session);
    if (params.dryRun) {
      return {
        totalRows: evaluation.totalRows,
        importedRows: 0,
        skippedRows: evaluation.totalRows - evaluation.validRows.length,
        errors: evaluation.errors.slice(0, 200),
      };
    }

    let importedRows = 0;
    const errors = [...evaluation.errors];
    const insert = this.database.prepare(
      `INSERT INTO employees (
         enterprise_id, department_id, position_id, employee_number,
         last_name, first_name, middle_name, email, phone,
         hire_date, employment_started_at, status, lifecycle_status,
         salary, registered_at
       ) VALUES (
         @enterpriseId, @departmentId, @positionId, @employeeNumber,
         @lastName, @firstName, @middleName, @email, @phone,
         @hireDateTechnical, @employmentStartedAt, @status, @lifecycleStatus,
         @salary, CURRENT_TIMESTAMP
       )`,
    );
    const transaction = this.database.transaction(() => {
      for (const row of evaluation.validRows) {
        const active = Boolean(row.hireDate && row.enterpriseId && row.departmentId && row.positionId);
        try {
          insert.run({
            departmentId: row.departmentId,
            email: row.email,
            employeeNumber: row.employeeNumber,
            employmentStartedAt: active ? row.hireDate : null,
            enterpriseId: row.enterpriseId,
            firstName: row.firstName,
            hireDateTechnical: row.hireDate ?? today(),
            lastName: row.lastName,
            lifecycleStatus: active ? "active" : "pending_assignment",
            middleName: row.middleName,
            phone: row.phone,
            positionId: row.positionId,
            salary: row.salary,
            status: active ? "active" : "pending_assignment",
          });
          importedRows += 1;
        } catch (error) {
          errors.push({ row: row.rowNumber, message: errorMessage(error) });
        }
      }
    });
    transaction();

    this.database
      .prepare(
        `INSERT INTO data_exchange_runs (
           direction, domain, format, file_name, total_rows,
           successful_rows, failed_rows, summary_json
         ) VALUES ('import', 'employees', 'table', ?, ?, ?, ?, ?)`,
      )
      .run(
        this.importCache.get(params.previewId)?.fileName ?? null,
        evaluation.totalRows,
        importedRows,
        evaluation.totalRows - importedRows,
        JSON.stringify({ errors: errors.slice(0, 100) }),
      );

    this.importCache.delete(params.previewId);
    return {
      totalRows: evaluation.totalRows,
      importedRows,
      skippedRows: evaluation.totalRows - importedRows,
      errors: errors.slice(0, 200),
    };
  }

  exportData(params: ExportDataParams, session: AuthSession): { success: true; canceled?: boolean } {
    const table = this.buildExportTable(params.domain, session);
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
    const buffer = params.format === "xlsx"
      ? writeXlsx(table.headers, table.rows)
      : writeCsv(table.headers, table.rows);
    writeFileSync(selected, buffer);
    this.database
      .prepare(
        `INSERT INTO data_exchange_runs (
           direction, domain, format, file_name, total_rows, successful_rows, failed_rows
         ) VALUES ('export', ?, ?, ?, ?, ?, 0)`,
      )
      .run(params.domain, params.format, path.basename(selected), table.rows.length, table.rows.length);
    return { success: true };
  }

  private getLeadershipTarget(
    targetType: "enterprise" | "department",
    targetId: number,
  ): Record<string, unknown> {
    const row = targetType === "enterprise"
      ? this.database
          .prepare(
            `SELECT id, id AS enterprise_id, NULL AS department_id,
                    general_director_employee_id AS leader_id, is_archived
             FROM enterprises WHERE id = ? LIMIT 1`,
          )
          .get(targetId)
      : this.database
          .prepare(
            `SELECT id, enterprise_id, id AS department_id,
                    director_employee_id AS leader_id, is_archived
             FROM departments WHERE id = ? LIMIT 1`,
          )
          .get(targetId);
    if (!row) throw new Error(targetType === "enterprise" ? "Предприятие не найдено" : "Отдел не найден");
    const typed = row as Record<string, unknown>;
    if (Number(typed.is_archived) === 1) throw new Error("Нельзя менять руководителя архивного объекта");
    return typed;
  }

  private assertLeadershipTargetInScope(
    targetType: "enterprise" | "department",
    target: Record<string, unknown>,
    session: AuthSession,
  ): void {
    if (targetType === "enterprise" && session.scopeType === "department") {
      throw new Error("Руководителя предприятия нельзя менять из области отдела");
    }
    this.assertEnterpriseIdInScope(Number(target.enterprise_id), session, targetType === "department");
    if (targetType === "department" && session.scopeType === "department" && Number(target.department_id) !== session.departmentId) {
      throw new Error("Отдел находится вне доступной области данных");
    }
  }

  private clearLeadershipTarget(targetType: "enterprise" | "department", targetId: number): void {
    if (targetType === "enterprise") {
      this.database
        .prepare("UPDATE enterprises SET general_director_employee_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
        .run(targetId);
      return;
    }
    this.database
      .prepare("UPDATE departments SET director_employee_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
      .run(targetId);
  }

  private applyPreviousLeaderOutcome(
    employeeId: number,
    params: HrLeadershipChangeParams,
    session: AuthSession,
  ): void {
    const employee = this.getEmployee(employeeId);
    this.assertEmployeeInScope(employee, session);
    if (params.previousLeaderOutcome === "unassigned") {
      this.database
        .prepare(
          `INSERT INTO employment_history (
             employee_id, change_type, previous_department_id, new_department_id,
             previous_position_id, new_position_id, previous_salary, new_salary,
             effective_at, reason
           ) VALUES (?, 'leadership_removed', ?, ?, NULL, NULL, ?, ?, ?, ?)`,
        )
        .run(
          employeeId,
          employee.department_id ?? null,
          employee.department_id ?? null,
          Number(employee.salary ?? 0),
          Number(employee.salary ?? 0),
          params.effectiveAt,
          params.reason.trim(),
        );
      return;
    }

    const assignment = params.previousLeaderAssignment;
    if (!assignment) {
      throw new Error("Укажите должность или перевод для снятого руководителя");
    }
    this.assertAssignment(assignment.enterpriseId, assignment.departmentId, assignment.positionId);
    this.assertEnterpriseIdInScope(assignment.enterpriseId, session, true);
    if (session.scopeType === "department" && assignment.departmentId !== session.departmentId) {
      throw new Error("Нельзя перевести снятого руководителя за пределы своего отдела");
    }
    if (!Number.isFinite(assignment.salary) || assignment.salary < 0) {
      throw new Error("Укажите корректный оклад снятого руководителя");
    }

    this.database
      .prepare(
        `UPDATE employees
         SET enterprise_id = ?, department_id = ?, position_id = ?, salary = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
      )
      .run(
        assignment.enterpriseId,
        assignment.departmentId,
        assignment.positionId,
        assignment.salary,
        employeeId,
      );
    this.database
      .prepare(
        `UPDATE employment_history
         SET change_type = 'leadership_removed', effective_at = ?, reason = ?
         WHERE id = (
           SELECT id FROM employment_history WHERE employee_id = ? ORDER BY id DESC LIMIT 1
         )`,
      )
      .run(params.effectiveAt, params.reason.trim(), employeeId);
  }

  private resolveNewLeaderEmployment(
    employee: EmployeeContextRow,
    params: HrLeadershipChangeParams,
    target: Record<string, unknown>,
  ): { enterpriseId: number; departmentId: number; salary: number } {
    const supplied = params.newLeaderEmployment;
    const enterpriseId = supplied?.enterpriseId ?? positiveNumber(employee.enterprise_id);
    const departmentId = supplied?.departmentId ?? positiveNumber(employee.department_id);
    const salary = supplied?.salary ?? Number(employee.salary ?? 0);
    if (!enterpriseId || !departmentId) {
      throw new Error("Для назначения руководителя определите предприятие и отдел сотрудника");
    }
    if (params.targetType === "enterprise" && enterpriseId !== Number(target.enterprise_id)) {
      throw new Error("Руководитель предприятия должен быть оформлен в этом предприятии");
    }
    if (params.targetType === "department" && departmentId !== params.targetId) {
      throw new Error("Руководитель отдела должен быть оформлен в этом отделе");
    }
    const department = this.database
      .prepare("SELECT enterprise_id, is_archived FROM departments WHERE id = ? LIMIT 1")
      .get(departmentId) as { enterprise_id: number; is_archived: number } | undefined;
    if (!department || department.is_archived || department.enterprise_id !== enterpriseId) {
      throw new Error("Выбран некорректный отдел для руководителя");
    }
    if (!Number.isFinite(salary) || salary < 0) throw new Error("Укажите корректный оклад руководителя");
    return { enterpriseId, departmentId, salary };
  }

  private assertAssignment(enterpriseId: number, departmentId: number, positionId: number): void {
    const row = this.database
      .prepare(
        `SELECT position.id
         FROM positions AS position
         JOIN departments AS department ON department.id = position.department_id
         JOIN enterprises AS enterprise ON enterprise.id = department.enterprise_id
         WHERE position.id = ? AND department.id = ? AND enterprise.id = ?
           AND position.is_archived = 0 AND department.is_archived = 0 AND enterprise.is_archived = 0
         LIMIT 1`,
      )
      .get(positionId, departmentId, enterpriseId);
    if (!row) throw new Error("Должность не принадлежит выбранному отделу и предприятию");
  }

  private getDocument(id: number, session: AuthSession): EmployeeDocumentSummary {
    const row = this.getDocumentRow(id, session);
    return toDocumentSummary(row);
  }

  private getDocumentRow(id: number, session: AuthSession): Record<string, unknown> {
    const scope = this.employeeScope(session, "employee");
    const row = this.database
      .prepare(
        `SELECT document.*,
                TRIM(employee.last_name || ' ' || employee.first_name || ' ' || COALESCE(employee.middle_name, '')) AS employee_name
         FROM employee_documents AS document
         JOIN employees AS employee ON employee.id = document.employee_id
         WHERE document.id = @id AND (${scope.sql}) LIMIT 1`,
      )
      .get({ id, ...scope.params }) as Record<string, unknown> | undefined;
    if (!row) throw new Error("Документ не найден или находится вне доступной области данных");
    return row;
  }

  private documentStorageRoot(): string {
    const root = path.join(app.getPath("userData"), "employee-documents");
    mkdirSync(root, { recursive: true });
    return root;
  }

  private resolveDocumentPath(relativePath: string): string {
    const root = this.documentStorageRoot();
    const resolved = path.resolve(root, relativePath);
    const rootWithSeparator = `${path.resolve(root)}${path.sep}`;
    if (!resolved.startsWith(rootWithSeparator)) throw new Error("Некорректный путь документа");
    return resolved;
  }

  private calculateWorkingDays(enterpriseId: number, startsAt: string, endsAt: string): number {
    assertDate(startsAt, "Некорректная дата начала отпуска");
    assertDate(endsAt, "Некорректная дата окончания отпуска");
    if (endsAt < startsAt) throw new Error("Дата окончания отпуска раньше даты начала");
    const overrides = this.database
      .prepare(
        `SELECT calendar_date, is_workday FROM work_calendar_days
         WHERE enterprise_id = ? AND calendar_date BETWEEN ? AND ?`,
      )
      .all(enterpriseId, startsAt, endsAt) as Array<{ calendar_date: string; is_workday: number }>;
    const overrideMap = new Map(overrides.map((row) => [row.calendar_date, row.is_workday === 1]));
    let count = 0;
    const cursor = new Date(`${startsAt}T00:00:00Z`);
    const end = new Date(`${endsAt}T00:00:00Z`);
    while (cursor <= end) {
      const date = cursor.toISOString().slice(0, 10);
      const override = overrideMap.get(date);
      const day = cursor.getUTCDay();
      const workday = override ?? (day !== 0 && day !== 6);
      if (workday) count += 1;
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return count;
  }

  private departmentAbsenceWarnings(employee: HrRecord, vacations: HrRecord[]): string[] {
    const departmentId = positiveNumber(employee.department_id);
    if (!departmentId) return [];
    const activeEmployees = this.scalar(
      "SELECT COUNT(*) FROM employees WHERE department_id = @departmentId AND lifecycle_status = 'active'",
      { departmentId },
    );
    if (activeEmployees < 2) return [];
    const threshold = Math.max(2, Math.ceil(activeEmployees * 0.3));
    const warnings: string[] = [];
    for (const vacation of vacations.filter((item) => ["planned", "approved"].includes(String(item.status)))) {
      const absent = this.scalar(
        `SELECT COUNT(DISTINCT vacation.employee_id)
         FROM vacations AS vacation
         JOIN employees AS colleague ON colleague.id = vacation.employee_id
         WHERE colleague.department_id = @departmentId
           AND vacation.status IN ('planned', 'approved')
           AND vacation.starts_at <= @endsAt
           AND vacation.ends_at >= @startsAt`,
        {
          departmentId,
          endsAt: vacation.ends_at,
          startsAt: vacation.starts_at,
        },
      );
      if (absent >= threshold) {
        warnings.push(`На период ${vacation.starts_at} — ${vacation.ends_at} одновременно отсутствуют ${absent} из ${activeEmployees} сотрудников отдела`);
      }
    }
    return [...new Set(warnings)];
  }

  private evaluateEmployeeImport(
    previewId: string,
    columnMap: EmployeeImportColumnMap,
    session: AuthSession,
  ): ImportEvaluation {
    const cached = this.importCache.get(previewId);
    if (!cached) throw new Error("Предпросмотр импорта устарел. Выберите файл заново");
    const lastNameHeader = columnMap.last_name;
    const firstNameHeader = columnMap.first_name;
    if (!lastNameHeader || !firstNameHeader) {
      throw new Error("Сопоставьте обязательные колонки «Фамилия» и «Имя»");
    }
    for (const header of Object.values(columnMap)) {
      if (header && !cached.headers.includes(header)) throw new Error(`Колонка «${header}» отсутствует в выбранном файле`);
    }

    const errors: EmployeeImportError[] = [];
    const validRows: ImportResolvedRow[] = [];
    const seenEmails = new Set<string>();
    const seenNumbers = new Set<string>();
    let duplicateRows = 0;

    cached.rows.forEach((source, index) => {
      const rowNumber = index + 2;
      const rowErrors: string[] = [];
      const lastName = cell(source, columnMap.last_name);
      const firstName = cell(source, columnMap.first_name);
      const middleName = nullableCell(source, columnMap.middle_name);
      const email = nullableCell(source, columnMap.email)?.toLowerCase() ?? null;
      const phone = nullableCell(source, columnMap.phone);
      const employeeNumber = nullableCell(source, columnMap.employee_number);
      const enterpriseName = nullableCell(source, columnMap.enterprise);
      const departmentName = nullableCell(source, columnMap.department);
      const positionName = nullableCell(source, columnMap.position);
      const hireDate = nullableCell(source, (columnMap as Record<string, string | undefined>).hire_date);
      const salaryText = nullableCell(source, (columnMap as Record<string, string | undefined>).salary);
      const salary = salaryText ? Number(salaryText.replace(/\s/g, "").replace(",", ".")) : 0;

      if (!lastName) rowErrors.push("не указана фамилия");
      if (!firstName) rowErrors.push("не указано имя");
      if (hireDate && !/^\d{4}-\d{2}-\d{2}$/.test(hireDate)) rowErrors.push("дата приёма должна быть в формате ГГГГ-ММ-ДД");
      if (!Number.isFinite(salary) || salary < 0) rowErrors.push("некорректный оклад");

      let enterpriseId = enterpriseName ? this.lookupEnterpriseId(enterpriseName) : session.enterpriseId;
      let departmentId = departmentName ? this.lookupDepartmentId(departmentName, enterpriseId) : session.departmentId;
      let positionId = positionName ? this.lookupPositionId(positionName, departmentId) : null;

      if (enterpriseName && !enterpriseId) rowErrors.push(`предприятие «${enterpriseName}» не найдено`);
      if (departmentName && !departmentId) rowErrors.push(`отдел «${departmentName}» не найден в выбранном предприятии`);
      if (positionName && !positionId) rowErrors.push(`должность «${positionName}» не найдена в выбранном отделе`);
      if (session.scopeType === "enterprise" && enterpriseId && enterpriseId !== session.enterpriseId) {
        rowErrors.push("предприятие находится вне доступной области данных");
      }
      if (session.scopeType === "department" && departmentId && departmentId !== session.departmentId) {
        rowErrors.push("отдел находится вне доступной области данных");
      }

      let duplicate = false;
      if (email) {
        if (seenEmails.has(email) || this.emailExists(email)) duplicate = true;
        seenEmails.add(email);
      }
      if (employeeNumber) {
        const normalized = employeeNumber.toLowerCase();
        if (seenNumbers.has(normalized) || this.employeeNumberExists(employeeNumber)) duplicate = true;
        seenNumbers.add(normalized);
      }
      if (duplicate) {
        duplicateRows += 1;
        rowErrors.push("обнаружен дубликат по e-mail или табельному номеру");
      }

      if (rowErrors.length > 0) {
        errors.push({ row: rowNumber, message: rowErrors.join("; ") });
        return;
      }
      validRows.push({
        rowNumber,
        source,
        lastName,
        firstName,
        middleName,
        email,
        phone,
        employeeNumber,
        enterpriseId: enterpriseId ?? null,
        departmentId: departmentId ?? null,
        positionId: positionId ?? null,
        hireDate,
        salary,
      });
    });

    return { totalRows: cached.rows.length, duplicateRows, errors, validRows };
  }

  private buildExportTable(
    domain: DataExportDomain,
    session: AuthSession,
  ): { headers: string[]; rows: TabularRow[] } {
    const employeeScope = this.employeeScope(session, "employee");
    if (domain === "employees") {
      const headers = ["ID", "Табельный номер", "Фамилия", "Имя", "Отчество", "Предприятие", "Отдел", "Должность", "Статус", "Дата приёма", "Оклад", "Телефон", "Email"];
      const rows = this.database
        .prepare(
          `SELECT employee.id AS "ID", employee.employee_number AS "Табельный номер",
                  employee.last_name AS "Фамилия", employee.first_name AS "Имя", employee.middle_name AS "Отчество",
                  enterprise.name AS "Предприятие", department.name AS "Отдел", position.name AS "Должность",
                  employee.lifecycle_status AS "Статус", employee.employment_started_at AS "Дата приёма",
                  employee.salary AS "Оклад", employee.phone AS "Телефон", employee.email AS "Email"
           FROM employees AS employee
           LEFT JOIN enterprises AS enterprise ON enterprise.id = employee.enterprise_id
           LEFT JOIN departments AS department ON department.id = employee.department_id
           LEFT JOIN positions AS position ON position.id = employee.position_id
           WHERE (${employeeScope.sql}) ORDER BY employee.last_name, employee.first_name`,
        )
        .all(employeeScope.params) as TabularRow[];
      return { headers, rows };
    }

    if (domain === "organization") {
      const headers = ["Тип", "ID", "Название", "Родитель", "Статус"];
      const departmentScope = this.departmentScope(session, "department");
      const enterpriseRows = session.scopeType === "global"
        ? (this.database.prepare(`SELECT 'Предприятие' AS "Тип", id AS "ID", name AS "Название", '' AS "Родитель", CASE is_archived WHEN 1 THEN 'Архив' ELSE 'Активно' END AS "Статус" FROM enterprises`).all() as TabularRow[])
        : (this.database.prepare(`SELECT 'Предприятие' AS "Тип", id AS "ID", name AS "Название", '' AS "Родитель", CASE is_archived WHEN 1 THEN 'Архив' ELSE 'Активно' END AS "Статус" FROM enterprises WHERE id = ?`).all(session.enterpriseId) as TabularRow[]);
      const departmentRows = this.database
        .prepare(
          `SELECT 'Отдел' AS "Тип", department.id AS "ID", department.name AS "Название", enterprise.name AS "Родитель",
                  CASE department.is_archived WHEN 1 THEN 'Архив' ELSE 'Активно' END AS "Статус"
           FROM departments AS department JOIN enterprises AS enterprise ON enterprise.id = department.enterprise_id
           WHERE (${departmentScope.sql})`,
        )
        .all(departmentScope.params) as TabularRow[];
      const positionScope = this.positionScope(session, "position", "department");
      const positionRows = this.database
        .prepare(
          `SELECT 'Должность' AS "Тип", position.id AS "ID", position.name AS "Название", department.name AS "Родитель",
                  CASE position.is_archived WHEN 1 THEN 'Архив' ELSE 'Активно' END AS "Статус"
           FROM positions AS position JOIN departments AS department ON department.id = position.department_id
           WHERE (${positionScope.sql})`,
        )
        .all(positionScope.params) as TabularRow[];
      return { headers, rows: [...enterpriseRows, ...departmentRows, ...positionRows] };
    }

    if (domain === "vacations") {
      const headers = ["ID", "Сотрудник", "Вид", "Начало", "Окончание", "Календарные дни", "Рабочие дни", "Статус", "Основание"];
      const rows = this.database
        .prepare(
          `SELECT vacation.id AS "ID",
                  TRIM(employee.last_name || ' ' || employee.first_name) AS "Сотрудник",
                  vacation_type.name AS "Вид", vacation.starts_at AS "Начало", vacation.ends_at AS "Окончание",
                  vacation.days_count AS "Календарные дни", vacation.working_days_count AS "Рабочие дни",
                  vacation.status AS "Статус", vacation.reason AS "Основание"
           FROM vacations AS vacation
           JOIN employees AS employee ON employee.id = vacation.employee_id
           LEFT JOIN vacation_types AS vacation_type ON vacation_type.id = vacation.vacation_type_id
           WHERE (${employeeScope.sql}) ORDER BY vacation.starts_at DESC`,
        )
        .all(employeeScope.params) as TabularRow[];
      return { headers, rows };
    }

    if (domain === "employment_history") {
      const headers = ["ID", "Сотрудник", "Событие", "Дата", "Основание", "Предыдущий отдел", "Новый отдел", "Предыдущая должность", "Новая должность"];
      const rows = this.database
        .prepare(
          `SELECT history.id AS "ID", TRIM(employee.last_name || ' ' || employee.first_name) AS "Сотрудник",
                  history.change_type AS "Событие", history.effective_at AS "Дата", history.reason AS "Основание",
                  previous_department.name AS "Предыдущий отдел", next_department.name AS "Новый отдел",
                  previous_position.name AS "Предыдущая должность", next_position.name AS "Новая должность"
           FROM employment_history AS history
           JOIN employees AS employee ON employee.id = history.employee_id
           LEFT JOIN departments AS previous_department ON previous_department.id = history.previous_department_id
           LEFT JOIN departments AS next_department ON next_department.id = history.new_department_id
           LEFT JOIN positions AS previous_position ON previous_position.id = history.previous_position_id
           LEFT JOIN positions AS next_position ON next_position.id = history.new_position_id
           WHERE (${employeeScope.sql}) ORDER BY history.effective_at DESC, history.id DESC`,
        )
        .all(employeeScope.params) as TabularRow[];
      return { headers, rows };
    }

    if (domain === "vacancies") {
      const headers = ["ID", "Должность", "Отдел", "Статус", "Количество мест", "Тип занятости", "Создано"];
      const scope = this.vacancyScope(session, "vacancy", "position", "department");
      const rows = this.database
        .prepare(
          `SELECT vacancy.id AS "ID", position.name AS "Должность", department.name AS "Отдел",
                  vacancy.status AS "Статус", vacancy.openings_count AS "Количество мест",
                  vacancy.employment_type AS "Тип занятости", vacancy.created_at AS "Создано"
           FROM vacancies AS vacancy
           JOIN positions AS position ON position.id = vacancy.position_id
           JOIN departments AS department ON department.id = position.department_id
           WHERE (${scope.sql}) ORDER BY vacancy.created_at DESC`,
        )
        .all(scope.params) as TabularRow[];
      return { headers, rows };
    }

    const headers = ["ID", "Дата", "Пользователь", "Действие", "Сущность", "ID сущности"];
    const auditScope = this.auditScope(session, "audit");
    const rows = this.database
      .prepare(
        `SELECT audit.id AS "ID", audit.occurred_at AS "Дата", audit.actor_username AS "Пользователь",
                audit.action AS "Действие", audit.entity_type AS "Сущность", audit.entity_id AS "ID сущности"
         FROM audit_events AS audit WHERE (${auditScope.sql}) ORDER BY audit.occurred_at DESC`,
      )
      .all(auditScope.params) as TabularRow[];
    return { headers, rows };
  }

  private employeeScope(session: AuthSession, alias: string): ScopedSql {
    if (session.scopeType === "global") return { sql: "1 = 1", params: {} };
    if (session.scopeType === "enterprise") {
      return { sql: `${alias}.enterprise_id = @scopeEnterpriseId`, params: { scopeEnterpriseId: session.enterpriseId } };
    }
    if (session.scopeType === "department") {
      return { sql: `${alias}.department_id = @scopeDepartmentId`, params: { scopeDepartmentId: session.departmentId } };
    }
    return { sql: `${alias}.id = @scopeEmployeeId`, params: { scopeEmployeeId: session.employeeId } };
  }

  private departmentScope(session: AuthSession, alias: string): ScopedSql {
    if (session.scopeType === "global") return { sql: "1 = 1", params: {} };
    if (session.scopeType === "enterprise") {
      return { sql: `${alias}.enterprise_id = @scopeEnterpriseId`, params: { scopeEnterpriseId: session.enterpriseId } };
    }
    return { sql: `${alias}.id = @scopeDepartmentId`, params: { scopeDepartmentId: session.departmentId } };
  }

  private positionScope(session: AuthSession, positionAlias: string, departmentAlias: string): ScopedSql {
    if (session.scopeType === "global") return { sql: "1 = 1", params: {} };
    if (session.scopeType === "enterprise") {
      return { sql: `${departmentAlias}.enterprise_id = @scopeEnterpriseId`, params: { scopeEnterpriseId: session.enterpriseId } };
    }
    return { sql: `${positionAlias}.department_id = @scopeDepartmentId`, params: { scopeDepartmentId: session.departmentId } };
  }

  private vacancyScope(
    session: AuthSession,
    _vacancyAlias: string,
    positionAlias: string,
    departmentAlias: string,
  ): ScopedSql {
    return this.positionScope(session, positionAlias, departmentAlias);
  }

  private auditScope(session: AuthSession, alias: string): ScopedSql {
    if (session.scopeType === "global") return { sql: "1 = 1", params: {} };
    if (session.scopeType === "enterprise") {
      return { sql: `${alias}.enterprise_id = @scopeEnterpriseId`, params: { scopeEnterpriseId: session.enterpriseId } };
    }
    if (session.scopeType === "department") {
      return { sql: `${alias}.department_id = @scopeDepartmentId`, params: { scopeDepartmentId: session.departmentId } };
    }
    return { sql: "1 = 0", params: {} };
  }

  private assertEmployeeInScope(employee: HrRecord, session: AuthSession): void {
    const id = Number(employee.id);
    if (session.scopeType === "global") return;
    if (session.scopeType === "enterprise" && Number(employee.enterprise_id) === session.enterpriseId) return;
    if (session.scopeType === "department" && Number(employee.department_id) === session.departmentId) return;
    if (session.scopeType === "self" && id === session.employeeId) return;
    throw new Error("Сотрудник находится вне доступной области данных");
  }

  private assertEnterpriseIdInScope(
    enterpriseId: number,
    session: AuthSession,
    allowDepartment: boolean,
  ): void {
    if (session.scopeType === "global") return;
    if (session.enterpriseId === enterpriseId && (allowDepartment || session.scopeType !== "department")) return;
    throw new Error("Предприятие находится вне доступной области данных");
  }

  private getEmployee(employeeId: number): EmployeeContextRow {
    const row = this.database
      .prepare("SELECT * FROM employees WHERE id = ? LIMIT 1")
      .get(employeeId) as EmployeeContextRow | undefined;
    if (!row) throw new Error("Сотрудник не найден");
    return row;
  }

  private lookupEnterpriseId(name: string): number | null {
    const row = this.database
      .prepare("SELECT id FROM enterprises WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) AND is_archived = 0 LIMIT 1")
      .get(name) as { id: number } | undefined;
    return row?.id ?? null;
  }

  private lookupDepartmentId(name: string, enterpriseId: number | null): number | null {
    if (!enterpriseId) return null;
    const row = this.database
      .prepare("SELECT id FROM departments WHERE enterprise_id = ? AND LOWER(TRIM(name)) = LOWER(TRIM(?)) AND is_archived = 0 LIMIT 1")
      .get(enterpriseId, name) as { id: number } | undefined;
    return row?.id ?? null;
  }

  private lookupPositionId(name: string, departmentId: number | null): number | null {
    if (!departmentId) return null;
    const row = this.database
      .prepare("SELECT id FROM positions WHERE department_id = ? AND LOWER(TRIM(name)) = LOWER(TRIM(?)) AND is_archived = 0 LIMIT 1")
      .get(departmentId, name) as { id: number } | undefined;
    return row?.id ?? null;
  }

  private emailExists(email: string): boolean {
    return Boolean(
      this.database
        .prepare("SELECT 1 FROM all_registered_emails WHERE normalized_email = LOWER(TRIM(?)) LIMIT 1")
        .get(email),
    );
  }

  private employeeNumberExists(employeeNumber: string): boolean {
    return Boolean(
      this.database
        .prepare("SELECT 1 FROM employees WHERE LOWER(TRIM(employee_number)) = LOWER(TRIM(?)) LIMIT 1")
        .get(employeeNumber),
    );
  }

  private scalar(sql: string, params: Record<string, unknown> = {}): number {
    const value = this.database.prepare(sql).pluck().get(params) as unknown;
    return Number(value ?? 0);
  }

  private scalarNullable(sql: string, params: Record<string, unknown> = {}): number | null {
    const value = this.database.prepare(sql).pluck().get(params) as unknown;
    if (value === null || value === undefined) return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  private series(sql: string, params: Record<string, unknown>): AnalyticsSeriesPoint[] {
    const rows = this.database.prepare(sql).all(params) as Array<{ label: string | null; value: number | null }>;
    return rows.map((row) => ({ label: row.label ?? "Не указано", value: Number(row.value ?? 0) }));
  }

  private trimImportCache(): void {
    while (this.importCache.size > 5) {
      const firstKey = this.importCache.keys().next().value as string | undefined;
      if (!firstKey) break;
      this.importCache.delete(firstKey);
    }
  }
}

function toDocumentSummary(row: Record<string, unknown>): EmployeeDocumentSummary {
  return {
    id: Number(row.id),
    employeeId: Number(row.employee_id),
    employmentHistoryId: positiveNumber(row.employment_history_id),
    employeeName: String(row.employee_name ?? "").trim(),
    documentType: String(row.document_type ?? ""),
    title: String(row.title ?? ""),
    originalName: String(row.original_name ?? ""),
    mimeType: row.mime_type ? String(row.mime_type) : null,
    sizeBytes: Number(row.size_bytes ?? 0),
    sha256: String(row.sha256 ?? ""),
    issuedAt: nullableDate(row.issued_at),
    expiresAt: nullableDate(row.expires_at),
    status: String(row.status) === "deleted" ? "deleted" : "active",
    createdAt: String(row.created_at ?? ""),
  };
}

function sha256File(filePath: string): string {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function mimeTypeForExtension(extension: string): string | null {
  const types: Record<string, string> = {
    ".pdf": "application/pdf",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xls": "application/vnd.ms-excel",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".txt": "text/plain",
  };
  return types[extension] ?? null;
}

function attention(
  id: string,
  type: string,
  severity: AttentionItem["severity"],
  title: string,
  description: string,
  targetPath: string,
  dueDate: string | null,
): AttentionItem {
  return { id, type, severity, title, description, path: targetPath, dueDate };
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

function positiveNumber(value: unknown): number | null {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function mapPreviousLeaderOutcome(
  value: HrLeadershipChangeParams["previousLeaderOutcome"],
): "unassigned" | "keep_assignment" | "transfer" {
  if (value === "assign_position") return "keep_assignment";
  if (value === "transfer") return "transfer";
  return "unassigned";
}

function assertDate(value: string, message: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(message);
}

function normalizeYear(value: number): number {
  const year = Math.floor(value);
  if (year < 2000 || year > 2200) throw new Error("Укажите корректный год");
  return year;
}

function roundNullable(value: number | null, digits: number): number | null {
  if (value === null) return null;
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function cell(source: Record<string, string>, header?: string): string {
  return header ? String(source[header] ?? "").trim() : "";
}

function nullableCell(source: Record<string, string>, header?: string): string | null {
  const value = cell(source, header);
  return value || null;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
