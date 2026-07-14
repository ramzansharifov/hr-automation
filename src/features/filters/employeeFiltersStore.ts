import type { HrFilterCondition } from '../../shared/types/hr'

export interface EmployeeFilterValues extends Record<string, string> {
  last_name: string
  first_name: string
  middle_name: string
  phone: string
  email: string
  department_id: string
  position_id: string
  status: string
  gender: string
}

export const EMPLOYEE_FILTERS_STORAGE_KEY = 'hr-employee-filters'
export const EMPLOYEE_FILTERS_EVENT = 'hr-employee-filters-change'

export const emptyEmployeeFilters: EmployeeFilterValues = {
  last_name: '',
  first_name: '',
  middle_name: '',
  phone: '',
  email: '',
  department_id: '',
  position_id: '',
  status: '',
  gender: '',
}

const textFilterKeys: Array<
  keyof Pick<
    EmployeeFilterValues,
    'last_name' | 'first_name' | 'middle_name' | 'phone' | 'email'
  >
> = ['last_name', 'first_name', 'middle_name', 'phone', 'email']

const selectFilterKeys: Array<
  keyof Pick<
    EmployeeFilterValues,
    'department_id' | 'position_id' | 'status' | 'gender'
  >
> = ['department_id', 'position_id', 'status', 'gender']

export function isEmployeeFilterValues(value: unknown): value is EmployeeFilterValues {
  if (!value || typeof value !== 'object') {
    return false
  }

  const record = value as Record<string, unknown>

  return Object.keys(emptyEmployeeFilters).every((key) => typeof record[key] === 'string')
}

export function getStoredEmployeeFilterValues(): EmployeeFilterValues {
  if (typeof window === 'undefined') {
    return emptyEmployeeFilters
  }

  const storedValue = window.localStorage.getItem(EMPLOYEE_FILTERS_STORAGE_KEY)

  if (!storedValue) {
    return emptyEmployeeFilters
  }

  try {
    const parsedValue: unknown = JSON.parse(storedValue)

    return isEmployeeFilterValues(parsedValue) ? parsedValue : emptyEmployeeFilters
  } catch {
    return emptyEmployeeFilters
  }
}

export function buildEmployeeFilters(
  values: EmployeeFilterValues,
): Record<string, HrFilterCondition> | undefined {
  const filters: Record<string, HrFilterCondition> = {}

  textFilterKeys.forEach((key) => {
    const value = values[key].trim()

    if (value) {
      filters[key] = {
        operator: 'contains',
        value,
      }
    }
  })

  selectFilterKeys.forEach((key) => {
    const value = values[key]

    if (value) {
      filters[key] = {
        operator: 'equals',
        value:
          key === 'department_id' || key === 'position_id'
            ? Number(value)
            : value,
      }
    }
  })

  return Object.keys(filters).length > 0 ? filters : undefined
}

export function getStoredEmployeeHrFilters(): Record<string, HrFilterCondition> | undefined {
  return buildEmployeeFilters(getStoredEmployeeFilterValues())
}

export function setStoredEmployeeFilterValues(values: EmployeeFilterValues): void {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(EMPLOYEE_FILTERS_STORAGE_KEY, JSON.stringify(values))

  window.dispatchEvent(
    new CustomEvent(EMPLOYEE_FILTERS_EVENT, {
      detail: buildEmployeeFilters(values),
    }),
  )
}

export function clearStoredEmployeeFilterValues(): void {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.removeItem(EMPLOYEE_FILTERS_STORAGE_KEY)

  window.dispatchEvent(
    new CustomEvent(EMPLOYEE_FILTERS_EVENT, {
      detail: undefined,
    }),
  )
}
