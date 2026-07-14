import type { ReactNode } from 'react'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FiBriefcase, FiCalendar, FiCreditCard, FiGrid, FiRefreshCw, FiUsers } from 'react-icons/fi'
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
      <section className="app-accent-gradient-panel flex flex-col gap-6 overflow-hidden rounded-[30px] border p-7 lg:flex-row lg:items-center lg:justify-between lg:p-8">
        <h1 className="max-w-3xl text-3xl font-black tracking-tight text-white sm:text-4xl">
          {t('dashboard.hero.title')}
        </h1>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            className="inline-flex h-11 items-center justify-center rounded-2xl bg-white px-5 text-sm font-black text-slate-950 shadow-xl transition hover:-translate-y-0.5 hover:bg-white/90"
            to="/employees"
          >
            {t('dashboard.hero.employeesButton')}
          </Link>
          <button
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-5 text-sm font-black text-white backdrop-blur transition hover:bg-white/15"
            onClick={() => void loadDashboard()}
            type="button"
          >
            <FiRefreshCw className={isLoading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
            {t('common.actions.refresh')}
          </button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard title={t('dashboard.stats.employees')} value={stats.employeesTotal} icon={FiUsers} />
        <StatCard title={t('dashboard.stats.departments')} value={stats.departmentsTotal} icon={FiGrid} />
        <StatCard title={t('dashboard.stats.positions')} value={stats.positionsTotal} icon={FiBriefcase} />
        <StatCard title={t('dashboard.stats.vacations')} value={stats.activeVacations} icon={FiCalendar} />
        <StatCard title={t('dashboard.stats.payroll')} value={formatCurrency(stats.payrollMonthTotal, locale)} icon={FiCreditCard} />
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <DashboardListCard
          linkLabel={t('common.actions.open')}
          linkTo="/employees"
          title={t('dashboard.sections.latestEmployees')}
        >
          {employees.items.map((employee) => (
            <div
              className="app-surface-muted app-border flex items-center justify-between gap-4 rounded-2xl border px-4 py-3.5"
              key={String(employee.id)}
            >
              <div className="min-w-0">
                <p className="app-text truncate font-black">
                  {String(employee.last_name ?? '')} {String(employee.first_name ?? '')}
                </p>
                <p className="app-muted mt-1 text-sm font-medium">{formatDate(employee.hire_date, locale)}</p>
              </div>
              <span className="app-accent-soft shrink-0 rounded-full border px-3 py-1 text-xs font-black">
                {humanizeStatus(employee.status, t)}
              </span>
            </div>
          ))}
          {!isLoading && employees.items.length === 0 && (
            <div className="app-surface-muted app-muted rounded-2xl p-6 text-center text-sm font-medium">
              {t('common.table.noRecords')}
            </div>
          )}
        </DashboardListCard>

        <DashboardListCard
          linkLabel={t('common.actions.open')}
          linkTo="/employees"
          title={t('dashboard.sections.upcomingVacations')}
        >
          {vacations.items.map((vacation) => (
            <Link
              className="app-surface-muted app-border app-hover-muted flex items-center justify-between gap-4 rounded-2xl border px-4 py-3.5 transition"
              key={String(vacation.id)}
              to={`/employees/${String(vacation.employee_id)}`}
            >
              <div className="min-w-0">
                <p className="app-text truncate font-black">{String(vacation.employee_name ?? '—')}</p>
                <p className="app-muted mt-1 line-clamp-2 text-sm font-medium">
                  {String(vacation.vacation_type ?? '—')} · {formatDate(vacation.starts_at, locale)} — {formatDate(vacation.ends_at, locale)}
                </p>
              </div>
              <span className="app-accent-soft shrink-0 rounded-full border px-3 py-1 text-xs font-black">
                {humanizeStatus(vacation.status, t)}
              </span>
            </Link>
          ))}
          {!isLoading && vacations.items.length === 0 && (
            <div className="app-surface-muted app-muted rounded-2xl p-6 text-center text-sm font-medium">
              {t('common.table.noRecords')}
            </div>
          )}
        </DashboardListCard>
      </section>
    </div>
  )
}

function DashboardListCard({
  children,
  linkLabel,
  linkTo,
  title,
}: {
  children: ReactNode
  linkLabel: string
  linkTo: string
  title: string
}): JSX.Element {
  return (
    <article className="app-surface app-border rounded-[28px] border p-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="app-text text-lg font-black">{title}</h2>
        <Link className="app-link-accent text-sm font-black" to={linkTo}>
          {linkLabel}
        </Link>
      </div>
      <div className="mt-5 space-y-3">{children}</div>
    </article>
  )
}
