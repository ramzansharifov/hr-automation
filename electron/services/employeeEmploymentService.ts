import type {
  EmployeeDuplicateCheckParams,
  EmployeeDuplicateCheckResult,
  HrRecord,
  HrRehireParams,
} from "../../src/shared/types/hr";
import { getHrCrudEntityConfig } from "../admin/hrCrudEntities";
import { HrCrudRepository } from "../repositories/hrCrudRepository";

export interface EmployeeDuplicateScope {
  enterpriseId?: number | null;
  departmentId?: number | null;
}

export class EmployeeEmploymentService {
  constructor(private readonly repository: HrCrudRepository) {}

  checkDuplicates(
    params: EmployeeDuplicateCheckParams,
    scope: EmployeeDuplicateScope = {},
    options: { excludeEmployeeId?: number | null } = {},
  ): EmployeeDuplicateCheckResult {
    return this.repository.checkEmployeeDuplicates(params, scope, options);
  }

  createHiredEmployee(
    data: HrRecord,
    scope: EmployeeDuplicateScope = {},
  ): HrRecord {
    const prepared = this.prepareHiredEmployee(data);
    this.assertNoBlockingDuplicates(
      duplicateParamsFromRecord(prepared),
      {
        enterpriseId:
          scope.enterpriseId ?? nullablePositiveNumber(prepared.enterprise_id),
        departmentId: scope.departmentId ?? null,
      },
    );

    return this.repository.create(
      getHrCrudEntityConfig("employees"),
      prepared,
    );
  }

  rehireEmployee(params: HrRehireParams): HrRecord {
    assertDate(params.effectiveAt, "дату повторного приёма");
    if (!params.reason.trim()) {
      throw new Error("Укажите основание повторного приёма");
    }
    if (!Number.isFinite(params.salary) || params.salary < 0) {
      throw new Error("Укажите корректный оклад");
    }

    const employee = this.repository.getById(
      getHrCrudEntityConfig("employees"),
      params.employeeId,
    );
    if (!employee) throw new Error("Сотрудник не найден");
    if (
      String(employee.lifecycle_status ?? employee.status ?? "") !==
      "terminated"
    ) {
      throw new Error("Повторно принять можно только уволенного сотрудника");
    }

    this.assertNoBlockingDuplicates(
      {
        enterpriseId: params.enterpriseId,
        employeeNumber:
          params.employeeNumber ?? stringValue(employee.employee_number),
        lastName: stringValue(employee.last_name),
        firstName: stringValue(employee.first_name),
        middleName: stringValue(employee.middle_name),
        birthDate: stringValue(employee.birth_date),
        phone: stringValue(employee.phone),
        email: stringValue(employee.email),
        contractNumber:
          params.contractNumber ?? stringValue(employee.contract_number),
      },
      { enterpriseId: params.enterpriseId },
      { excludeEmployeeId: params.employeeId },
    );

    return this.repository.rehireEmployee(params);
  }

  private prepareHiredEmployee(data: HrRecord): HrRecord {
    const enterpriseId = nullablePositiveNumber(data.enterprise_id);
    const departmentId = nullablePositiveNumber(data.department_id);
    const positionId = nullablePositiveNumber(data.position_id);
    const hireDate = stringValue(data.hire_date);

    if (!enterpriseId) throw new Error("Выберите предприятие сотрудника");
    if (!departmentId) throw new Error("Выберите отдел сотрудника");
    if (!positionId) throw new Error("Выберите должность сотрудника");
    assertDate(hireDate, "дату приёма на работу");

    return {
      ...data,
      enterprise_id: enterpriseId,
      department_id: departmentId,
      position_id: positionId,
      status: "active",
      lifecycle_status: "active",
      employment_started_at: hireDate,
      hire_date: hireDate,
      registered_at: new Date().toISOString(),
      terminated_at: null,
      termination_reason: null,
    };
  }

  private assertNoBlockingDuplicates(
    params: EmployeeDuplicateCheckParams,
    scope: EmployeeDuplicateScope,
    options: { excludeEmployeeId?: number | null } = {},
  ): void {
    const result = this.checkDuplicates(params, scope, options);
    const match = result.matches.find((candidate) => candidate.blocking);
    if (!match) return;

    const fields = match.fields
      .filter((field) => field.blocking)
      .map((field) => field.label)
      .join(", ");
    const terminated =
      String(match.lifecycleStatus ?? "") === "terminated";

    throw new Error(
      terminated
        ? `Сотрудник «${match.employeeName}» уже есть в системе и ранее был уволен. Совпадает: ${fields}. Используйте «Принять повторно» в существующей карточке.`
        : `Найден дубликат сотрудника «${match.employeeName}». Совпадает: ${fields}`,
    );
  }
}

export function duplicateParamsFromRecord(
  record: HrRecord,
): EmployeeDuplicateCheckParams {
  return {
    enterpriseId: nullablePositiveNumber(record.enterprise_id),
    employeeNumber: stringValue(record.employee_number),
    lastName: stringValue(record.last_name),
    firstName: stringValue(record.first_name),
    middleName: stringValue(record.middle_name),
    birthDate: stringValue(record.birth_date),
    phone: stringValue(record.phone),
    email: stringValue(record.email),
    contractNumber: stringValue(record.contract_number),
  };
}

function assertDate(value: string, label: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`Укажите корректную ${label}`);
  }
}

function stringValue(value: unknown): string {
  return String(value ?? "").trim();
}

function nullablePositiveNumber(value: unknown): number | null {
  const numberValue = Number(value);
  return Number.isInteger(numberValue) && numberValue > 0
    ? numberValue
    : null;
}
