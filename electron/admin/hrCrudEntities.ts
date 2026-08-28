import type { HrEntityKey } from "../../src/shared/types/hr";

export interface HrCrudEntityConfig {
  key: HrEntityKey;
  tableName: string;
  primaryKey: string;
  allowedColumns: string[];
  searchableColumns: string[];
  defaultOrderBy: string;
  hasUpdatedAt: boolean;
  listColumns: Record<string, string>;
}

function entity(
  key: HrEntityKey,
  allowedColumns: string[],
  searchableColumns: string[],
  options: Partial<
    Pick<
      HrCrudEntityConfig,
      "defaultOrderBy" | "hasUpdatedAt" | "listColumns"
    >
  > = {},
): HrCrudEntityConfig {
  return {
    key,
    tableName: key,
    primaryKey: "id",
    allowedColumns: ["id", ...allowedColumns],
    searchableColumns,
    defaultOrderBy: options.defaultOrderBy ?? "id",
    hasUpdatedAt: options.hasUpdatedAt ?? true,
    listColumns: options.listColumns ?? {},
  };
}

const employeeFullName = (employeeAlias: string): string =>
  `TRIM(
    COALESCE(${employeeAlias}.last_name, '') || ' ' ||
    COALESCE(${employeeAlias}.first_name, '') || ' ' ||
    COALESCE(${employeeAlias}.middle_name, '')
  )`;

export const hrCrudEntities: Record<HrEntityKey, HrCrudEntityConfig> = {
  enterprises: entity(
    "enterprises",
    [
      "name",
      "legal_form",
      "legal_name",
      "registration_number",
      "general_director_employee_id",
      "phone",
      "email",
      "address",
    ],
    [
      "name",
      "legal_form",
      "legal_name",
      "registration_number",
      "phone",
      "email",
      "address",
    ],
    {
      defaultOrderBy: "name",
      listColumns: {
        general_director_name: `(SELECT ${employeeFullName("director")}
          FROM employees AS director
          WHERE director.id = enterprises.general_director_employee_id)`,
      },
    },
  ),

  departments: entity(
    "departments",
    [
      "enterprise_id",
      "director_employee_id",
      "name",
      "phone",
      "email",
      "location",
      "created_on",
    ],
    ["name", "phone", "email", "location"],
    {
      defaultOrderBy: "name",
      listColumns: {
        enterprise_name: `(SELECT enterprise.name
          FROM enterprises AS enterprise
          WHERE enterprise.id = departments.enterprise_id)`,
        director_name: `(SELECT ${employeeFullName("director")}
          FROM employees AS director
          WHERE director.id = departments.director_employee_id)`,
      },
    },
  ),

  positions: entity(
    "positions",
    ["department_id", "name", "responsibilities"],
    ["name", "responsibilities"],
    {
      defaultOrderBy: "name",
      listColumns: {
        department_name: `(SELECT department.name
          FROM departments AS department
          WHERE department.id = positions.department_id)`,
        enterprise_name: `(SELECT enterprise.name
          FROM departments AS department
          JOIN enterprises AS enterprise ON enterprise.id = department.enterprise_id
          WHERE department.id = positions.department_id)`,
      },
    },
  ),

  employees: entity(
    "employees",
    [
      "enterprise_id",
      "department_id",
      "position_id",
      "employee_number",
      "last_name",
      "first_name",
      "middle_name",
      "birth_date",
      "gender",
      "address",
      "address_country",
      "address_city",
      "address_street",
      "address_house",
      "address_apartment",
      "phone",
      "email",
      "hire_date",
      "status",
      "lifecycle_status",
      "employment_started_at",
      "registered_at",
      "salary",
      "employment_type",
      "contract_number",
      "contract_date",
      "contract_end_date",
      "probation_end_date",
      "workplace",
      "terminated_at",
      "termination_reason",
    ],
    [
      "employee_number",
      "last_name",
      "first_name",
      "middle_name",
      "phone",
      "email",
      "address",
      "address_city",
      "address_street",
    ],
    {
      defaultOrderBy: "last_name",
      listColumns: {
        department_name: `CASE
          WHEN EXISTS (
            SELECT 1 FROM enterprises AS leadership_enterprise
            WHERE leadership_enterprise.general_director_employee_id = employees.id
          ) THEN NULL
          ELSE (
            SELECT department.name
            FROM departments AS department
            WHERE department.id = employees.department_id
          )
        END`,
        position_name: `CASE
          WHEN EXISTS (
            SELECT 1 FROM enterprises AS leadership_enterprise
            WHERE leadership_enterprise.general_director_employee_id = employees.id
          ) THEN 'Директор предприятия'
          WHEN EXISTS (
            SELECT 1 FROM departments AS leadership_department
            WHERE leadership_department.director_employee_id = employees.id
          ) THEN 'Руководитель отдела'
          ELSE (
            SELECT position.name
            FROM positions AS position
            WHERE position.id = employees.position_id
          )
        END`,
        enterprise_name: `COALESCE(
          (
            SELECT leadership_enterprise.name
            FROM enterprises AS leadership_enterprise
            WHERE leadership_enterprise.general_director_employee_id = employees.id
            LIMIT 1
          ),
          (
            SELECT enterprise.name
            FROM enterprises AS enterprise
            WHERE enterprise.id = employees.enterprise_id
          ),
          (
            SELECT enterprise.name
            FROM departments AS department
            JOIN enterprises AS enterprise ON enterprise.id = department.enterprise_id
            WHERE department.id = employees.department_id
          )
        )`,
      },
    },
  ),

  employee_education: entity(
    "employee_education",
    [
      "employee_id",
      "education_type",
      "education_degree",
      "institution_name",
      "speciality",
      "started_at",
      "ended_at",
      "document_number",
    ],
    ["institution_name", "speciality", "document_number"],
    { defaultOrderBy: "started_at" },
  ),

  employee_experience: entity(
    "employee_experience",
    [
      "employee_id",
      "company_name",
      "position_name",
      "started_at",
      "ended_at",
      "is_current",
      "responsibilities",
    ],
    ["company_name", "position_name", "responsibilities"],
    { defaultOrderBy: "started_at" },
  ),

  employment_history: entity(
    "employment_history",
    [
      "employee_id",
      "change_type",
      "previous_department_id",
      "new_department_id",
      "previous_position_id",
      "new_position_id",
      "previous_salary",
      "new_salary",
      "effective_at",
      "reason",
    ],
    ["change_type", "reason"],
    {
      defaultOrderBy: "effective_at",
      hasUpdatedAt: false,
      listColumns: {
        employee_name: `(SELECT ${employeeFullName("employee")}
          FROM employees AS employee
          WHERE employee.id = employment_history.employee_id)`,
        previous_department_name: `(SELECT department.name
          FROM departments AS department
          WHERE department.id = employment_history.previous_department_id)`,
        new_department_name: `(SELECT department.name
          FROM departments AS department
          WHERE department.id = employment_history.new_department_id)`,
        previous_position_name: `(SELECT position.name
          FROM positions AS position
          WHERE position.id = employment_history.previous_position_id)`,
        new_position_name: `(SELECT position.name
          FROM positions AS position
          WHERE position.id = employment_history.new_position_id)`,
      },
    },
  ),

  vacation_types: entity(
    "vacation_types",
    ["enterprise_id", "name", "is_paid_default", "is_active"],
    ["name"],
    {
      defaultOrderBy: "name",
      listColumns: {
        enterprise_name: `(SELECT enterprise.name
          FROM enterprises AS enterprise
          WHERE enterprise.id = vacation_types.enterprise_id)`,
      },
    },
  ),

  vacations: entity(
    "vacations",
    [
      "employee_id",
      "vacation_type_id",
      "starts_at",
      "ends_at",
      "days_count",
      "is_paid",
      "reason",
      "status",
      "decision_comment",
      "approved_at",
      "approved_by_account_type",
      "approved_by_account_id",
      "approved_by_name",
    ],
    ["reason", "status", "decision_comment"],
    {
      defaultOrderBy: "starts_at",
      listColumns: {
        employee_name: `(SELECT ${employeeFullName("employee")}
          FROM employees AS employee
          WHERE employee.id = vacations.employee_id)`,
        vacation_type_name: `(SELECT vacation_type.name
          FROM vacation_types AS vacation_type
          WHERE vacation_type.id = vacations.vacation_type_id)`,
      },
    },
  ),
};

export function getHrCrudEntityConfig(
  entityKey: HrEntityKey,
): HrCrudEntityConfig {
  const config = hrCrudEntities[entityKey];

  if (!config) {
    throw new Error(`Неизвестная HR-сущность: ${entityKey}`);
  }

  return config;
}
