import { useRef } from "react";
import { FiBookOpen } from "react-icons/fi";
import { Navigate } from "react-router-dom";

import { useAuth } from "../features/auth/AuthContext";
import {
  HrEntityTable,
  type HrEntityTableHandle,
} from "../features/hr-table/HrEntityTable";
import {
  ActionButton,
  PageHeader,
  useStoredViewMode,
} from "../shared/ui";

export function VacationTypesPage(): JSX.Element {
  const { hasPermission, session } = useAuth();
  const canViewVacationTypes = hasPermission("vacation_types.view");
  const canCreateVacationTypes = hasPermission("vacation_types.create");
  const isGlobalScope =
    session.permissionScopes["vacation_types.view"] === "global";
  const [viewMode, setViewMode] = useStoredViewMode("vacation-types");
  const tableRef = useRef<HrEntityTableHandle>(null);

  if (!canViewVacationTypes) {
    return <Navigate replace to="/vacations" />;
  }

  const description = isGlobalScope
    ? "Справочники видов отпусков по предприятиям. Каждый вид принадлежит одному юридическому лицу."
    : `Справочник видов отпусков предприятия «${session.enterpriseName || "текущее предприятие"}». Изменения не затрагивают другие предприятия.`;

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          canCreateVacationTypes ? (
            <ActionButton
              action="create"
              onClick={() => tableRef.current?.openCreate()}
            >
              Добавить вид отпуска
            </ActionButton>
          ) : undefined
        }
        description={description}
        icon={<FiBookOpen />}
        title="Виды отпусков"
      />

      <HrEntityTable
        ref={tableRef}
        createInitialRecord={
          session.enterpriseId ? { enterprise_id: session.enterpriseId } : undefined
        }
        entity="vacation_types"
        hiddenColumnKeys={isGlobalScope ? [] : ["enterprise_name"]}
        hiddenFormFieldNames={isGlobalScope ? [] : ["enterprise_id"]}
        hideCreateButton
        hideToolbarSearch
        onViewModeChange={setViewMode}
        viewMode={viewMode}
      />
    </div>
  );
}
