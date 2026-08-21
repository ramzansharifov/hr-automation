import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./app/AppLayout";
import { AuthProvider } from "./features/auth/AuthProvider";
import { AuthSessionSynchronizer } from "./features/auth/AuthSessionSynchronizer";
import {
  AuthorizedHome,
  OwnProfileRedirect,
  RequirePermission,
} from "./features/auth/PermissionRoute";
import { AuditLogPage } from "./pages/AuditLogPage";
import { DashboardPage } from "./pages/DashboardPage";
import { FiltersPage } from "./pages/FiltersPage";
import { OrganizationHierarchyPage } from "./pages/OrganizationHierarchyPage";
import { SettingsPage } from "./pages/SettingsPage";
import { VacationTypesPage } from "./pages/VacationTypesPage";
import { VacationsPage } from "./pages/VacationsPage";
import { AccessRolesPage } from "./pages/access/AccessRolesPage";
import { AccessUsersPage } from "./pages/access/AccessUsersPage";
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
      <AppLayout />
    </>
  );
}

function App(): JSX.Element {
  return (
    <AuthProvider>
      <Routes>
        <Route element={<AuthenticatedLayout />}>
          <Route index element={<AuthorizedHome />} />
          <Route path="dashboard" element={<RequirePermission anyOf={["dashboard.view"]}><DashboardPage /></RequirePermission>} />
          <Route path="employees" element={<RequirePermission anyOf={["employees.view"]}><EmployeesPage /></RequirePermission>} />
          <Route path="employees/new" element={<RequirePermission anyOf={["employees.manage"]}><EmployeeCreatePage /></RequirePermission>} />
          <Route path="employees/:id" element={<RequirePermission anyOf={["employees.view", "profile.view"]}><EmployeeDetailsPage /></RequirePermission>} />
          <Route path="filters" element={<RequirePermission anyOf={["filters.use"]}><FiltersPage /></RequirePermission>} />
          <Route path="vacancies" element={<RequirePermission anyOf={["recruitment.view"]}><VacanciesPage /></RequirePermission>} />
          <Route path="vacancies/new" element={<RequirePermission anyOf={["recruitment.manage"]}><VacancyFormPage /></RequirePermission>} />
          <Route path="vacancies/:id" element={<RequirePermission anyOf={["recruitment.view"]}><VacancyDetailsPage /></RequirePermission>} />
          <Route path="vacancies/:id/edit" element={<RequirePermission anyOf={["recruitment.manage"]}><VacancyFormPage /></RequirePermission>} />
          <Route path="candidates" element={<RequirePermission anyOf={["recruitment.view"]}><CandidatesPage /></RequirePermission>} />
          <Route path="users" element={<RequirePermission anyOf={["access.manage"]}><AccessUsersPage /></RequirePermission>} />
          <Route path="roles" element={<RequirePermission anyOf={["access.manage"]}><AccessRolesPage /></RequirePermission>} />
          <Route path="access" element={<Navigate to="/users" replace />} />
          <Route path="audit" element={<RequirePermission anyOf={["audit.view"]}><AuditLogPage /></RequirePermission>} />
          <Route path="enterprises" element={<RequirePermission anyOf={["organization.view"]}><OrganizationHierarchyPage /></RequirePermission>} />
          <Route path="enterprises/:enterpriseId/departments" element={<RequirePermission anyOf={["organization.view"]}><OrganizationHierarchyPage /></RequirePermission>} />
          <Route path="enterprises/:enterpriseId/departments/:departmentId/positions" element={<RequirePermission anyOf={["organization.view"]}><OrganizationHierarchyPage /></RequirePermission>} />
          <Route path="departments" element={<Navigate to="/enterprises" replace />} />
          <Route path="positions" element={<Navigate to="/enterprises" replace />} />
          <Route path="vacations" element={<RequirePermission anyOf={["vacations.view"]}><VacationsPage /></RequirePermission>} />
          <Route path="vacation-types" element={<RequirePermission anyOf={["vacations.manage"]}><VacationTypesPage /></RequirePermission>} />
          <Route path="profile" element={<RequirePermission anyOf={["profile.view"]}><OwnProfileRedirect /></RequirePermission>} />
          <Route path="settings" element={<SettingsPage />} />
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
