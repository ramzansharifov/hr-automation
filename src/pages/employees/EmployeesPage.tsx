import { useEffect, useMemo, useState } from "react";
import { FiPlus, FiUsers } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import type { HrFilterCondition, HrRecord } from "../../shared/types/hr";
import { Button, LoadingState, PageHeader, useStoredViewMode } from "../../shared/ui";
import { useAuth } from "../../features/auth/AuthContext";
import { HrEntityTable } from "../../features/hr-table/HrEntityTable";
import { hrApiClient } from "../../shared/lib/hrApiClient";
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
  const isLeadershipDirectory =
    leadershipRole === "enterprise_director" || leadershipRole === "department_head";
  const [appliedFilters, setAppliedFilters] = useState<
    Record<string, HrFilterCondition> | undefined
  >(getStoredEmployeeHrFilters);
  const [directoryEmployeeIds, setDirectoryEmployeeIds] = useState<
    number[] | null | undefined
  >(undefined);
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

  useEffect(() => {
    if (!isLeadershipDirectory || session.employeeId <= 0) {
      setDirectoryEmployeeIds(undefined);
      return;
    }

    let active = true;
    setDirectoryEmployeeIds(null);

    void loadColleagueIds(session.employeeId)
      .then((ids) => {
        if (active) setDirectoryEmployeeIds(ids);
      })
      .catch((error) => {
        if (!active) return;
        setDirectoryEmployeeIds(undefined);
        toast.error(
          error instanceof Error
            ? error.message
            : "Не удалось подготовить список сотрудников",
        );
      });

    return () => {
      active = false;
    };
  }, [isLeadershipDirectory, session.employeeId]);

  const tableFilters = useMemo(() => {
    if (!isLeadershipDirectory || !Array.isArray(directoryEmployeeIds)) {
      return appliedFilters;
    }

    return {
      ...(appliedFilters ?? {}),
      id: {
        operator: "in" as const,
        value: directoryEmployeeIds.length > 0 ? directoryEmployeeIds : [-1],
      },
    };
  }, [appliedFilters, directoryEmployeeIds, isLeadershipDirectory]);

  function handleRowClick(record: HrRecord): void {
    const id = Number(record.id);
    if (!Number.isFinite(id)) return;
    navigate(id === session.employeeId ? "/profile" : `/employees/${id}`);
  }

  const title =
    leadershipRole === "enterprise_director"
      ? "Сотрудники предприятия"
      : leadershipRole === "department_head"
        ? "Сотрудники отдела"
        : "Сотрудники";
  const description =
    leadershipRole === "enterprise_director"
      ? `Сотрудники ${session.enterpriseName || "вашего предприятия"}. Реестр автоматически ограничен предприятием, которым вы руководите, и не включает вашу собственную карточку.`
      : leadershipRole === "department_head"
        ? `Сотрудники ${session.departmentName || "вашего отдела"}. Реестр автоматически ограничен вашим подразделением и не включает вашу собственную карточку.`
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

      {isLeadershipDirectory && directoryEmployeeIds === null ? (
        <section className="app-surface app-border rounded-[28px] border px-5 py-16">
          <LoadingState label="Подготовка списка сотрудников..." />
        </section>
      ) : (
        <HrEntityTable
          entity="employees"
          externalFilters={tableFilters}
          hideCreateButton
          hideToolbarSearch
          onRowClick={handleRowClick}
          onViewModeChange={setViewMode}
          viewMode={viewMode}
        />
      )}
    </div>
  );
}

async function loadColleagueIds(currentEmployeeId: number): Promise<number[]> {
  const ids: number[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const result = await hrApiClient.list({
      entity: "employees",
      orderBy: "id",
      orderDirection: "asc",
      page,
      pageSize: 100,
    });

    ids.push(
      ...result.items
        .map((record) => Number(record.id))
        .filter(
          (id) => Number.isInteger(id) && id > 0 && id !== currentEmployeeId,
        ),
    );
    totalPages = Math.max(result.totalPages, 1);
    page += 1;
  } while (page <= totalPages);

  return ids;
}
