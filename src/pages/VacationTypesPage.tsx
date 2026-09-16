import { useRef } from "react";
import { FiBookOpen } from "react-icons/fi";
import { Navigate } from "react-router-dom";

import { useAuth } from "../features/auth/AuthContext";
import { useAppText } from "../shared/i18n";
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
  const text = useAppText();
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
    ? text(
        "Справочники видов отпусков по предприятиям. Каждый вид принадлежит одному юридическому лицу.",
        "Vacation type directories by enterprise. Each type belongs to one legal entity.",
      )
    : text(
        `Справочник видов отпусков предприятия «${session.enterpriseName || "текущее предприятие"}». Изменения не затрагивают другие предприятия.`,
        `Vacation types for enterprise “${session.enterpriseName || "current enterprise"}”. Changes do not affect other enterprises.`,
      );

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          canCreateVacationTypes ? (
            <ActionButton
              action="create"
              onClick={() => tableRef.current?.openCreate()}
            >
              {text("Добавить вид отпуска", "Add vacation type")}
            </ActionButton>
          ) : undefined
        }
        description={description}
        icon={<FiBookOpen />}
        title={text("Виды отпусков", "Vacation types")}
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
