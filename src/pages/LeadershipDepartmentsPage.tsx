import { FiGrid } from "react-icons/fi";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../features/auth/AuthContext";
import { HrEntityTable } from "../features/hr-table/HrEntityTable";
import { getLeadershipRole } from "../shared/access/leadership";
import type { HrFilterCondition, HrRecord } from "../shared/types/hr";
import { EmptyState, PageHeader, useStoredViewMode } from "../shared/ui";

export function LeadershipDepartmentsPage(): JSX.Element {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [viewMode, setViewMode] = useStoredViewMode("leadership-departments");
  const leadershipRole = getLeadershipRole(session.roles);

  if (leadershipRole !== "enterprise_director") {
    return (
      <EmptyState
        title="Раздел недоступен"
        description="Список отделов предприятия предназначен для директора предприятия."
      />
    );
  }

  if (!session.enterpriseId) {
    return (
      <EmptyState
        title="Предприятие не определено"
        description="Для учётной записи директора не удалось определить предприятие. Проверьте назначение руководителя."
      />
    );
  }

  const filters: Record<string, HrFilterCondition> = {
    enterprise_id: { operator: "equals", value: session.enterpriseId },
  };

  function openDepartment(record: HrRecord): void {
    const departmentId = Number(record.id);
    if (!Number.isInteger(departmentId) || departmentId < 1) return;
    navigate(
      `/enterprises/${session.enterpriseId}/departments/${departmentId}`,
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        description={`Подразделения ${session.enterpriseName || "вашего предприятия"}. Здесь отображается только структура предприятия, которым вы руководите.`}
        eyebrow="Структура предприятия"
        icon={<FiGrid />}
        title="Отделы"
      />

      <HrEntityTable
        entity="departments"
        externalFilters={filters}
        hiddenColumnKeys={["enterprise_name"]}
        hideCreateButton
        onRowClick={openDepartment}
        onViewModeChange={setViewMode}
        viewMode={viewMode}
      />
    </div>
  );
}
