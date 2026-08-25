import { dialog } from "electron";
import { writeFileSync } from "node:fs";
import type Database from "better-sqlite3";
import type { AccessScopeType } from "../../src/shared/types/access";

export interface EmployeeExportScope {
  scopeType: AccessScopeType;
  enterpriseId: number | null;
  departmentId: number | null;
}

export class AdminDataService {
  constructor(private readonly database: Database.Database) {}

  exportEmployeesCsv(
    scope: EmployeeExportScope = {
      scopeType: "global",
      enterpriseId: null,
      departmentId: null,
    },
  ): { success: true; canceled?: boolean } {
    if (scope.scopeType === "self") {
      throw new Error("Экспорт сотрудников недоступен в личной области данных");
    }
    if (scope.scopeType === "enterprise" && !scope.enterpriseId) {
      throw new Error("Для экспорта не определено предприятие");
    }
    if (scope.scopeType === "department" && !scope.departmentId) {
      throw new Error("Для экспорта не определён отдел");
    }

    const result = dialog.showSaveDialogSync({
      title: "Экспорт сотрудников",
      defaultPath: `employees-${new Date().toISOString().slice(0, 10)}.csv`,
      filters: [{ name: "CSV", extensions: ["csv"] }],
    });
    if (!result) return { success: true, canceled: true };

    const whereSql =
      scope.scopeType === "enterprise"
        ? "WHERE COALESCE(employee.enterprise_id, department.enterprise_id) = @enterpriseId"
        : scope.scopeType === "department"
          ? "WHERE employee.department_id = @departmentId"
          : "";
    const statement = this.database.prepare(
      `SELECT
         employee.employee_number,
         employee.last_name,
         employee.first_name,
         employee.middle_name,
         employee.email,
         employee.phone,
         enterprise.legal_form,
         enterprise.name AS enterprise_name,
         department.name AS department_name,
         position.name AS position_name,
         employee.hire_date,
         employee.employment_type,
         employee.salary,
         employee.status,
         employee.contract_number,
         employee.contract_date,
         employee.contract_end_date,
         employee.probation_end_date,
         employee.workplace,
         employee.terminated_at,
         employee.termination_reason
       FROM employees AS employee
       LEFT JOIN departments AS department ON department.id = employee.department_id
       LEFT JOIN enterprises AS enterprise
         ON enterprise.id = COALESCE(employee.enterprise_id, department.enterprise_id)
       LEFT JOIN positions AS position ON position.id = employee.position_id
       ${whereSql}
       ORDER BY employee.last_name, employee.first_name`,
    );
    const rows = (
      scope.scopeType === "global"
        ? statement.all()
        : statement.all({
            enterpriseId: scope.enterpriseId,
            departmentId: scope.departmentId,
          })
    ) as Array<Record<string, unknown>>;

    const headers = [
      "Табельный номер",
      "Фамилия",
      "Имя",
      "Отчество",
      "Email",
      "Телефон",
      "Категория предприятия",
      "Предприятие",
      "Отдел",
      "Должность",
      "Дата приёма",
      "Тип занятости",
      "Оклад",
      "Статус",
      "Номер договора",
      "Дата договора",
      "Окончание договора",
      "Окончание испытательного срока",
      "Место работы",
      "Дата увольнения",
      "Основание увольнения",
    ];
    const keys = [
      "employee_number",
      "last_name",
      "first_name",
      "middle_name",
      "email",
      "phone",
      "legal_form",
      "enterprise_name",
      "department_name",
      "position_name",
      "hire_date",
      "employment_type",
      "salary",
      "status",
      "contract_number",
      "contract_date",
      "contract_end_date",
      "probation_end_date",
      "workplace",
      "terminated_at",
      "termination_reason",
    ];

    const csv = [
      headers.map(csvCell).join(";"),
      ...rows.map((row) => keys.map((key) => csvCell(row[key])).join(";")),
    ].join("\r\n");
    writeFileSync(result, `\uFEFF${csv}`, "utf8");
    return { success: true };
  }
}

function csvCell(value: unknown): string {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}
