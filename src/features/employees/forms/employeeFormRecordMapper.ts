import type { HrRecord } from '../../../shared/types/hr'
import { employeeDefaultValues, type EmployeeFormValues } from '../types'
import {
  mapEmployeeFormValuesToRecord,
  normalizeEmployeeFormValues,
} from '../lib/employeeFormatters'
import {
  employeeSectionFields,
  type EmployeeFormSectionKey,
} from './employeeFormValidation'

function valueToString(value: unknown): string {
  if (value === null || value === undefined) {
    return ''
  }

  return String(value)
}

export function mapEmployeeRecordToFormValues(record: HrRecord | null | undefined): EmployeeFormValues {
  if (!record) {
    return employeeDefaultValues
  }

  return {
    last_name: valueToString(record.last_name),
    first_name: valueToString(record.first_name),
    middle_name: valueToString(record.middle_name),
    birth_date: valueToString(record.birth_date),
    gender: valueToString(record.gender),
    phone: valueToString(record.phone),
    email: valueToString(record.email),
    address_country: valueToString(record.address_country),
    address_city: valueToString(record.address_city),
    address_street: valueToString(record.address_street),
    address_house: valueToString(record.address_house),
    address_apartment: valueToString(record.address_apartment),
    address: valueToString(record.address),
    department_id: valueToString(record.department_id),
    position_id: valueToString(record.position_id),
    hire_date: valueToString(record.hire_date),
    status: valueToString(record.status) || employeeDefaultValues.status,
    salary: valueToString(record.salary) || employeeDefaultValues.salary,
    note: valueToString(record.note),
  }
}

export function mapEmployeeFormSectionToRecord(
  section: EmployeeFormSectionKey,
  values: EmployeeFormValues,
): HrRecord {
  const normalizedValues = normalizeEmployeeFormValues(values)
  const fullRecord = mapEmployeeFormValuesToRecord(normalizedValues)
  const sectionRecord: HrRecord = {}

  employeeSectionFields[section].forEach((field) => {
    sectionRecord[field] = fullRecord[field]
  })

  return sectionRecord
}