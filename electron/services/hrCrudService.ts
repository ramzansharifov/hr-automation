import type {
  HrCreateParams,
  HrDashboardStats,
  HrDeleteParams,
  HrGetByIdParams,
  HrListParams,
  HrListResult,
  HrRecord,
  HrUpdateParams,
} from '../../src/shared/types/hr'
import { getHrCrudEntityConfig } from '../admin/hrCrudEntities'
import { HrCrudRepository } from '../repositories/hrCrudRepository'

export class HrCrudService {
  constructor(private readonly repository: HrCrudRepository) {}

  list(params: HrListParams): HrListResult {
    const config = getHrCrudEntityConfig(params.entity)

    return this.repository.list(config, params)
  }

  getById(params: HrGetByIdParams): HrRecord | null {
    const config = getHrCrudEntityConfig(params.entity)

    return this.repository.getById(config, params.id)
  }

  create(params: HrCreateParams): HrRecord {
    const config = getHrCrudEntityConfig(params.entity)
    const data = this.prepareData(params.entity, params.data)

    return this.repository.create(config, data)
  }

  update(params: HrUpdateParams): HrRecord {
    const config = getHrCrudEntityConfig(params.entity)
    const data = this.prepareData(params.entity, params.data)

    return this.repository.update(config, params.id, data)
  }

  delete(params: HrDeleteParams): { success: true } {
    const config = getHrCrudEntityConfig(params.entity)

    this.repository.delete(config, params.id)

    return { success: true }
  }

  dashboard(): HrDashboardStats {
    return this.repository.dashboard()
  }

  private prepareData(entity: string, data: HrRecord): HrRecord {
    if (entity !== 'payroll') {
      return data
    }

    const baseSalary = toNumber(data.base_salary)
    const bonus = toNumber(data.bonus)
    const allowance = toNumber(data.allowance)
    const deductions = toNumber(data.deductions)
    const taxes = toNumber(data.taxes)

    return {
      ...data,
      base_salary: baseSalary,
      bonus,
      allowance,
      deductions,
      taxes,
      net_amount: baseSalary + bonus + allowance - deductions - taxes,
    }
  }
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') {
    return value
  }

  if (typeof value === 'string' && value.trim() !== '') {
    return Number(value)
  }

  return 0
}