import { FiGrid } from "react-icons/fi";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../features/auth/AuthContext";
import { HrEntityTable } from "../features/hr-table/HrEntityTable";
import { getLeadershipRole } from "../shared/access/leadership";
import { getScopedAdminRole } from "../shared/access/scopedAdmin";
import type { HrFilterCondition, HrRecord } from "../shared/types/hr";
import { EmptyState, PageHeader, useStoredViewMode } from "../shared/ui";

export function LeadershipDepartmentsPage(): JSX.Element {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [viewMode, setViewMode] = useStoredViewMode("leadership-departments");
  const leadershipRole = getLeadershipRole(session.roles);
  const scopedAdminRole = getScopedAdminRole(session.roles);
  const canManageEnterprise = scopedAdminRole === "enterprise_admin";
  const canOpenEnterpriseDepartments =
    leadershipRole === "enterprise_director" || canManageEnterprise;

  if (!canOpenEnterpriseDepartments) {
    return (
      <EmptyState
        title="Раздел недоступен"
        description="Список отделов доступен руководителю и администратору предприятия."
      />
    );
  }

  if (!session.enterpriseId) {
    return (
      <EmptyState
        title="Предприятие не определено"
        description="Для текущей учётной записи не удалось определить предприятие. Проверьте организационную привязку сотрудника."
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
        description={
          canManageEnterprise
            ? `Все подразделения ${session.enterpriseName || "вашего предприятия"}. Здесь можно создавать отделы и открывать их для управления должностями, руководителем и данными подразделения.`
            : `Подразделения ${session.enterpriseName || "вашего предприятия"}. Здесь отображается только структура предприятия, которым вы руководите.`
        }
        eyebrow="Структура предприятия"
        icon={<FiGrid />}
        title="Отделы"
      />

      <HrEntityTable
        entity="departments"
        externalFilters={filters}
        hiddenColumnKeys={["enterprise_name"]}
        onRowClick={openDepartment}
        onViewModeChange={setViewMode}
        viewMode={viewMode}
      />
    </div>
  );
}
