import { useEffect, useMemo, useRef, useState } from "react";
import { FiChevronRight, FiLayers, FiPlus, FiUserCheck } from "react-icons/fi";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";

import { useAuth } from "../features/auth/AuthContext";
import {
  HrEntityTable,
  type HrEntityTableHandle,
} from "../features/hr-table/HrEntityTable";
import {
  ENTERPRISE_FILTERS_EVENT,
  getStoredEnterpriseHrFilters,
} from "../features/filters/moduleFiltersStore";
import { hrApiClient } from "../shared/lib/hrApiClient";
import type {
  HrEntityKey,
  HrFilterCondition,
  HrRecord,
} from "../shared/types/hr";
import {
  Button,
  Dialog,
  EmptyState,
  LoadingState,
  PageHeader,
  Select,
  useStoredViewMode,
  type SelectOption,
} from "../shared/ui";
import "./OrganizationHierarchyPage.css";

type HierarchyLevel = "enterprises" | "departments" | "positions";
type LeaderTarget = "enterprise" | "department";

export function OrganizationHierarchyPage(): JSX.Element {
  const navigate = useNavigate();
  const params = useParams();
  const { hasPermission, session } = useAuth();
  const tableRef = useRef<HrEntityTableHandle>(null);
  const canManage = hasPermission("organization.manage");
  const enterpriseId = toId(params.enterpriseId);
  const departmentId = toId(params.departmentId);
  const level: HierarchyLevel = departmentId
    ? "positions"
    : enterpriseId
      ? "departments"
      : "enterprises";
  const canCreate =
    canManage &&
    (level !== "enterprises" ||
      session.permissionScopes["organization.manage"] === "global");
  const [enterprise, setEnterprise] = useState<HrRecord | null>(null);
  const [department, setDepartment] = useState<HrRecord | null>(null);
  const [isLoading, setIsLoading] = useState(level !== "enterprises");
  const [hasError, setHasError] = useState(false);
  const [refreshIndex, setRefreshIndex] = useState(0);
  const [leaderTarget, setLeaderTarget] = useState<LeaderTarget | null>(null);
  const [leaderOptions, setLeaderOptions] = useState<SelectOption[]>([]);
  const [leaderId, setLeaderId] = useState("");
  const [leaderLoading, setLeaderLoading] = useState(false);
  const [enterpriseFilters, setEnterpriseFilters] = useState<
    Record<string, HrFilterCondition> | undefined
  >(getStoredEnterpriseHrFilters);

  useEffect(() => {
    let isActive = true;

    async function loadParents(): Promise<void> {
      if (level === "enterprises") {
        setEnterprise(null);
        setDepartment(null);
        setIsLoading(false);
        setHasError(false);
        return;
      }

      setIsLoading(true);
      setHasError(false);
      try {
        const [enterpriseRecord, departmentRecord] = await Promise.all([
          hrApiClient.getById({ entity: "enterprises", id: enterpriseId! }),
          departmentId
            ? hrApiClient.getById({ entity: "departments", id: departmentId })
            : Promise.resolve(null),
        ]);
        if (!isActive) return;

        const departmentEnterpriseId = toId(departmentRecord?.enterprise_id);
        if (
          !enterpriseRecord ||
          (departmentRecord && departmentEnterpriseId !== enterpriseId)
        ) {
          setHasError(true);
          return;
        }
        setEnterprise(enterpriseRecord);
        setDepartment(departmentRecord);
      } catch (error) {
        if (!isActive) return;
        setHasError(true);
        toast.error(
          error instanceof Error
            ? error.message
            : "Не удалось загрузить организационную структуру",
        );
      } finally {
        if (isActive) setIsLoading(false);
      }
    }

    void loadParents();
    return () => {
      isActive = false;
    };
  }, [departmentId, enterpriseId, level, refreshIndex]);

  useEffect(() => {
    function refreshEnterpriseFilters(): void {
      setEnterpriseFilters(getStoredEnterpriseHrFilters());
    }
    window.addEventListener(ENTERPRISE_FILTERS_EVENT, refreshEnterpriseFilters);
    window.addEventListener("storage", refreshEnterpriseFilters);
    return () => {
      window.removeEventListener(ENTERPRISE_FILTERS_EVENT, refreshEnterpriseFilters);
      window.removeEventListener("storage", refreshEnterpriseFilters);
    };
  }, []);

  const page = useMemo(
    () => getPageContent(level, enterprise, department),
    [department, enterprise, level],
  );
  const [viewMode, setViewMode] = useStoredViewMode(
    `organization-${page.entity}`,
  );

  async function openLeaderDialog(target: LeaderTarget): Promise<void> {
    if (!canManage) return;
    setLeaderLoading(true);
    setLeaderTarget(target);
    try {
      const currentId =
        target === "enterprise"
          ? enterprise?.general_director_employee_id
          : department?.director_employee_id;
      setLeaderId(currentId ? String(currentId) : "");

      const employeeFilters =
        target === "department"
          ? { department_id: departmentId! }
          : await getEnterpriseEmployeeFilter(enterpriseId!);
      const result = await hrApiClient.list({
        entity: "employees",
        page: 1,
        pageSize: 100,
        filters: {
          ...employeeFilters,
          status: "active",
        },
        orderBy: "last_name",
      });
      setLeaderOptions(
        result.items.map((employee) => ({
          value: String(employee.id),
          label: [employee.last_name, employee.first_name, employee.middle_name]
            .filter(Boolean)
            .join(" "),
        })),
      );
    } catch (error) {
      setLeaderTarget(null);
      toast.error(getErrorMessage(error, "Не удалось загрузить сотрудников для назначения"));
    } finally {
      setLeaderLoading(false);
    }
  }

  async function saveLeader(): Promise<void> {
    if (!leaderTarget) return;
    setLeaderLoading(true);
    try {
      if (leaderTarget === "enterprise" && enterpriseId) {
        await hrApiClient.update({
          entity: "enterprises",
          id: enterpriseId,
          data: {
            general_director_employee_id: leaderId ? Number(leaderId) : null,
          },
        });
      }
      if (leaderTarget === "department" && departmentId) {
        await hrApiClient.update({
          entity: "departments",
          id: departmentId,
          data: {
            director_employee_id: leaderId ? Number(leaderId) : null,
          },
        });
      }
      toast.success(
        leaderId ? "Руководитель назначен" : "Руководитель снят с назначения",
      );
      setLeaderTarget(null);
      setRefreshIndex((value) => value + 1);
    } catch (error) {
      toast.error(getErrorMessage(error, "Не удалось сохранить назначение руководителя"));
    } finally {
      setLeaderLoading(false);
    }
  }

  if (isLoading) {
    return <LoadingState label="Загрузка организационной структуры..." />;
  }

  if (hasError) {
    return (
      <EmptyState
        description="Вернитесь к предприятиям и выберите существующую запись."
        title="Элемент структуры не найден"
      />
    );
  }

  const breadcrumbs =
    enterprise || department ? (
      <nav
        aria-label="Организационная структура"
        className="flex flex-wrap items-center gap-2 text-sm font-bold text-white/80"
      >
        <Link className="transition hover:text-white" to="/enterprises">
          Предприятия
        </Link>
        {enterprise && (
          <>
            <FiChevronRight className="h-4 w-4" />
            <Link
              className="transition hover:text-white"
              to={`/enterprises/${enterpriseId}/departments`}
            >
              {recordName(enterprise)}
            </Link>
          </>
        )}
        {department && (
          <>
            <FiChevronRight className="h-4 w-4" />
            <span className="text-white">{recordName(department)}</span>
          </>
        )}
      </nav>
    ) : undefined;

  const headerActions = (
    <div className="flex flex-wrap items-center justify-end gap-3">
      {breadcrumbs}
      {canManage && level === "departments" && enterprise && (
        <Button
          className="border-white/20 bg-white/10 text-white"
          leftIcon={<FiUserCheck className="h-4 w-4" />}
          onClick={() => void openLeaderDialog("enterprise")}
          variant="ghost"
        >
          Руководитель предприятия
        </Button>
      )}
      {canManage && level === "positions" && department && (
        <Button
          className="border-white/20 bg-white/10 text-white"
          leftIcon={<FiUserCheck className="h-4 w-4" />}
          onClick={() => void openLeaderDialog("department")}
          variant="ghost"
        >
          Руководитель отдела
        </Button>
      )}
      {canCreate && (
        <Button
          className="border-white/20 shadow-xl hover:opacity-90"
          leftIcon={<FiPlus className="h-4 w-4" />}
          onClick={() => tableRef.current?.openCreate()}
          style={{ background: "#ffffff", color: "#0f172a" }}
          variant="ghost"
        >
          {page.createLabel}
        </Button>
      )}
    </div>
  );

  const headerDescription =
    level === "enterprises"
      ? "Организационная структура предприятий, отделов и должностей."
      : level === "departments"
        ? "Подразделения выбранного предприятия и назначение ответственных руководителей."
        : "Должности выбранного отдела и их место в организационной структуре.";

  return (
    <div className="space-y-6">
      <PageHeader
        actions={headerActions}
        description={headerDescription}
        icon={<FiLayers />}
        title={page.title}
      />

      <HrEntityTable
        ref={tableRef}
        className={`organization-entity-table${canManage ? "" : " organization-entity-table--read-only"}`}
        createInitialRecord={page.createInitialRecord}
        entity={page.entity}
        externalFilters={
          level === "enterprises" ? enterpriseFilters : page.filters
        }
        hiddenColumnKeys={page.hiddenColumnKeys}
        hideCreateButton
        hideToolbarSearch
        onRowClick={
          level === "enterprises"
            ? (record) => navigate(`/enterprises/${toId(record.id)}/departments`)
            : level === "departments"
              ? (record) =>
                  navigate(
                    `/enterprises/${enterpriseId}/departments/${toId(record.id)}/positions`,
                  )
              : undefined
        }
        onViewModeChange={setViewMode}
        viewMode={viewMode}
      />

      <Dialog
        description={
          leaderTarget === "enterprise"
            ? "Выберите активного сотрудника этого предприятия. При наличии учётной записи ему автоматически будет выдана системная роль руководителя предприятия."
            : "Выберите активного сотрудника этого отдела. При наличии учётной записи ему автоматически будет выдана системная роль руководителя отдела."
        }
        onOpenChange={(open) => !open && setLeaderTarget(null)}
        open={Boolean(leaderTarget)}
        title={
          leaderTarget === "enterprise"
            ? "Назначить руководителя предприятия"
            : "Назначить руководителя отдела"
        }
      >
        {leaderLoading && leaderOptions.length === 0 ? (
          <LoadingState label="Загрузка сотрудников..." />
        ) : (
          <div className="grid gap-5">
            <label className="grid gap-2">
              <span className="app-text text-sm font-black">Сотрудник</span>
              <Select
                allowEmpty
                emptyOptionLabel="Не назначен"
                onValueChange={setLeaderId}
                options={leaderOptions}
                placeholder="Выберите сотрудника"
                value={leaderId}
              />
            </label>
            <div className="flex justify-end gap-3">
              <Button
                onClick={() => setLeaderTarget(null)}
                type="button"
                variant="secondary"
              >
                Отмена
              </Button>
              <Button disabled={leaderLoading} onClick={() => void saveLeader()}>
                Сохранить назначение
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}

async function getEnterpriseEmployeeFilter(
  enterpriseId: number,
): Promise<{ department_id: { operator: "in"; value: number[] } }> {
  const departments = await hrApiClient.list({
    entity: "departments",
    page: 1,
    pageSize: 100,
    filters: { enterprise_id: enterpriseId },
    orderBy: "name",
  });
  return {
    department_id: {
      operator: "in",
      value: departments.items.map((item) => Number(item.id)).filter(Number.isFinite),
    },
  };
}

function getPageContent(
  level: HierarchyLevel,
  enterprise: HrRecord | null,
  department: HrRecord | null,
): {
  createInitialRecord?: HrRecord;
  createLabel: string;
  entity: Extract<HrEntityKey, "enterprises" | "departments" | "positions">;
  filters?: Record<string, number>;
  hiddenColumnKeys?: string[];
  title: string;
} {
  if (level === "departments") {
    const id = toId(enterprise?.id)!;
    return {
      createInitialRecord: { enterprise_id: id },
      createLabel: "Добавить отдел",
      entity: "departments",
      filters: { enterprise_id: id },
      hiddenColumnKeys: ["enterprise_name"],
      title: `Отделы · ${recordName(enterprise)}`,
    };
  }

  if (level === "positions") {
    const id = toId(department?.id)!;
    return {
      createInitialRecord: { department_id: id },
      createLabel: "Добавить должность",
      entity: "positions",
      filters: { department_id: id },
      hiddenColumnKeys: ["department_name"],
      title: `Должности · ${recordName(department)}`,
    };
  }

  return {
    createLabel: "Добавить предприятие",
    entity: "enterprises",
    title: "Предприятия",
  };
}

function recordName(record: HrRecord | null): string {
  return String(record?.name ?? "Без названия");
}

function toId(value: unknown): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback;
  const parts = error.message.split("Error: ");
  return parts[parts.length - 1] || fallback;
}
