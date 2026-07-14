import { useEffect, useMemo, useState } from "react";
import { FiChevronRight } from "react-icons/fi";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";

import { HrEntityTable } from "../features/hr-table/HrEntityTable";
import { hrApiClient } from "../shared/lib/hrApiClient";
import type { HrEntityKey, HrRecord } from "../shared/types/hr";
import { EmptyState, LoadingState, PageHeader } from "../shared/ui";

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

  if (isLoading) return <LoadingState label="Загрузка организационной структуры..." />;

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

  return (
    <div className="space-y-6">
      <PageHeader actions={breadcrumbs} title={page.title} />

      <HrEntityTable
        className="organization-entity-table"
        createInitialRecord={page.createInitialRecord}
        entity={page.entity}
        externalFilters={page.filters}
        hiddenColumnKeys={page.hiddenColumnKeys}
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
  entity: Extract<HrEntityKey, "enterprises" | "departments" | "positions">;
  filters?: Record<string, number>;
  hiddenColumnKeys?: string[];
  title: string;
} {
  if (level === "departments") {
    const id = toId(enterprise?.id)!;
    return {
      createInitialRecord: { enterprise_id: id },
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
      entity: "positions",
      filters: { department_id: id },
      hiddenColumnKeys: ["department_name"],
      title: `Должности · ${recordName(department)}`,
    };
  }

  return {
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
