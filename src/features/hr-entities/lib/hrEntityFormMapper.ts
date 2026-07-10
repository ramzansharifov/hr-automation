import type { HrEntityKey, HrRecord } from '../../../shared/types/hr'
import { getHrEntityFormConfig } from '../config/hrEntityFormConfig'
import { hrEntityDefaults } from '../config/hrEntityDefaults'

export type HrEntityFormValues = Record<string, string>

const numberFieldNames = new Set([
  'department_id',
  'position_id',
  'employee_id',
  'days_count',
  'base_salary',
  'allowance',
  'bonus',
  'deductions',
  'taxes',
  'salary',
  'is_current',
])

export function getHrEntityDefaultValues(
  entity: HrEntityKey,
  record?: HrRecord | null,
): HrEntityFormValues {
  const defaults = hrEntityDefaults[entity]

  if (!record) {
    return { ...defaults }
  }

  const values: HrEntityFormValues = { ...defaults }

  Object.keys(defaults).forEach((key) => {
    const value = record[key]

    if (value === null || value === undefined) {
      values[key] = ''
      return
    }

    values[key] = String(value)
  })

  return values
}

export function mapHrEntityFormValues(entity: HrEntityKey, values: HrEntityFormValues): HrRecord {
  const config = getHrEntityFormConfig(entity)
  const result: HrRecord = {}

  config.fields.forEach((field) => {
    const rawValue = values[field.name] ?? ''
    const trimmedValue = typeof rawValue === 'string' ? rawValue.trim() : rawValue

    if (numberFieldNames.has(field.name)) {
      result[field.name] = trimmedValue === '' ? null : Number(trimmedValue)
      return
    }

    result[field.name] = trimmedValue === '' && !field.required ? null : trimmedValue
  })

  return result
}
