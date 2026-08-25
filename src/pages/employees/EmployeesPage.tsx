import { useEffect, useMemo, useState } from "react";
import { FiDownload, FiPlus, FiUsers } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import type { HrFilterCondition, HrRecord } from "../../shared/types/hr";
import { Button, LoadingState, PageHeader, useStoredViewMode } from "../../shared/ui";
import { useAuth } from "../../features/auth/AuthContext";
import { HrEntityTable } from "../../features/hr-table/HrEntityTable";
import { hrApiClient } from "../../shared/lib/hrApiClient";
import { getLeadershipRole } from "../../shared/access/leadership";
import { getScopedAdminRole } from "../../shared/access/scopedAdmin";
import {
  EMPLOYEE_FILTERS_EVENT,
  getStoredEmployeeHrFilters,
} from "../../features/filters/employeeFiltersStore";

export function EmployeesPage(): JSX.Element {
  const navigate = useNavigate();
  const { hasPermission, session } = useAuth();
  const canCreateEmployees = hasPermission("employees.create");
  const canExportEmployees = hasPermission("employees.export");
  const leadershipRole = getLeadershipRole(session.roles);
  const scopedAdminRole = getScopedAdminRole(session.roles);
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

  async function exportEmployees(): Promise<void> {
    if (!canExportEmployees) return;
    try {
      const result = await hrApiClient.exportEmployeesCsv();
      if (!result.canceled) {
        toast.success(
          scopedAdminRole === "enterprise_admin"
            ? "Реестр сотрудников предприятия экспортирован"
            : scopedAdminRole === "department_admin"
              ? "Реестр сотрудников отдела экспортирован"
              : "Реестр сотрудников экспортирован",
        );
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Не удалось экспортировать сотрудников",
      );
    }
  }

  const title =
    leadershipRole === "enterprise_director" || scopedAdminRole === "enterprise_admin"
      ? "Сотрудники предприятия"
      : leadershipRole === "department_head" || scopedAdminRole === "department_admin"
        ? "Сотрудники отдела"
        : "Сотрудники";
  const description =
    leadershipRole === "enterprise_director"
      ? `Сотрудники ${session.enterpriseName || "вашего предприятия"}. Реестр автоматически ограничен предприятием, которым вы руководите, и не включает вашу собственную карточку.`
      : leadershipRole === "department_head"
        ? `Сотрудники ${session.departmentName || "вашего отдела"}. Реестр автоматически ограничен вашим подразделением и не включает вашу собственную карточку.`
        : scopedAdminRole === "enterprise_admin"
          ? `Полный кадровый реестр ${session.enterpriseName || "вашего предприятия"}, включая сотрудников, которым отдел или должность ещё не назначены. Все действия автоматически ограничены этим предприятием.`
          : scopedAdminRole === "department_admin"
            ? `Кадровый реестр ${session.departmentName || "вашего отдела"}. Все действия автоматически ограничены этим подразделением.`
            : "Единый реестр сотрудников, их должностей, подразделений и кадрового статуса.";

  return (
    <div className="space-y-6">
      <PageHeader
        description={description}
        icon={<FiUsers />}
        actions={
          canCreateEmployees || canExportEmployees ? (
            <div className="flex flex-wrap items-center justify-end gap-3">
              {canExportEmployees && (
                <Button
                  className="border-white/20 bg-white/10 text-white hover:bg-white/15"
                  leftIcon={<FiDownload className="h-4 w-4" />}
                  onClick={() => void exportEmployees()}
                  variant="ghost"
                >
                  Экспорт CSV
                </Button>
              )}
              {canCreateEmployees && (
                <Button
                  className="border-white/20 shadow-xl hover:opacity-90"
                  leftIcon={<FiPlus className="h-4 w-4" />}
                  onClick={() => navigate("/employees/new")}
                  style={{ background: "#ffffff", color: "#0f172a" }}
                  variant="ghost"
                >
                  Добавить сотрудника
                </Button>
              )}
            </div>
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
