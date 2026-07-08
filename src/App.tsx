import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './app/AppLayout'
import { DashboardPage } from './pages/DashboardPage'
import { EntityPage } from './pages/EntityPage'

function App(): JSX.Element {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="employees" element={<EntityPage entity="employees" />} />
        <Route path="departments" element={<EntityPage entity="departments" />} />
        <Route path="positions" element={<EntityPage entity="positions" />} />
        <Route path="vacations" element={<EntityPage entity="vacations" />} />
        <Route path="payroll" element={<EntityPage entity="payroll" />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App