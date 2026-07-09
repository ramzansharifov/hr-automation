import type { HrRecord } from '../../../shared/types/hr'
import type { EmployeeFormValues } from '../types'

const personNameSeparators = /(\s+|-)/

export function normalizePersonName(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .split(personNameSeparators)
    .map((part) => {
      if (part.trim() === '' || part === '-') {
        return part
      }

      return capitalizeWord(part)
    })
    .join('')
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase()
}

export function normalizePhone(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

export function normalizeEmployeeFormValues(values: EmployeeFormValues): EmployeeFormValues {
  return {
    ...values,
    last_name: normalizePersonName(values.last_name),
    first_name: normalizePersonName(values.first_name),
    middle_name: normalizePersonName(values.middle_name),
    phone: normalizePhone(values.phone),
    email: normalizeEmail(values.email),
    salary: normalizeSalary(values.salary),
    address_country: normalizePersonName(values.address_country),
    address_city: normalizePersonName(values.address_city),
    address_street: values.address_street.trim().replace(/\s+/g, ' '),
    address_house: values.address_house.trim(),
    address_apartment: values.address_apartment.trim(),
    address: values.address.trim(),
    note: values.note.trim(),
  }
}

export function mapEmployeeFormValuesToRecord(values: EmployeeFormValues): HrRecord {
  return {
    last_name: values.last_name,
    first_name: values.first_name,
    middle_name: nullableString(values.middle_name),
    birth_date: nullableString(values.birth_date),
    gender: nullableString(values.gender),
    phone: nullableString(values.phone),
    email: nullableString(values.email),
    address_country: nullableString(values.address_country),
    address_city: nullableString(values.address_city),
    address_street: nullableString(values.address_street),
    address_house: nullableString(values.address_house),
    address_apartment: nullableString(values.address_apartment),
    address: nullableString(values.address),
    department_id: nullableNumber(values.department_id),
    position_id: nullableNumber(values.position_id),
    hire_date: values.hire_date,
    status: values.status,
    salary: Number(values.salary || 0),
    note: nullableString(values.note),
  }
}

function capitalizeWord(value: string): string {
  const letters = Array.from(value.toLocaleLowerCase('ru-RU'))
  const firstLetter = letters[0]

  if (!firstLetter) {
    return ''
  }

  return `${firstLetter.toLocaleUpperCase('ru-RU')}${letters.slice(1).join('')}`
}

function normalizeSalary(value: string): string {
  const salary = Number(value)

  if (!Number.isFinite(salary) || salary < 0) {
    return '0'
  }

  return String(salary)
}

function nullableNumber(value: string): number | null {
  const trimmedValue = value.trim()

  if (trimmedValue === '') {
    return null
  }

  return Number(trimmedValue)
}

function nullableString(value: string): string | null {
  const trimmedValue = value.trim()

  return trimmedValue === '' ? null : trimmedValue
}
