import { useRef } from "react";
import { FiBookOpen, FiPlus } from "react-icons/fi";
import { Navigate } from "react-router-dom";

import { useAuth } from "../features/auth/AuthContext";
import {
  HrEntityTable,
  type HrEntityTableHandle,
} from "../features/hr-table/HrEntityTable";
import { Button, PageHeader, useStoredViewMode } from "../shared/ui";

export function VacationTypesPage(): JSX.Element {
  const { hasPermission, session } = useAuth();
  const canViewVacationTypes =
    hasPermission("vacation_types.view") &&
    session.permissionScopes["vacation_types.view"] === "global";
  const canCreateVacationTypes =
    hasPermission("vacation_types.create") &&
    session.permissionScopes["vacation_types.create"] === "global";
  const [viewMode, setViewMode] = useStoredViewMode("vacation-types");
  const tableRef = useRef<HrEntityTableHandle>(null);

  if (!canViewVacationTypes) {
    return <Navigate replace to="/vacations" />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          canCreateVacationTypes ? (
            <Button
              className="border-white/20 shadow-xl hover:opacity-90"
              leftIcon={<FiPlus className="h-4 w-4" />}
              onClick={() => tableRef.current?.openCreate()}
              style={{ background: "#ffffff", color: "#0f172a" }}
              variant="ghost"
            >
              Добавить вид отпуска
            </Button>
          ) : undefined
        }
        description="Единый справочник видов отпусков, используемых при оформлении кадровых записей."
        icon={<FiBookOpen />}
        title="Виды отпусков"
      />

      <HrEntityTable
        ref={tableRef}
        entity="vacation_types"
        hideCreateButton
        hideToolbarSearch
        onViewModeChange={setViewMode}
        viewMode={viewMode}
      />
    </div>
  );
}
