import { FiGrid } from "react-icons/fi";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../features/auth/AuthContext";
import { HrEntityTable } from "../features/hr-table/HrEntityTable";
import { getLeadershipRole } from "../shared/access/leadership";
import { getScopedAdminRole } from "../shared/access/scopedAdmin";
import { useAppText } from "../shared/i18n";
import type { HrFilterCondition, HrRecord } from "../shared/types/hr";
import { EmptyState, PageHeader, useStoredViewMode } from "../shared/ui";

export function LeadershipDepartmentsPage(): JSX.Element {
  const text = useAppText();
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
        title={text("Раздел недоступен", "Section unavailable")}
        description={text("Список отделов доступен руководителю и администратору предприятия.", "The department list is available to the enterprise director and enterprise administrator.")}
      />
    );
  }

  if (!session.enterpriseId) {
    return (
      <EmptyState
        title={text("Предприятие не определено", "Enterprise not determined")}
        description={text("Для текущей учётной записи не удалось определить предприятие. Проверьте организационную привязку сотрудника.", "The enterprise could not be determined for the current account. Check the employee organization assignment.")}
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
            ? text(
                `Все подразделения ${session.enterpriseName || "вашего предприятия"}. Здесь можно создавать отделы и открывать их для управления должностями, руководителем и данными подразделения.`,
                `All departments of ${session.enterpriseName || "your enterprise"}. You can create departments and open them to manage positions, leadership, and department data.`,
              )
            : text(
                `Подразделения ${session.enterpriseName || "вашего предприятия"}. Здесь отображается только структура предприятия, которым вы руководите.`,
                `Departments of ${session.enterpriseName || "your enterprise"}. Only the structure of the enterprise you lead is shown here.`,
              )
        }
        eyebrow={text("Структура предприятия", "Enterprise structure")}
        icon={<FiGrid />}
        title={text("Отделы", "Departments")}
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
