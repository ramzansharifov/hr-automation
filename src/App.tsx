import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './app/AppLayout'
import { DashboardPage } from './pages/DashboardPage'
import { EntityPage } from './pages/EntityPage'
import { EmployeeCreatePage } from './pages/employees/EmployeeCreatePage'
import { EmployeeDetailsPage } from './pages/employees/EmployeeDetailsPage'
import { EmployeesPage } from './pages/employees/EmployeesPage'
import { ProfilePage } from './pages/ProfilePage'
import { SettingsPage } from './pages/SettingsPage'

function App(): JSX.Element {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="employees" element={<EmployeesPage />} />
        <Route path="employees/new" element={<EmployeeCreatePage />} />
        <Route path="employees/:id" element={<EmployeeDetailsPage />} />
        <Route path="departments" element={<EntityPage entity="departments" />} />
        <Route path="positions" element={<EntityPage entity="positions" />} />
        <Route path="vacations" element={<EntityPage entity="vacations" />} />
        <Route path="payroll" element={<EntityPage entity="payroll" />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
