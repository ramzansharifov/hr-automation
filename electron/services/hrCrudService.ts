import type {
  HrCreateParams,
  HrDashboardStats,
  HrDeleteParams,
  HrEmploymentChangeParams,
  HrGetByIdParams,
  HrHireDateCorrectionParams,
  HrListParams,
  HrListResult,
  HrRecord,
  HrTerminationParams,
  HrUpdateParams,
} from "../../src/shared/types/hr";
import { getHrCrudEntityConfig } from "../admin/hrCrudEntities";
import { HrCrudRepository } from "../repositories/hrCrudRepository";

const vacationTransitions: Record<string, string[]> = {
  planned: ["planned", "approved", "rejected"],
  approved: ["approved", "completed"],
  rejected: ["rejected"],
  completed: ["completed"],
};

const vacationDecisionFields = [
  "employee_id",
  "vacation_type_id",
  "starts_at",
  "ends_at",
  "is_paid",
  "reason",
] as const;

export class HrCrudService {
  constructor(private readonly repository: HrCrudRepository) {}

  list(params: HrListParams): HrListResult {
    return this.repository.list(getHrCrudEntityConfig(params.entity), params);
  }

  getById(params: HrGetByIdParams): HrRecord | null {
    return this.repository.getById(
      getHrCrudEntityConfig(params.entity),
      params.id,
    );
  }

  create(params: HrCreateParams): HrRecord {
    if (params.entity === "employment_history") {
      throw new Error("Кадровый журнал формируется автоматически");
    }

    const data = this.prepareData(params.entity, params.data, "create");
    if (params.entity === "employees") {
      data.status = "active";
      data.terminated_at = null;
      data.termination_reason = null;
    }
    if (params.entity === "vacations") {
      data.status = "planned";
      data.approved_at = null;
      data.approved_by_account_type = null;
      data.approved_by_account_id = null;
      data.approved_by_name = null;
    }

    return this.repository.create(getHrCrudEntityConfig(params.entity), data);
  }

  update(params: HrUpdateParams): HrRecord {
    const config = getHrCrudEntityConfig(params.entity);
    if (params.entity === "employment_history") {
      throw new Error("Записи кадрового журнала нельзя изменять вручную");
    }

    const existing = this.repository.getById(config, params.id);
    if (!existing) throw new Error("Запись не найдена");

    if (params.entity === "employees") {
      this.assertEmploymentFieldsUnchanged(existing, params.data);
    }
    if (params.entity === "enterprises") {
      this.assertEnterpriseLeaderAssignment(params.id, existing, params.data);
    }
    if (params.entity === "departments") {
      this.assertDepartmentLeaderAssignment(params.id, existing, params.data);
    }
    if (params.entity === "vacations") {
      this.assertVacationTransition(existing, params.data);
      this.assertVacationDecisionFieldsUnchanged(existing, params.data);
    }

    const data = this.prepareData(params.entity, params.data, "update");
    return this.repository.update(config, params.id, data);
  }

  delete(params: HrDeleteParams): { success: true } {
    if (params.entity === "employment_history") {
      throw new Error("Записи кадрового журнала нельзя удалять");
    }
    if (params.entity === "employees") {
      throw new Error(
        "Сотрудников нельзя удалять. Используйте кадровое действие «Уволить сотрудника»",
      );
    }
    if (params.entity === "vacations") {
      const existing = this.repository.getById(
        getHrCrudEntityConfig("vacations"),
        params.id,
      );
      if (!existing) throw new Error("Отпуск не найден");
      if (String(existing.status ?? "planned") !== "planned") {
        throw new Error(
          "Удалить можно только отпуск, который ещё находится в статусе «Запланирован»",
        );
      }
    }

    this.repository.delete(getHrCrudEntityConfig(params.entity), params.id);
    return { success: true };
  }

  dashboard(): HrDashboardStats {
    return this.repository.dashboard();
  }

  changeEmployment(params: HrEmploymentChangeParams): HrRecord {
    assertReasonAndDate(params.reason, params.effectiveAt);
    if (params.salaryMode !== "keep" && params.salaryMode !== "custom") {
      throw new Error("Выберите корректный способ изменения оклада");
    }
    return this.repository.changeEmployment(params);
  }

  terminateEmployee(params: HrTerminationParams): HrRecord {
    assertReasonAndDate(params.reason, params.effectiveAt);
    return this.repository.terminateEmployee(params);
  }

  correctHireDate(params: HrHireDateCorrectionParams): HrRecord {
    assertReasonAndDate(params.reason, params.hireDate);
    return this.repository.correctHireDate(params);
  }

  private prepareData(
    entity: string,
    data: HrRecord,
    mode: "create" | "update",
  ): HrRecord {
    if (entity !== "vacations") return data;

    const startsAt = String(data.starts_at ?? "");
    const endsAt = String(data.ends_at ?? "");
    const daysCount = calculateInclusiveDays(startsAt, endsAt);
    if (daysCount < 1) {
      throw new Error("Укажите корректный период отпуска");
    }

    const vacationTypeId = Number(data.vacation_type_id);
    if (!Number.isInteger(vacationTypeId) || vacationTypeId < 1) {
      throw new Error("Выберите вид отпуска");
    }

    const prepared: HrRecord = {
      ...data,
      days_count: daysCount,
      is_paid: Number(data.is_paid) === 1 ? 1 : 0,
      vacation_type_id: vacationTypeId,
    };

    if (mode === "create") prepared.status = "planned";
    return prepared;
  }

  private assertEmploymentFieldsUnchanged(
    employee: HrRecord,
    data: HrRecord,
  ): void {
    const protectedFields = [
      "department_id",
      "position_id",
      "salary",
      "hire_date",
      "status",
      "terminated_at",
      "termination_reason",
    ] as const;
    const changed = protectedFields.some(
      (field) =>
        field in data &&
        normalizeComparable(data[field]) !== normalizeComparable(employee[field]),
    );

    if (changed) {
      throw new Error(
        "Условия трудоустройства и статус меняются только через кадровые действия",
      );
    }
  }

  private assertEnterpriseLeaderAssignment(
    enterpriseId: number,
    enterprise: HrRecord,
    data: HrRecord,
  ): void {
    const field = "general_director_employee_id";
    if (
      !(field in data) ||
      normalizeComparable(data[field]) === normalizeComparable(enterprise[field])
    ) {
      return;
    }

    const employeeId = normalizeOptionalId(data[field]);
    if (employeeId === null) return;
    const employee = this.getLeaderCandidate(employeeId);
    const departmentId = normalizeOptionalId(employee.department_id);
    if (departmentId === null) {
      throw new Error("Выбранный сотрудник не относится к этому предприятию");
    }
    const department = this.repository.getById(
      getHrCrudEntityConfig("departments"),
      departmentId,
    );
    if (!department || Number(department.enterprise_id) !== enterpriseId) {
      throw new Error(
        "Руководителем предприятия можно назначить только сотрудника этого предприятия",
      );
    }
  }

  private assertDepartmentLeaderAssignment(
    departmentId: number,
    department: HrRecord,
    data: HrRecord,
  ): void {
    const field = "director_employee_id";
    if (
      !(field in data) ||
      normalizeComparable(data[field]) === normalizeComparable(department[field])
    ) {
      return;
    }

    const employeeId = normalizeOptionalId(data[field]);
    if (employeeId === null) return;
    const employee = this.getLeaderCandidate(employeeId);
    if (Number(employee.department_id) !== departmentId) {
      throw new Error(
        "Руководителем отдела можно назначить только сотрудника этого отдела",
      );
    }
  }

  private getLeaderCandidate(employeeId: number): HrRecord {
    const employee = this.repository.getById(
      getHrCrudEntityConfig("employees"),
      employeeId,
    );
    if (!employee) throw new Error("Сотрудник не найден");
    if (String(employee.status ?? "") !== "active") {
      throw new Error("Руководителем можно назначить только активного сотрудника");
    }
    if (
      employee.position_id !== null &&
      employee.position_id !== undefined &&
      employee.position_id !== ""
    ) {
      throw new Error("У выбранного сотрудника уже назначена должность");
    }
    return employee;
  }

  private assertVacationTransition(existing: HrRecord, data: HrRecord): void {
    if (!("status" in data)) return;
    const previousStatus = String(existing.status ?? "planned");
    const nextStatus = String(data.status ?? previousStatus);
    const allowed = vacationTransitions[previousStatus] ?? [previousStatus];
    if (!allowed.includes(nextStatus)) {
      throw new Error(
        `Нельзя изменить статус отпуска с «${previousStatus}» на «${nextStatus}»`,
      );
    }
  }

  private assertVacationDecisionFieldsUnchanged(
    existing: HrRecord,
    data: HrRecord,
  ): void {
    if (String(existing.status ?? "planned") === "planned") return;
    const changed = vacationDecisionFields.some(
      (field) =>
        field in data &&
        normalizeComparable(data[field]) !== normalizeComparable(existing[field]),
    );
    if (changed) {
      throw new Error(
        "После принятия решения по отпуску его сотрудника, вид, период, оплату и основание изменять нельзя",
      );
    }
  }
}

function assertReasonAndDate(reason: string, date: string): void {
  if (!reason.trim()) throw new Error("Укажите основание кадрового действия");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("Укажите корректную дату кадрового действия");
  }
}

function calculateInclusiveDays(start: string, end: string): number {
  const startTime = new Date(`${start}T00:00:00`).getTime();
  const endTime = new Date(`${end}T00:00:00`).getTime();
  if (
    !Number.isFinite(startTime) ||
    !Number.isFinite(endTime) ||
    endTime < startTime
  ) {
    return 0;
  }
  return Math.floor((endTime - startTime) / 86_400_000) + 1;
}

function normalizeOptionalId(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) {
    throw new Error("Выбран некорректный сотрудник");
  }
  return id;
}

function normalizeComparable(value: unknown): string {
  return value === null || value === undefined || value === ""
    ? ""
    : String(value);
}
