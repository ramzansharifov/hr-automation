import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FiBriefcase, FiCalendar, FiCreditCard, FiGrid, FiUsers } from 'react-icons/fi'
import { useTranslation } from 'react-i18next'
import { toast } from 'react-toastify'
import type { HrDashboardStats, HrListResult } from '../shared/types/hr'
import { formatCurrency, formatDate, humanizeStatus } from '../shared/lib/format'
import { hrApiClient } from '../shared/lib/hrApiClient'
import { getAppLocale } from '../shared/i18n'
import { StatCard } from '../shared/ui/StatCard'

const initialStats: HrDashboardStats = {
  employeesTotal: 0,
  departmentsTotal: 0,
  positionsTotal: 0,
  activeVacations: 0,
  payrollMonthTotal: 0,
}

const emptyList: HrListResult = {
  items: [],
  total: 0,
  page: 1,
  pageSize: 5,
  totalPages: 0,
}

export function DashboardPage(): JSX.Element {
  const { i18n, t } = useTranslation()
  const locale = getAppLocale(i18n.language)
  const [stats, setStats] = useState<HrDashboardStats>(initialStats)
  const [employees, setEmployees] = useState<HrListResult>(emptyList)
  const [vacations, setVacations] = useState<HrListResult>(emptyList)
  const [isLoading, setIsLoading] = useState(true)

  const loadDashboard = useCallback(async () => {
    setIsLoading(true)

    try {
      const [dashboardStats, employeesList, vacationsList] = await Promise.all([
        hrApiClient.dashboard(),
        hrApiClient.list({
          entity: 'employees',
          page: 1,
          pageSize: 5,
          orderBy: 'id',
          orderDirection: 'desc',
        }),
        hrApiClient.list({
          entity: 'vacations',
          page: 1,
          pageSize: 5,
          orderBy: 'starts_at',
          orderDirection: 'asc',
        }),
      ])

      setStats(dashboardStats)
      setEmployees(employeesList)
      setVacations(vacationsList)
    } catch (error) {
      const message = error instanceof Error ? error.message : t('common.errors.dashboardLoad')
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }, [t])

  useEffect(() => {
    void loadDashboard()
  }, [loadDashboard])

  return (
    <div className="space-y-6">
      <section className="app-surface app-border rounded-[28px] border p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="app-accent-text text-xs font-black uppercase tracking-[0.24em]">
              {t('dashboard.hero.productName')}
            </p>
            <h1 className="app-text mt-3 text-3xl font-black tracking-tight">
              {t('dashboard.hero.title')}
            </h1>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              to="/employees"
              className="app-button-primary rounded-2xl px-5 py-3 text-sm font-black transition"
            >
              {t('dashboard.hero.employeesButton')}
            </Link>

            <button
              type="button"
              onClick={() => void loadDashboard()}
              className="app-button-secondary rounded-2xl border px-5 py-3 text-sm font-black transition"
            >
              {t('common.actions.refresh')}
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard title={t('dashboard.stats.employees')} value={stats.employeesTotal} description={t('dashboard.stats.total')} icon={FiUsers} />
        <StatCard title={t('dashboard.stats.departments')} value={stats.departmentsTotal} description={t('dashboard.stats.total')} icon={FiGrid} />
        <StatCard title={t('dashboard.stats.positions')} value={stats.positionsTotal} description={t('dashboard.stats.total')} icon={FiBriefcase} />
        <StatCard title={t('dashboard.stats.vacations')} value={stats.activeVacations} description={t('dashboard.stats.active')} icon={FiCalendar} />
        <StatCard title={t('dashboard.stats.payroll')} value={formatCurrency(stats.payrollMonthTotal, locale)} description={t('dashboard.stats.month')} icon={FiCreditCard} />
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <article className="app-surface app-border rounded-[28px] border p-6">
          <div className="flex items-center justify-between gap-4">
            <h2 className="app-text text-lg font-black">{t('dashboard.sections.latestEmployees')}</h2>

            <Link to="/employees" className="app-link-accent text-sm font-black">
              {t('common.actions.open')}
            </Link>
          </div>

          <div className="mt-5 space-y-3">
            {employees.items.map((employee) => (
              <div
                key={String(employee.id)}
                className="app-surface-muted flex items-center justify-between gap-4 rounded-2xl px-4 py-3.5"
              >
                <div>
                  <p className="app-text font-black">
                    {String(employee.last_name ?? '')} {String(employee.first_name ?? '')}
                  </p>
                  <p className="app-muted mt-1 text-sm font-medium">{formatDate(employee.hire_date, locale)}</p>
                </div>

                <span className="app-accent-soft rounded-full px-3 py-1 text-xs font-black">
                  {humanizeStatus(employee.status, t)}
                </span>
              </div>
            ))}

            {!isLoading && employees.items.length === 0 && (
              <p className="app-surface-muted app-muted rounded-2xl p-6 text-center text-sm font-medium">
                {t('common.table.noRecords')}
              </p>
            )}
          </div>
        </article>

        <article className="app-surface app-border rounded-[28px] border p-6">
          <div className="flex items-center justify-between gap-4">
            <h2 className="app-text text-lg font-black">{t('dashboard.sections.upcomingVacations')}</h2>

            <Link to="/employees" className="app-link-accent text-sm font-black">
              {t('common.actions.open')}
            </Link>
          </div>

          <div className="mt-5 space-y-3">
            {vacations.items.map((vacation) => (
              <Link
                key={String(vacation.id)}
                to={`/employees/${String(vacation.employee_id)}`}
                className="app-surface-muted app-hover-muted flex items-center justify-between gap-4 rounded-2xl px-4 py-3.5 transition"
              >
                <div>
                  <p className="app-text font-black">{String(vacation.employee_name ?? '—')}</p>
                  <p className="app-muted mt-1 text-sm font-medium">
                    {String(vacation.vacation_type ?? '—')} · {formatDate(vacation.starts_at, locale)} — {formatDate(vacation.ends_at, locale)}
                  </p>
                </div>

                <span className="app-accent-soft rounded-full px-3 py-1 text-xs font-black">
                  {humanizeStatus(vacation.status, t)}
                </span>
              </Link>
            ))}

            {!isLoading && vacations.items.length === 0 && (
              <p className="app-surface-muted app-muted rounded-2xl p-6 text-center text-sm font-medium">
                {t('common.table.noRecords')}
              </p>
            )}
          </div>
        </article>
      </section>
    </div>
  )
}
