import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { HrFilterCondition, HrRecord } from '../../shared/types/hr'
import { HrEntityTable } from '../../features/hr-table/HrEntityTable'
import {
  EMPLOYEE_FILTERS_EVENT,
  getStoredEmployeeHrFilters,
} from '../../features/filters/employeeFiltersStore'
import {
  EMPLOYEES_VIEW_MODE_EVENT,
  getStoredEmployeesViewMode,
  isEmployeesViewMode,
  type EmployeesViewMode,
} from '../../features/employees/viewMode'

export function EmployeesPage(): JSX.Element {
  const navigate = useNavigate()
  const [appliedFilters, setAppliedFilters] = useState<
    Record<string, HrFilterCondition> | undefined
  >(getStoredEmployeeHrFilters)
  const [viewMode, setViewMode] = useState<EmployeesViewMode>(getStoredEmployeesViewMode)

  useEffect(() => {
    function handleViewModeChange(event: Event): void {
      if (!(event instanceof CustomEvent)) {
        return
      }

      if (isEmployeesViewMode(event.detail)) {
        setViewMode(event.detail)
      }
    }

    function handleFiltersChange(event: Event): void {
      if (!(event instanceof CustomEvent)) {
        return
      }

      setAppliedFilters(event.detail as Record<string, HrFilterCondition> | undefined)
    }

    function handleStorageChange(): void {
      setViewMode(getStoredEmployeesViewMode())
      setAppliedFilters(getStoredEmployeeHrFilters())
    }

    window.addEventListener(EMPLOYEES_VIEW_MODE_EVENT, handleViewModeChange)
    window.addEventListener(EMPLOYEE_FILTERS_EVENT, handleFiltersChange)
    window.addEventListener('storage', handleStorageChange)

    return () => {
      window.removeEventListener(EMPLOYEES_VIEW_MODE_EVENT, handleViewModeChange)
      window.removeEventListener(EMPLOYEE_FILTERS_EVENT, handleFiltersChange)
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [])

  function handleRowClick(record: HrRecord): void {
    const id = Number(record.id)

    if (Number.isFinite(id)) {
      navigate(`/employees/${id}`)
    }
  }

  return (
    <HrEntityTable
      className="h-[80vh]"
      entity="employees"
      externalFilters={appliedFilters}
      hideToolbarSearch
      onCreateClick={() => navigate('/employees/new')}
      onRowClick={handleRowClick}
      viewMode={viewMode}
    />
  )
}