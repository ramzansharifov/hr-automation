import { useEffect, useState } from "react";
import { FiPlus, FiUsers } from "react-icons/fi";
import { useNavigate } from "react-router-dom";

import type { HrFilterCondition, HrRecord } from "../../shared/types/hr";
import { Button, PageHeader, useStoredViewMode } from "../../shared/ui";
import { useAuth } from "../../features/auth/AuthContext";
import { HrEntityTable } from "../../features/hr-table/HrEntityTable";
import { getLeadershipRole } from "../../shared/access/leadership";
import {
  EMPLOYEE_FILTERS_EVENT,
  getStoredEmployeeHrFilters,
} from "../../features/filters/employeeFiltersStore";

export function EmployeesPage(): JSX.Element {
  const navigate = useNavigate();
  const { hasPermission, session } = useAuth();
  const canCreateEmployees = hasPermission("employees.create");
  const leadershipRole = getLeadershipRole(session.roles);
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

  const title =
    leadershipRole === "enterprise_director"
      ? "Сотрудники предприятия"
      : leadershipRole === "department_head"
        ? "Сотрудники отдела"
        : "Сотрудники";
  const description =
    leadershipRole === "enterprise_director"
      ? `Сотрудники ${session.enterpriseName || "вашего предприятия"}. Реестр автоматически ограничен предприятием, которым вы руководите.`
      : leadershipRole === "department_head"
        ? `Сотрудники ${session.departmentName || "вашего отдела"}. Реестр автоматически ограничен вашим подразделением.`
        : "Единый реестр сотрудников, их должностей, подразделений и кадрового статуса.";

  return (
    <div className="space-y-6">
      <PageHeader
        description={description}
        icon={<FiUsers />}
        actions={
          canCreateEmployees ? (
            <Button
              className="border-white/20 shadow-xl hover:opacity-90"
              leftIcon={<FiPlus className="h-4 w-4" />}
              onClick={() => navigate("/employees/new")}
              style={{ background: "#ffffff", color: "#0f172a" }}
              variant="ghost"
            >
              Добавить сотрудника
            </Button>
          ) : undefined
        }
        title={title}
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
