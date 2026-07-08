import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FiBriefcase, FiCalendar, FiCreditCard, FiGrid, FiUsers } from 'react-icons/fi'
import { toast } from 'react-toastify'
import type { HrDashboardStats, HrListResult } from '../shared/types/hr'
import { formatCurrency, formatDate, humanizeStatus } from '../shared/lib/format'
import { hrApiClient } from '../shared/lib/hrApiClient'
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
      const message = error instanceof Error ? error.message : 'Не удалось загрузить панель'
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadDashboard()
  }, [loadDashboard])

  return (
    <div className="space-y-7">
      <section className="rounded-[30px] border border-slate-200 bg-white p-7 shadow-sm">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-sm font-bold text-blue-600">HR Automation</p>
            <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-950">
              Автоматизация отдела кадров
            </h1>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              to="/employees"
              className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-700"
            >
              Сотрудники
            </Link>

            <button
              type="button"
              onClick={() => void loadDashboard()}
              className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
            >
              Обновить
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-5">
        <StatCard title="Сотрудники" value={stats.employeesTotal} description="Всего записей" icon={FiUsers} />
        <StatCard title="Отделы" value={stats.departmentsTotal} description="Всего записей" icon={FiGrid} />
        <StatCard title="Должности" value={stats.positionsTotal} description="Всего записей" icon={FiBriefcase} />
        <StatCard title="Отпуска" value={stats.activeVacations} description="Активные" icon={FiCalendar} />
        <StatCard title="Зарплата" value={formatCurrency(stats.payrollMonthTotal)} description="Текущий месяц" icon={FiCreditCard} />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-black text-slate-950">Последние сотрудники</h2>

            <Link to="/employees" className="text-sm font-bold text-blue-600 hover:text-blue-700">
              Открыть
            </Link>
          </div>

          <div className="mt-6 space-y-3">
            {employees.items.map((employee) => (
              <div
                key={String(employee.id)}
                className="flex items-center justify-between gap-4 rounded-2xl bg-slate-50 p-4"
              >
                <div>
                  <p className="font-bold text-slate-950">
                    {String(employee.last_name ?? '')} {String(employee.first_name ?? '')}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {String(employee.employee_code ?? '—')} · {formatDate(employee.hire_date)}
                  </p>
                </div>

                <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700">
                  {humanizeStatus(employee.status)}
                </span>
              </div>
            ))}

            {!isLoading && employees.items.length === 0 && (
              <p className="rounded-2xl bg-slate-50 p-6 text-center text-sm text-slate-500">
                Нет записей
              </p>
            )}
          </div>
        </article>

        <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-black text-slate-950">Ближайшие отпуска</h2>

            <Link to="/vacations" className="text-sm font-bold text-blue-600 hover:text-blue-700">
              Открыть
            </Link>
          </div>

          <div className="mt-6 space-y-3">
            {vacations.items.map((vacation) => (
              <div key={String(vacation.id)} className="rounded-2xl bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-4">
                  <p className="font-bold text-slate-950">{String(vacation.vacation_type ?? '—')}</p>
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
                    {humanizeStatus(vacation.status)}
                  </span>
                </div>

                <p className="mt-2 text-sm text-slate-500">
                  {formatDate(vacation.starts_at)} — {formatDate(vacation.ends_at)}
                </p>
              </div>
            ))}

            {!isLoading && vacations.items.length === 0 && (
              <p className="rounded-2xl bg-slate-50 p-6 text-center text-sm text-slate-500">
                Нет записей
              </p>
            )}
          </div>
        </article>
      </section>
    </div>
  )
}