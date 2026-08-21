import { FiBookOpen } from "react-icons/fi";
import { Navigate } from "react-router-dom";

import { useAuth } from "../features/auth/AuthContext";
import { HrEntityTable } from "../features/hr-table/HrEntityTable";
import {
  PageHeader,
  ViewModeToggle,
  useStoredViewMode,
} from "../shared/ui";

export function VacationTypesPage(): JSX.Element {
  const { hasPermission, session } = useAuth();
  const canAdministerVacationTypes =
    hasPermission("vacations.manage") &&
    session.permissionScopes["vacations.manage"] === "global";
  const [viewMode, setViewMode] = useStoredViewMode("vacation-types");

  if (!canAdministerVacationTypes) {
    return <Navigate replace to="/vacations" />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        description="Единый справочник видов отпусков, используемых при оформлении кадровых записей."
        icon={<FiBookOpen />}
        title="Виды отпусков"
      />

      <div className="flex justify-start">
        <ViewModeToggle onChange={setViewMode} value={viewMode} />
      </div>

      <HrEntityTable
        entity="vacation_types"
        onViewModeChange={setViewMode}
        viewMode={viewMode}
      />
    </div>
  );
}
