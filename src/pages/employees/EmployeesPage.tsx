import { useEffect, useState } from "react";
import { FiPlus } from "react-icons/fi";
import { useNavigate } from "react-router-dom";

import type { HrFilterCondition, HrRecord } from "../../shared/types/hr";
import { Button, PageHeader } from "../../shared/ui";
import { HrEntityTable } from "../../features/hr-table/HrEntityTable";
import {
  EMPLOYEE_FILTERS_EVENT,
  getStoredEmployeeHrFilters,
} from "../../features/filters/employeeFiltersStore";
import {
  EMPLOYEES_VIEW_MODE_EVENT,
  getStoredEmployeesViewMode,
  setStoredEmployeesViewMode,
  isEmployeesViewMode,
  type EmployeesViewMode,
} from "../../features/employees/viewMode";

export function EmployeesPage(): JSX.Element {
  const navigate = useNavigate();
  const [appliedFilters, setAppliedFilters] = useState<
    Record<string, HrFilterCondition> | undefined
  >(getStoredEmployeeHrFilters);
  const [viewMode, setViewMode] = useState<EmployeesViewMode>(
    getStoredEmployeesViewMode,
  );

  useEffect(() => {
    function handleViewModeChange(event: Event): void {
      if (!(event instanceof CustomEvent)) return;
      if (isEmployeesViewMode(event.detail)) setViewMode(event.detail);
    }

    function handleFiltersChange(event: Event): void {
      if (!(event instanceof CustomEvent)) return;
      setAppliedFilters(
        event.detail as Record<string, HrFilterCondition> | undefined,
      );
    }

    function handleStorageChange(): void {
      setViewMode(getStoredEmployeesViewMode());
      setAppliedFilters(getStoredEmployeeHrFilters());
    }

    window.addEventListener(EMPLOYEES_VIEW_MODE_EVENT, handleViewModeChange);
    window.addEventListener(EMPLOYEE_FILTERS_EVENT, handleFiltersChange);
    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener(
        EMPLOYEES_VIEW_MODE_EVENT,
        handleViewModeChange,
      );
      window.removeEventListener(EMPLOYEE_FILTERS_EVENT, handleFiltersChange);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  function handleViewModeChange(nextMode: EmployeesViewMode): void {
    setViewMode(nextMode);
    setStoredEmployeesViewMode(nextMode);
    window.dispatchEvent(
      new CustomEvent(EMPLOYEES_VIEW_MODE_EVENT, { detail: nextMode }),
    );
  }

  function handleRowClick(record: HrRecord): void {
    const id = Number(record.id);
    if (Number.isFinite(id)) navigate(`/employees/${id}`);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <Button
            className="border-white/20 bg-white text-slate-950 shadow-xl hover:bg-white/90"
            leftIcon={<FiPlus className="h-4 w-4" />}
            onClick={() => navigate("/employees/new")}
          >
            Добавить сотрудника
          </Button>
        }
        title="Сотрудники"
      />

      <HrEntityTable
        className="h-[72vh]"
        entity="employees"
        externalFilters={appliedFilters}
        hideCreateButton
        hideToolbarSearch
        onRowClick={handleRowClick}
        onViewModeChange={handleViewModeChange}
        viewMode={viewMode}
      />
    </div>
  );
}
