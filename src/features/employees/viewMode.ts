export type EmployeesViewMode = 'table' | 'cards'

export const EMPLOYEES_VIEW_MODE_STORAGE_KEY = 'hr-employees-view-mode'
export const EMPLOYEES_VIEW_MODE_EVENT = 'hr-employees-view-mode-change'

export function isEmployeesViewMode(value: unknown): value is EmployeesViewMode {
  return value === 'table' || value === 'cards'
}

export function getStoredEmployeesViewMode(): EmployeesViewMode {
  if (typeof window === 'undefined') {
    return 'table'
  }

  const storedValue = window.localStorage.getItem(EMPLOYEES_VIEW_MODE_STORAGE_KEY)
  return isEmployeesViewMode(storedValue) ? storedValue : 'table'
}

export function setStoredEmployeesViewMode(viewMode: EmployeesViewMode): void {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(EMPLOYEES_VIEW_MODE_STORAGE_KEY, viewMode)
}