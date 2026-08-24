import type Database from "better-sqlite3";
import type {
  EmployeeWorkspaceData,
  EmployeeWorkspaceDepartment,
  EmployeeWorkspaceEnterprise,
  EmployeeWorkspacePerson,
  EmployeeWorkspaceSelf,
} from "../../src/shared/types/employeeWorkspace";

interface WorkspaceRow {
  id: number;
  last_name: string | null;
  first_name: string | null;
  middle_name: string | null;
  email: string | null;
  hire_date: string | null;
  employment_type: string | null;
  workplace: string | null;
  position_name: string | null;
  department_id: number | null;
  department_name: string | null;
  department_email: string | null;
  department_phone: string | null;
  department_location: string | null;
  department_director_employee_id: number | null;
  enterprise_id: number | null;
  enterprise_name: string | null;
  enterprise_legal_name: string | null;
  enterprise_email: string | null;
  enterprise_phone: string | null;
  enterprise_address: string | null;
  enterprise_director_employee_id: number | null;
}

interface DirectoryPersonRow {
  id: number;
  last_name: string | null;
  first_name: string | null;
  middle_name: string | null;
  email: string | null;
  position_name: string | null;
  department_id: number | null;
  department_name: string | null;
}

export class EmployeeWorkspaceService {
  constructor(private readonly database: Database.Database) {}

  getWorkspace(employeeId: number): EmployeeWorkspaceData {
    if (!Number.isInteger(employeeId) || employeeId < 1) {
      throw new Error("Рабочее пространство доступно только сотрудникам");
    }

    const row = this.database
      .prepare(
        `SELECT
           employee.id,
           employee.last_name,
           employee.first_name,
           employee.middle_name,
           employee.email,
           employee.hire_date,
           employee.employment_type,
           employee.workplace,
           position.name AS position_name,
           department.id AS department_id,
           department.name AS department_name,
           department.email AS department_email,
           department.phone AS department_phone,
           department.location AS department_location,
           department.director_employee_id AS department_director_employee_id,
           enterprise.id AS enterprise_id,
           enterprise.name AS enterprise_name,
           enterprise.legal_name AS enterprise_legal_name,
           enterprise.email AS enterprise_email,
           enterprise.phone AS enterprise_phone,
           enterprise.address AS enterprise_address,
           enterprise.general_director_employee_id AS enterprise_director_employee_id
         FROM employees AS employee
         LEFT JOIN positions AS position ON position.id = employee.position_id
         LEFT JOIN departments AS department ON department.id = employee.department_id
         LEFT JOIN enterprises AS enterprise ON enterprise.id = department.enterprise_id
         WHERE employee.id = ?
         LIMIT 1`,
      )
      .get(employeeId) as WorkspaceRow | undefined;

    if (!row) throw new Error("Карточка сотрудника не найдена");

    const self: EmployeeWorkspaceSelf = {
      id: row.id,
      fullName: personName(row),
      email: nullableText(row.email),
      positionName: nullableText(row.position_name),
      departmentId: positiveId(row.department_id),
      departmentName: nullableText(row.department_name),
      enterpriseId: positiveId(row.enterprise_id),
      enterpriseName: nullableText(row.enterprise_name),
      hireDate: nullableText(row.hire_date),
      employmentType: nullableText(row.employment_type),
      workplace: nullableText(row.workplace),
    };

    const enterprise = this.mapEnterprise(row);
    const department = this.mapDepartment(row);
    const colleagues = row.enterprise_id
      ? this.listEnterpriseColleagues(row.enterprise_id, employeeId, row.department_id)
      : [];

    return {
      self,
      enterprise,
      department,
      enterpriseLeader: this.getPerson(row.enterprise_director_employee_id),
      departmentLeader: this.getPerson(row.department_director_employee_id),
      colleagues,
    };
  }

  private listEnterpriseColleagues(
    enterpriseId: number,
    employeeId: number,
    ownDepartmentId: number | null,
  ): EmployeeWorkspacePerson[] {
    const rows = this.database
      .prepare(
        `SELECT
           employee.id,
           employee.last_name,
           employee.first_name,
           employee.middle_name,
           employee.email,
           position.name AS position_name,
           department.id AS department_id,
           department.name AS department_name
         FROM employees AS employee
         JOIN departments AS department ON department.id = employee.department_id
         LEFT JOIN positions AS position ON position.id = employee.position_id
         WHERE department.enterprise_id = @enterpriseId
           AND employee.status = 'active'
           AND employee.id <> @employeeId
         ORDER BY
           CASE WHEN department.id IS @ownDepartmentId THEN 0 ELSE 1 END,
           department.name COLLATE NOCASE,
           employee.last_name COLLATE NOCASE,
           employee.first_name COLLATE NOCASE`,
      )
      .all({ enterpriseId, employeeId, ownDepartmentId }) as DirectoryPersonRow[];

    return rows.map(mapPerson);
  }

  private getPerson(employeeId: number | null): EmployeeWorkspacePerson | null {
    if (!employeeId) return null;

    const row = this.database
      .prepare(
        `SELECT
           employee.id,
           employee.last_name,
           employee.first_name,
           employee.middle_name,
           employee.email,
           position.name AS position_name,
           department.id AS department_id,
           department.name AS department_name
         FROM employees AS employee
         LEFT JOIN positions AS position ON position.id = employee.position_id
         LEFT JOIN departments AS department ON department.id = employee.department_id
         WHERE employee.id = ?
         LIMIT 1`,
      )
      .get(employeeId) as DirectoryPersonRow | undefined;

    return row ? mapPerson(row) : null;
  }

  private mapEnterprise(row: WorkspaceRow): EmployeeWorkspaceEnterprise | null {
    const id = positiveId(row.enterprise_id);
    if (!id || !row.enterprise_name) return null;
    return {
      id,
      name: row.enterprise_name,
      legalName: nullableText(row.enterprise_legal_name),
      email: nullableText(row.enterprise_email),
      phone: nullableText(row.enterprise_phone),
      address: nullableText(row.enterprise_address),
    };
  }

  private mapDepartment(row: WorkspaceRow): EmployeeWorkspaceDepartment | null {
    const id = positiveId(row.department_id);
    if (!id || !row.department_name) return null;
    return {
      id,
      name: row.department_name,
      email: nullableText(row.department_email),
      phone: nullableText(row.department_phone),
      location: nullableText(row.department_location),
    };
  }
}

function mapPerson(row: DirectoryPersonRow): EmployeeWorkspacePerson {
  return {
    id: row.id,
    fullName: personName(row),
    email: nullableText(row.email),
    positionName: nullableText(row.position_name),
    departmentId: positiveId(row.department_id),
    departmentName: nullableText(row.department_name),
  };
}

function personName(row: {
  last_name: string | null;
  first_name: string | null;
  middle_name: string | null;
}): string {
  return [row.last_name, row.first_name, row.middle_name]
    .map((value) => nullableText(value))
    .filter((value): value is string => Boolean(value))
    .join(" ") || "Сотрудник";
}

function nullableText(value: unknown): string | null {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function positiveId(value: unknown): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}
