import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./app/AppLayout";
import { DashboardPage } from "./pages/DashboardPage";
import { OrganizationHierarchyPage } from "./pages/OrganizationHierarchyPage";
import { FiltersPage } from "./pages/FiltersPage";
import { EmployeeCreatePage } from "./pages/employees/EmployeeCreatePage";
import { EmployeeDetailsPage } from "./pages/employees/EmployeeDetailsPage";
import { EmployeesPage } from "./pages/employees/EmployeesPage";
import { ProfilePage } from "./pages/ProfilePage";
import { SettingsPage } from "./pages/SettingsPage";

function App(): JSX.Element {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="employees" element={<EmployeesPage />} />
        <Route path="employees/new" element={<EmployeeCreatePage />} />
        <Route path="employees/:id" element={<EmployeeDetailsPage />} />
        <Route path="filters" element={<FiltersPage />} />
        <Route path="enterprises" element={<OrganizationHierarchyPage />} />
        <Route
          path="enterprises/:enterpriseId/departments"
          element={<OrganizationHierarchyPage />}
        />
        <Route
          path="enterprises/:enterpriseId/departments/:departmentId/positions"
          element={<OrganizationHierarchyPage />}
        />
        <Route path="departments" element={<Navigate to="/enterprises" replace />} />
        <Route path="positions" element={<Navigate to="/enterprises" replace />} />
        <Route path="vacations" element={<Navigate to="/employees" replace />} />
        <Route path="payroll" element={<Navigate to="/employees" replace />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
