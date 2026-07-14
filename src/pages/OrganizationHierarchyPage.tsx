import { useEffect, useMemo, useState } from "react";
import { FiBriefcase, FiChevronRight, FiGrid, FiLayers } from "react-icons/fi";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";

import { HrEntityTable } from "../features/hr-table/HrEntityTable";
import { hrApiClient } from "../shared/lib/hrApiClient";
import type { HrEntityKey, HrRecord } from "../shared/types/hr";
import { EmptyState, LoadingState } from "../shared/ui";

type HierarchyLevel = "enterprises" | "departments" | "positions";

export function OrganizationHierarchyPage(): JSX.Element {
  const navigate = useNavigate();
  const params = useParams();
  const enterpriseId = toId(params.enterpriseId);
  const departmentId = toId(params.departmentId);
  const level: HierarchyLevel = departmentId
    ? "positions"
    : enterpriseId
      ? "departments"
      : "enterprises";
  const [enterprise, setEnterprise] = useState<HrRecord | null>(null);
  const [department, setDepartment] = useState<HrRecord | null>(null);
  const [isLoading, setIsLoading] = useState(level !== "enterprises");
  const [hasError, setHasError] = useState(false);

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
  }, [departmentId, enterpriseId, level]);

  const page = useMemo(
    () => getPageContent(level, enterprise, department),
    [department, enterprise, level],
  );

  if (isLoading) {
    return <LoadingState label="Загрузка организационной структуры..." />;
  }

  if (hasError) {
    return (
      <EmptyState
        title="Элемент структуры не найден"
        description="Вернитесь к предприятиям и выберите существующую запись."
      />
    );
  }

  return (
    <div className="space-y-6">
      <nav
        aria-label="Организационная структура"
        className="app-muted flex flex-wrap items-center gap-2 text-sm font-bold"
      >
        <Link className="app-link-accent" to="/enterprises">
          Предприятия
        </Link>
        {enterprise && (
          <>
            <FiChevronRight className="h-4 w-4" />
            <Link
              className={level === "departments" ? "app-text" : "app-link-accent"}
              to={`/enterprises/${enterpriseId}/departments`}
            >
              {recordName(enterprise)}
            </Link>
          </>
        )}
        {department && (
          <>
            <FiChevronRight className="h-4 w-4" />
            <span className="app-text">{recordName(department)}</span>
          </>
        )}
      </nav>

      <section className="app-surface app-border flex flex-col gap-4 rounded-[24px] border p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex min-w-0 items-start gap-4">
          <span className="app-accent-soft flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[var(--accent-border)]">
            <page.icon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="app-accent-text text-xs font-black uppercase tracking-[0.16em]">
              Организационная структура
            </p>
            <h1 className="app-text mt-1 text-3xl font-black tracking-tight">
              {page.title}
            </h1>
            <p className="app-muted mt-2 max-w-3xl text-sm font-medium leading-6">
              {page.description}
            </p>
          </div>
        </div>
      </section>

      <HrEntityTable
        createInitialRecord={page.createInitialRecord}
        entity={page.entity}
        externalFilters={page.filters}
        hiddenColumnKeys={page.hiddenColumnKeys}
        onRowClick={
          level === "enterprises"
            ? (record) =>
                navigate(`/enterprises/${toId(record.id)}/departments`)
            : level === "departments"
              ? (record) =>
                  navigate(
                    `/enterprises/${enterpriseId}/departments/${toId(record.id)}/positions`,
                  )
              : undefined
        }
      />
    </div>
  );
}

function getPageContent(
  level: HierarchyLevel,
  enterprise: HrRecord | null,
  department: HrRecord | null,
): {
  createInitialRecord?: HrRecord;
  description: string;
  entity: Extract<HrEntityKey, "enterprises" | "departments" | "positions">;
  filters?: Record<string, number>;
  hiddenColumnKeys?: string[];
  icon: typeof FiLayers;
  title: string;
} {
  if (level === "departments") {
    const id = toId(enterprise?.id)!;
    return {
      createInitialRecord: { enterprise_id: id },
      description: `Отделы предприятия «${recordName(enterprise)}». Нажмите на отдел, чтобы перейти к его должностям.`,
      entity: "departments",
      filters: { enterprise_id: id },
      hiddenColumnKeys: ["enterprise_name"],
      icon: FiGrid,
      title: `Отделы · ${recordName(enterprise)}`,
    };
  }

  if (level === "positions") {
    const id = toId(department?.id)!;
    return {
      createInitialRecord: { department_id: id },
      description: `Должности отдела «${recordName(department)}» предприятия «${recordName(enterprise)}».`,
      entity: "positions",
      filters: { department_id: id },
      hiddenColumnKeys: ["department_name"],
      icon: FiBriefcase,
      title: `Должности · ${recordName(department)}`,
    };
  }

  return {
    description:
      "Выберите предприятие, чтобы открыть его отделы и перейти дальше к должностям.",
    entity: "enterprises",
    icon: FiLayers,
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
