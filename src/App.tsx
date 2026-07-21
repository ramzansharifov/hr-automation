import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./app/AppLayout";
import { AuthProvider } from "./features/auth/AuthProvider";
import {
  AuthorizedHome,
  OwnProfileRedirect,
  RequirePermission,
} from "./features/auth/PermissionRoute";
import { DashboardPage } from "./pages/DashboardPage";
import { OrganizationHierarchyPage } from "./pages/OrganizationHierarchyPage";
import { FiltersPage } from "./pages/FiltersPage";
import { AccessControlPage } from "./pages/access/AccessControlPage";
import { EmployeeCreatePage } from "./pages/employees/EmployeeCreatePage";
import { EmployeeDetailsPage } from "./pages/employees/EmployeeDetailsPage";
import { EmployeesPage } from "./pages/employees/EmployeesPage";
import { SettingsPage } from "./pages/SettingsPage";
import { CandidatesPage } from "./pages/recruitment/CandidatesPage";
import { VacanciesPage } from "./pages/recruitment/VacanciesPage";
import { VacancyFormPage } from "./pages/recruitment/VacancyFormPage";
import { EmptyState } from "./shared/ui";

function App(): JSX.Element {
  return (
    <AuthProvider>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<AuthorizedHome />} />
          <Route
            path="dashboard"
            element={
              <RequirePermission anyOf={["dashboard.view"]}>
                <DashboardPage />
              </RequirePermission>
            }
          />
          <Route
            path="employees"
            element={
              <RequirePermission anyOf={["employees.view"]}>
                <EmployeesPage />
              </RequirePermission>
            }
          />
          <Route
            path="employees/new"
            element={
              <RequirePermission anyOf={["employees.manage"]}>
                <EmployeeCreatePage />
              </RequirePermission>
            }
          />
          <Route
            path="employees/:id"
            element={
              <RequirePermission anyOf={["employees.view", "profile.view"]}>
                <EmployeeDetailsPage />
              </RequirePermission>
            }
          />
          <Route
            path="filters"
            element={
              <RequirePermission anyOf={["filters.use"]}>
                <FiltersPage />
              </RequirePermission>
            }
          />
          <Route
            path="vacancies"
            element={
              <RequirePermission anyOf={["recruitment.view"]}>
                <VacanciesPage />
              </RequirePermission>
            }
          />
          <Route
            path="vacancies/new"
            element={
              <RequirePermission anyOf={["recruitment.manage"]}>
                <VacancyFormPage />
              </RequirePermission>
            }
          />
          <Route
            path="vacancies/:id/edit"
            element={
              <RequirePermission anyOf={["recruitment.manage"]}>
                <VacancyFormPage />
              </RequirePermission>
            }
          />
          <Route
            path="candidates"
            element={
              <RequirePermission anyOf={["recruitment.view"]}>
                <CandidatesPage />
              </RequirePermission>
            }
          />
          <Route
            path="access"
            element={
              <RequirePermission anyOf={["access.manage"]}>
                <AccessControlPage />
              </RequirePermission>
            }
          />
          <Route
            path="enterprises"
            element={
              <RequirePermission anyOf={["organization.view"]}>
                <OrganizationHierarchyPage />
              </RequirePermission>
            }
          />
          <Route
            path="enterprises/:enterpriseId/departments"
            element={
              <RequirePermission anyOf={["organization.view"]}>
                <OrganizationHierarchyPage />
              </RequirePermission>
            }
          />
          <Route
            path="enterprises/:enterpriseId/departments/:departmentId/positions"
            element={
              <RequirePermission anyOf={["organization.view"]}>
                <OrganizationHierarchyPage />
              </RequirePermission>
            }
          />
          <Route path="departments" element={<Navigate to="/enterprises" replace />} />
          <Route path="positions" element={<Navigate to="/enterprises" replace />} />
          <Route
            path="vacations"
            element={<Navigate to="/filters?module=vacations" replace />}
          />
          <Route
            path="payroll"
            element={<Navigate to="/filters?module=payroll" replace />}
          />
          <Route
            path="profile"
            element={
              <RequirePermission anyOf={["profile.view"]}>
                <OwnProfileRedirect />
              </RequirePermission>
            }
          />
          <Route
            path="settings"
            element={
              <RequirePermission anyOf={["settings.manage"]}>
                <SettingsPage />
              </RequirePermission>
            }
          />
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
