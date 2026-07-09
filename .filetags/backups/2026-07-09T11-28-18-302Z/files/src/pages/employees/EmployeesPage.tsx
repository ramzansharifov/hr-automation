import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { HrFilterCondition, HrRecord } from "../../shared/types/hr";
import { HrEntityTable } from "../../features/hr-table/HrEntityTable";
import { EmployeeFiltersPanel } from "../../features/filters/components/EmployeeFiltersPanel";
import {
  EMPLOYEES_VIEW_MODE_EVENT,
  getStoredEmployeesViewMode,
  isEmployeesViewMode,
  type EmployeesViewMode,
} from "../../features/employees/viewMode";

export function EmployeesPage(): JSX.Element {
  const navigate = useNavigate();
  const [appliedFilters, setAppliedFilters] = useState<
    Record<string, HrFilterCondition> | undefined
  >();
  const [viewMode, setViewMode] = useState<EmployeesViewMode>(
    getStoredEmployeesViewMode,
  );

  useEffect(() => {
    function handleViewModeChange(event: Event): void {
      if (!(event instanceof CustomEvent)) {
        return;
      }

      if (isEmployeesViewMode(event.detail)) {
        setViewMode(event.detail);
      }
    }

    function handleStorageChange(): void {
      setViewMode(getStoredEmployeesViewMode());
    }

    window.addEventListener(EMPLOYEES_VIEW_MODE_EVENT, handleViewModeChange);
    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener(
        EMPLOYEES_VIEW_MODE_EVENT,
        handleViewModeChange,
      );
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  function handleRowClick(record: HrRecord): void {
    const id = Number(record.id);

    if (Number.isFinite(id)) {
      navigate(`/employees/${id}`);
    }
  }

  return (
    <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_320px]">
      <HrEntityTable
        className="h-[80vh]"
        entity="employees"
        externalFilters={appliedFilters}
        hideToolbarSearch
        onCreateClick={() => navigate("/employees/new")}
        onRowClick={handleRowClick}
        viewMode={viewMode}
      />

      <EmployeeFiltersPanel onFiltersChange={setAppliedFilters} />
    </div>
  );
}
