import { useEffect, useMemo, useState } from "react";
import { FiUsers } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import type { HrFilterCondition, HrRecord } from "../../shared/types/hr";
import {
  ActionButton,
  LoadingState,
  PageHeader,
  useStoredViewMode,
} from "../../shared/ui";
import { useAuth } from "../../features/auth/AuthContext";
import { HrEntityTable } from "../../features/hr-table/HrEntityTable";
import { hrApiClient } from "../../shared/lib/hrApiClient";
import { getLeadershipRole } from "../../shared/access/leadership";
import { getScopedAdminRole } from "../../shared/access/scopedAdmin";
import { useAppText } from "../../shared/i18n";
import {
  EMPLOYEE_FILTERS_EVENT,
  getStoredEmployeeHrFilters,
} from "../../features/filters/employeeFiltersStore";

export function EmployeesPage(): JSX.Element {
  const text = useAppText();
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
            : text("Не удалось подготовить список сотрудников", "Failed to prepare employee list"),
        );
      });

    return () => {
      active = false;
    };
  }, [isLeadershipDirectory, session.employeeId, text]);

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
            ? text("Реестр сотрудников предприятия экспортирован", "Enterprise employee registry exported")
            : scopedAdminRole === "department_admin"
              ? text("Реестр сотрудников отдела экспортирован", "Department employee registry exported")
              : text("Реестр сотрудников экспортирован", "Employee registry exported"),
        );
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : text("Не удалось экспортировать сотрудников", "Failed to export employees"),
      );
    }
  }

  const title =
    leadershipRole === "enterprise_director" || scopedAdminRole === "enterprise_admin"
      ? text("Сотрудники предприятия", "Enterprise employees")
      : leadershipRole === "department_head" || scopedAdminRole === "department_admin"
        ? text("Сотрудники отдела", "Department employees")
        : text("Сотрудники", "Employees");
  const description =
    leadershipRole === "enterprise_director"
      ? text(
          `Сотрудники ${session.enterpriseName || "вашего предприятия"}. Реестр автоматически ограничен предприятием, которым вы руководите, и не включает вашу собственную карточку.`,
          `Employees of ${session.enterpriseName || "your enterprise"}. The registry is automatically limited to the enterprise you lead and excludes your own profile.`,
        )
      : leadershipRole === "department_head"
        ? text(
            `Сотрудники ${session.departmentName || "вашего отдела"}. Реестр автоматически ограничен вашим подразделением и не включает вашу собственную карточку.`,
            `Employees of ${session.departmentName || "your department"}. The registry is automatically limited to your department and excludes your own profile.`,
          )
        : scopedAdminRole === "enterprise_admin"
          ? text(
              `Полный кадровый реестр ${session.enterpriseName || "вашего предприятия"}, включая сотрудников, которым отдел или должность ещё не назначены. Все действия автоматически ограничены этим предприятием.`,
              `Full HR registry for ${session.enterpriseName || "your enterprise"}, including employees who do not yet have a department or position. All actions are limited to this enterprise.`,
            )
          : scopedAdminRole === "department_admin"
            ? text(
                `Кадровый реестр ${session.departmentName || "вашего отдела"}. Все действия автоматически ограничены этим подразделением.`,
                `HR registry for ${session.departmentName || "your department"}. All actions are limited to this department.`,
              )
            : text(
                "Единый реестр сотрудников, их должностей, подразделений и кадрового статуса.",
                "Unified registry of employees, positions, departments, and employment status.",
              );

  return (
    <div className="space-y-6">
      <PageHeader
        description={description}
        icon={<FiUsers />}
        actions={
          canCreateEmployees || canExportEmployees ? (
            <div className="flex flex-wrap items-center justify-end gap-3">
              {canExportEmployees && (
                <ActionButton
                  action="export"
                  onClick={() => void exportEmployees()}
                >
                  {text("Экспорт CSV", "Export CSV")}
                </ActionButton>
              )}
              {canCreateEmployees && (
                <ActionButton
                  action="create"
                  onClick={() => navigate("/employees/new")}
                >
                  {text("Добавить сотрудника", "Add employee")}
                </ActionButton>
              )}
            </div>
          ) : undefined
        }
        title={title}
      />

      {isLeadershipDirectory && directoryEmployeeIds === null ? (
        <section className="app-surface app-border rounded-[28px] border px-5 py-16">
          <LoadingState label={text("Подготовка списка сотрудников...", "Preparing employee list...")} />
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
