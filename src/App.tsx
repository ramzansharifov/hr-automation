import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./app/AppLayout";
import { AuthProvider } from "./features/auth/AuthProvider";
import { AuthSessionSynchronizer } from "./features/auth/AuthSessionSynchronizer";
import {
  AuthorizedHome,
  OwnProfileRedirect,
  RequirePermission,
} from "./features/auth/PermissionRoute";
import {
  BusinessContextProvider,
  BusinessContextRoute,
} from "./features/business-context/BusinessContext";
import { AnalyticsPage } from "./pages/AnalyticsPage";
import { AuditLogPage } from "./pages/AuditLogPage";
import { DataExchangePage } from "./pages/DataExchangePage";
import { DepartmentWorkspaceRoutePage } from "./pages/DepartmentWorkspaceRoutePage";
import { DocumentTypesPage } from "./pages/DocumentTypesPage";
import { EmployeeWorkspacePage } from "./pages/EmployeeWorkspacePage";
import { EnterpriseWorkspaceRoutePage } from "./pages/EnterpriseWorkspaceRoutePage";
import { FiltersPage } from "./pages/FiltersPage";
import { LeadershipDepartmentsPage } from "./pages/LeadershipDepartmentsPage";
import { OrganizationDetailsPage } from "./pages/OrganizationDetailsPage";
import { OrganizationHierarchyPage } from "./pages/OrganizationHierarchyPage";
import { RoleAwareDashboardPage } from "./pages/RoleAwareDashboardPage";
import { SettingsPage } from "./pages/SettingsPage";
import { VacationTypesPage } from "./pages/VacationTypesPage";
import { VacationsPage } from "./pages/VacationsPage";
import {
  AccessRoleDetailsRoutePage,
  AccessRoleFormRoutePage,
  AccessUsersRoutePage,
} from "./pages/access/AccessRoutePages";
import { AccessRolesPage } from "./pages/access/AccessRolesPage";
import { EmployeeCreatePage } from "./pages/employees/EmployeeCreatePage";
import { EmployeeDetailsPage } from "./pages/employees/EmployeeDetailsPage";
import { EmployeesPage } from "./pages/employees/EmployeesPage";
import { CandidatesPage } from "./pages/recruitment/CandidatesPage";
import { VacanciesPage } from "./pages/recruitment/VacanciesPage";
import { VacancyDetailsPage } from "./pages/recruitment/VacancyDetailsPage";
import { VacancyFormPage } from "./pages/recruitment/VacancyFormPage";
import { EmptyState } from "./shared/ui";

function AuthenticatedLayout(): JSX.Element {
  return (
    <>
      <AuthSessionSynchronizer />
      <BusinessContextProvider>
        <AppLayout />
      </BusinessContextProvider>
    </>
  );
}

function App(): JSX.Element {
  return (
    <AuthProvider>
      <Routes>
        <Route element={<AuthenticatedLayout />}>
          <Route index element={<AuthorizedHome />} />

          <Route element={<BusinessContextRoute />}>
            <Route path="dashboard" element={<RequirePermission anyOf={["dashboard.view"]}><RoleAwareDashboardPage /></RequirePermission>} />
            <Route path="attention" element={<Navigate to="/dashboard" replace />} />
            <Route path="analytics" element={<RequirePermission anyOf={["analytics.view"]}><AnalyticsPage /></RequirePermission>} />
            <Route path="leave-management" element={<Navigate to="/vacations" replace />} />
            <Route path="data-exchange" element={<RequirePermission anyOf={["data_exchange.import", "data_exchange.export"]}><DataExchangePage /></RequirePermission>} />
            <Route path="management/departments" element={<RequirePermission anyOf={["organization.view"]}><LeadershipDepartmentsPage /></RequirePermission>} />
            <Route path="vacancies" element={<RequirePermission anyOf={["vacancies.view"]}><VacanciesPage /></RequirePermission>} />
            <Route path="vacancies/new" element={<RequirePermission anyOf={["vacancies.create"]}><VacancyFormPage /></RequirePermission>} />
            <Route path="vacancies/:id" element={<RequirePermission anyOf={["vacancies.view"]}><VacancyDetailsPage /></RequirePermission>} />
            <Route path="vacancies/:id/edit" element={<RequirePermission anyOf={["vacancies.edit"]}><VacancyFormPage /></RequirePermission>} />
            <Route path="candidates" element={<RequirePermission anyOf={["candidates.view"]}><CandidatesPage /></RequirePermission>} />
            <Route path="vacations" element={<RequirePermission anyOf={["vacations.view"]}><VacationsPage /></RequirePermission>} />
            <Route path="vacation-types" element={<RequirePermission anyOf={["vacation_types.view"]}><VacationTypesPage /></RequirePermission>} />
            <Route path="document-types" element={<RequirePermission anyOf={["document_types.view"]}><DocumentTypesPage /></RequirePermission>} />
            <Route path="filters" element={<RequirePermission anyOf={["filters.use"]}><FiltersPage /></RequirePermission>} />
          </Route>

          <Route path="team" element={<RequirePermission anyOf={["directory.view"]}><Navigate to="/my-enterprise" replace /></RequirePermission>} />
          <Route path="my-enterprise" element={<RequirePermission anyOf={["directory.view"]}><EnterpriseWorkspaceRoutePage /></RequirePermission>} />
          <Route path="my-department" element={<RequirePermission anyOf={["directory.view"]}><DepartmentWorkspaceRoutePage /></RequirePermission>} />
          <Route path="colleagues" element={<RequirePermission anyOf={["directory.view"]}><EmployeeWorkspacePage section="colleagues" /></RequirePermission>} />

          <Route path="employees" element={<RequirePermission anyOf={["employees.view"]}><EmployeesPage /></RequirePermission>} />
          <Route path="employees/new" element={<RequirePermission anyOf={["employees.create"]}><EmployeeCreatePage /></RequirePermission>} />
          <Route path="employees/:id" element={<RequirePermission anyOf={["employees.view", "profile.view"]}><EmployeeDetailsPage /></RequirePermission>} />
          <Route path="documents" element={<Navigate to="/employees" replace />} />

          <Route path="users" element={<RequirePermission anyOf={["users.view"]}><AccessUsersRoutePage /></RequirePermission>} />
          <Route path="roles" element={<RequirePermission anyOf={["roles.view"]}><AccessRolesPage /></RequirePermission>} />
          <Route path="roles/new" element={<RequirePermission anyOf={["roles.create"]}><AccessRoleFormRoutePage /></RequirePermission>} />
          <Route path="roles/:id/edit" element={<RequirePermission anyOf={["roles.edit"]}><AccessRoleFormRoutePage /></RequirePermission>} />
          <Route path="roles/:id" element={<RequirePermission anyOf={["roles.view"]}><AccessRoleDetailsRoutePage /></RequirePermission>} />
          <Route path="access" element={<Navigate to="/users" replace />} />
          <Route path="audit" element={<RequirePermission anyOf={["audit.view"]}><AuditLogPage /></RequirePermission>} />

          <Route path="enterprises" element={<RequirePermission anyOf={["organization.view"]}><OrganizationHierarchyPage /></RequirePermission>} />
          <Route path="enterprises/:enterpriseId" element={<RequirePermission anyOf={["organization.view"]}><OrganizationDetailsPage /></RequirePermission>} />
          <Route path="enterprises/:enterpriseId/departments" element={<RequirePermission anyOf={["organization.view"]}><OrganizationHierarchyPage /></RequirePermission>} />
          <Route path="enterprises/:enterpriseId/departments/:departmentId" element={<RequirePermission anyOf={["organization.view"]}><OrganizationDetailsPage /></RequirePermission>} />
          <Route path="enterprises/:enterpriseId/departments/:departmentId/positions" element={<RequirePermission anyOf={["organization.view"]}><OrganizationHierarchyPage /></RequirePermission>} />
          <Route path="departments" element={<Navigate to="/enterprises" replace />} />
          <Route path="positions" element={<Navigate to="/enterprises" replace />} />

          <Route path="profile" element={<RequirePermission anyOf={["profile.view"]}><OwnProfileRedirect /></RequirePermission>} />
          <Route path="settings" element={<RequirePermission anyOf={["settings.view"]}><SettingsPage /></RequirePermission>} />
          <Route
            path="no-access"
            element={
              <EmptyState
                title="Нет доступных разделов"
                description="Обратитесь к superadmin, чтобы назначить пользователю хотя бы одну роль с разрешениями."
              />
            }
          />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;
