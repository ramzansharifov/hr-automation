import type {
  HrCreateParams,
  HrDashboardStats,
  HrDeleteParams,
  HrEmploymentChangeParams,
  HrGetByIdParams,
  HrListParams,
  HrListResult,
  HrRecord,
  HrUpdateParams,
} from "../../src/shared/types/hr";
import { getHrCrudEntityConfig } from "../admin/hrCrudEntities";
import { HrCrudRepository } from "../repositories/hrCrudRepository";

export class HrCrudService {
  constructor(private readonly repository: HrCrudRepository) {}

  list(params: HrListParams): HrListResult {
    const config = getHrCrudEntityConfig(params.entity);

    return this.repository.list(config, params);
  }

  getById(params: HrGetByIdParams): HrRecord | null {
    const config = getHrCrudEntityConfig(params.entity);

    return this.repository.getById(config, params.id);
  }

  create(params: HrCreateParams): HrRecord {
    if (params.entity === "employment_history") {
      throw new Error("Кадровый журнал формируется автоматически");
    }
    const config = getHrCrudEntityConfig(params.entity);
    const data = this.prepareData(params.entity, params.data);

    return this.repository.create(config, data);
  }

  update(params: HrUpdateParams): HrRecord {
    const config = getHrCrudEntityConfig(params.entity);
    if (params.entity === "employment_history") {
      throw new Error("Записи кадрового журнала нельзя изменять вручную");
    }

    if (params.entity === "employees") {
      this.assertEmploymentFieldsUnchanged(config, params.id, params.data);
    }
    const data = this.prepareData(params.entity, params.data);

    return this.repository.update(config, params.id, data);
  }

  delete(params: HrDeleteParams): { success: true } {
    if (params.entity === "employment_history") {
      throw new Error("Записи кадрового журнала нельзя удалять");
    }
    const config = getHrCrudEntityConfig(params.entity);

    this.repository.delete(config, params.id);

    return { success: true };
  }

  dashboard(): HrDashboardStats {
    return this.repository.dashboard();
  }

  changeEmployment(params: HrEmploymentChangeParams): HrRecord {
    if (!params.reason.trim()) {
      throw new Error("Укажите основание кадрового изменения");
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(params.effectiveAt)) {
      throw new Error("Укажите корректную дату кадрового изменения");
    }

    return this.repository.changeEmployment(params);
  }

  private prepareData(entity: string, data: HrRecord): HrRecord {
    if (entity === "vacations") {
      const startsAt = String(data.starts_at ?? "");
      const endsAt = String(data.ends_at ?? "");
      const daysCount = calculateInclusiveDays(startsAt, endsAt);
      const isPaid = Number(data.is_paid) === 1 ? 1 : 0;

      return {
        ...data,
        days_count: daysCount,
        is_paid: isPaid,
        payment_amount: isPaid ? toNumber(data.payment_amount) : 0,
      };
    }

    if (entity !== "payroll") {
      return data;
    }

    const baseSalary = toNumber(data.base_salary);
    const bonus = toNumber(data.bonus);
    const allowance = toNumber(data.allowance);
    const deductions = toNumber(data.deductions);
    const taxes = toNumber(data.taxes);

    return {
      ...data,
      base_salary: baseSalary,
      bonus,
      allowance,
      deductions,
      taxes,
      net_amount: baseSalary + bonus + allowance - deductions - taxes,
    };
  }

  private assertEmploymentFieldsUnchanged(
    config: ReturnType<typeof getHrCrudEntityConfig>,
    employeeId: number,
    data: HrRecord,
  ): void {
    const employee = this.repository.getById(config, employeeId);
    if (!employee) throw new Error("Сотрудник не найден");

    const protectedFields = ["department_id", "position_id", "salary"] as const;
    const changed = protectedFields.some(
      (field) =>
        field in data &&
        normalizeComparable(data[field]) !==
          normalizeComparable(employee[field]),
    );

    if (changed) {
      throw new Error(
        "Должность, отдел и зарплату можно менять только через карточку сотрудника",
      );
    }
  }
}

function calculateInclusiveDays(start: string, end: string): number {
  const startTime = new Date(`${start}T00:00:00`).getTime();
  const endTime = new Date(`${end}T00:00:00`).getTime();
  if (
    !Number.isFinite(startTime) ||
    !Number.isFinite(endTime) ||
    endTime < startTime
  )
    return 0;
  return Math.floor((endTime - startTime) / 86_400_000) + 1;
}

function normalizeComparable(value: unknown): string {
  return value === null || value === undefined || value === ""
    ? ""
    : String(value);
}

function toNumber(value: unknown): number {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    return Number(value);
  }

  return 0;
}
