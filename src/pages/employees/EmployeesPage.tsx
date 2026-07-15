import { useEffect, useState } from "react";
import { FiPlus } from "react-icons/fi";
import { useNavigate } from "react-router-dom";

import type { HrFilterCondition, HrRecord } from "../../shared/types/hr";
import { Button, PageHeader, useStoredViewMode } from "../../shared/ui";
import { HrEntityTable } from "../../features/hr-table/HrEntityTable";
import {
  EMPLOYEE_FILTERS_EVENT,
  getStoredEmployeeHrFilters,
} from "../../features/filters/employeeFiltersStore";

export function EmployeesPage(): JSX.Element {
  const navigate = useNavigate();
  const [appliedFilters, setAppliedFilters] = useState<
    Record<string, HrFilterCondition> | undefined
  >(getStoredEmployeeHrFilters);
  const [viewMode, setViewMode] = useStoredViewMode("employees");

  useEffect(() => {
    function handleFiltersChange(event: Event): void {
      if (!(event instanceof CustomEvent)) return;
      setAppliedFilters(
        event.detail as Record<string, HrFilterCondition> | undefined,
      );
    }

    function handleStorageChange(): void {
      setAppliedFilters(getStoredEmployeeHrFilters());
    }

    window.addEventListener(EMPLOYEE_FILTERS_EVENT, handleFiltersChange);
    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener(EMPLOYEE_FILTERS_EVENT, handleFiltersChange);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  function handleRowClick(record: HrRecord): void {
    const id = Number(record.id);
    if (Number.isFinite(id)) navigate(`/employees/${id}`);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <Button
            className="border-white/20 shadow-xl hover:opacity-90"
            leftIcon={<FiPlus className="h-4 w-4" />}
            onClick={() => navigate("/employees/new")}
            style={{ background: "#ffffff", color: "#0f172a" }}
            variant="ghost"
          >
            Добавить сотрудника
          </Button>
        }
        title="Сотрудники"
      />

      <HrEntityTable
        entity="employees"
        externalFilters={appliedFilters}
        hideCreateButton
        hideToolbarSearch
        onRowClick={handleRowClick}
        onViewModeChange={setViewMode}
        viewMode={viewMode}
      />
    </div>
  );
}
