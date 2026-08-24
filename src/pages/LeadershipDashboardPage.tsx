import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import {
  FiAlertCircle,
  FiBriefcase,
  FiCalendar,
  FiChevronRight,
  FiGrid,
  FiLayers,
  FiRefreshCw,
  FiUserCheck,
  FiUsers,
} from "react-icons/fi";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";

import { useAuth } from "../features/auth/AuthContext";
import type { LeadershipRoleKey } from "../shared/access/leadership";
import { formatDate } from "../shared/lib/format";
import { hrApiClient } from "../shared/lib/hrApiClient";
import type {
  HrDashboardStats,
  HrListResult,
  HrRecord,
} from "../shared/types/hr";
import { PageHeader } from "../shared/ui";

const initialStats: HrDashboardStats = {
  employeesTotal: 0,
  departmentsTotal: 0,
  positionsTotal: 0,
  activeVacations: 0,
  upcomingVacations: 0,
  openVacancies: 0,
  candidatesOnOffer: 0,
  blockedUsers: 0,
  employeesMissingAssignment: 0,
  emailConflicts: 0,
};

const emptyList: HrListResult = {
  items: [],
  total: 0,
  page: 1,
  pageSize: 6,
  totalPages: 0,
};

export function LeadershipDashboardPage({
  role,
}: {
  role: LeadershipRoleKey;
}): JSX.Element {
  const { hasPermission, session } = useAuth();
  const [stats, setStats] = useState<HrDashboardStats>(initialStats);
  const [employees, setEmployees] = useState<HrListResult>(emptyList);
  const [vacations, setVacations] = useState<HrListResult>(emptyList);
  const [isLoading, setIsLoading] = useState(true);

  const canViewEmployees = hasPermission("employees.view");
  const canViewVacations = hasPermission("vacations.view");
  const canViewVacancies = hasPermission("vacancies.view");
  const canViewCandidates = hasPermission("candidates.view");
  const isEnterpriseDirector = role === "enterprise_director";

  const loadDashboard = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      const dashboardStats = await hrApiClient.dashboard();
      setStats(dashboardStats);

      const tasks: Array<Promise<void>> = [];
      if (canViewEmployees) {
        tasks.push(
          hrApiClient
            .list({
              entity: "employees",
              page: 1,
              pageSize: 6,
              orderBy: "hire_date",
              orderDirection: "desc",
            })
            .then(setEmployees),
        );
      }

      if (canViewVacations) {
        const today = new Date().toISOString().slice(0, 10);
        tasks.push(
          hrApiClient
            .list({
              entity: "vacations",
              page: 1,
              pageSize: 6,
              orderBy: "starts_at",
              orderDirection: "asc",
              filters: {
                status: { operator: "in", value: ["planned", "approved"] },
                starts_at: { operator: "gte", value: today },
              },
            })
            .then(setVacations),
        );
      }

      const results = await Promise.allSettled(tasks);
      if (results.some((result) => result.status === "rejected")) {
        toast.warning("Часть данных обзора недоступна по текущим разрешениям");
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Не удалось загрузить обзор руководителя",
      );
    } finally {
      setIsLoading(false);
    }
  }, [canViewEmployees, canViewVacations]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const title = isEnterpriseDirector
    ? session.enterpriseName || "Моё предприятие"
    : session.departmentName || "Мой отдел";
  const description = isEnterpriseDirector
    ? "Ключевая кадровая картина предприятия: команда, структура, отпуска и подбор. Все показатели ограничены вашим предприятием."
    : "Ключевая кадровая картина отдела: команда, должности, отпуска и подбор. Все показатели ограничены вашим отделом.";

  const quickLinks = [
    isEnterpriseDirector
      ? {
          label: "Предприятие",
          description: "Основная информация и контакты",
          to: "/my-enterprise",
          icon: <FiLayers />,
          visible: hasPermission("directory.view"),
        }
      : {
          label: "Отдел",
          description: "Информация о подразделении и руководстве",
          to: "/my-department",
          icon: <FiBriefcase />,
          visible: hasPermission("directory.view"),
        },
    isEnterpriseDirector
      ? {
          label: "Отделы",
          description: "Структура подразделений предприятия",
          to: "/management/departments",
          icon: <FiGrid />,
          visible: hasPermission("organization.view"),
        }
      : {
          label: "Предприятие",
          description: "Контекст предприятия и директор",
          to: "/my-enterprise",
          icon: <FiLayers />,
          visible: hasPermission("directory.view"),
        },
    {
      label: isEnterpriseDirector ? "Сотрудники предприятия" : "Сотрудники отдела",
      description: "Карточки сотрудников в вашей области",
      to: "/employees",
      icon: <FiUsers />,
      visible: canViewEmployees,
    },
    {
      label: isEnterpriseDirector ? "Отпуска предприятия" : "Отпуска отдела",
      description: "Планы и статусы отпусков команды",
      to: "/vacations",
      icon: <FiCalendar />,
      visible: canViewVacations,
    },
    {
      label: "Вакансии",
      description: "Открытые позиции в доступной структуре",
      to: "/vacancies",
      icon: <FiBriefcase />,
      visible: canViewVacancies,
    },
    {
      label: "Кандидаты",
      description: "Кандидаты по доступным вакансиям",
      to: "/candidates",
      icon: <FiUserCheck />,
      visible: canViewCandidates,
    },
  ].filter((item) => item.visible);

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <button
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-4 text-sm font-black text-white transition hover:bg-white/15"
            onClick={() => void loadDashboard()}
            type="button"
          >
            <FiRefreshCw className={isLoading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            Обновить
          </button>
        }
        description={description}
        eyebrow={isEnterpriseDirector ? "Управление предприятием" : "Управление отделом"}
        icon={isEnterpriseDirector ? <FiLayers /> : <FiBriefcase />}
        meta={
          <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-bold text-white/80">
            {isEnterpriseDirector ? "Директор предприятия" : "Руководитель отдела"}
          </span>
        }
        title={title}
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <MetricCard icon={<FiUsers />} label="Сотрудники" value={stats.employeesTotal} />
        {isEnterpriseDirector ? (
          <MetricCard icon={<FiGrid />} label="Отделы" value={stats.departmentsTotal} />
        ) : (
          <MetricCard icon={<FiBriefcase />} label="Должности" value={stats.positionsTotal} />
        )}
        <MetricCard
          icon={<FiCalendar />}
          label="Ближайшие отпуска"
          value={stats.upcomingVacations}
        />
        <MetricCard
          icon={<FiCalendar />}
          label="Активные отпуска"
          value={stats.activeVacations}
        />
        <MetricCard
          icon={<FiBriefcase />}
          label="Открытые вакансии"
          value={stats.openVacancies}
        />
        <MetricCard
          icon={<FiUserCheck />}
          label="Кандидаты на оффере"
          value={stats.candidatesOnOffer}
        />
      </section>

      {stats.employeesMissingAssignment > 0 && (
        <div className="app-surface app-border flex items-center gap-3 rounded-2xl border px-4 py-3.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
            <FiAlertCircle />
          </span>
          <div className="min-w-0">
            <p className="app-text text-sm font-black">Неполные кадровые назначения</p>
            <p className="app-muted mt-0.5 text-xs font-semibold">
              В вашей области {stats.employeesMissingAssignment} сотрудник(а) без отдела или должности.
            </p>
          </div>
        </div>
      )}

      <section className="app-surface app-border rounded-[26px] border p-5">
        <div className="mb-4">
          <p className="app-text text-lg font-black">Быстрый доступ</p>
          <p className="app-muted mt-1 text-xs font-semibold">
            Только разделы, доступные вашей системной роли и области ответственности.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {quickLinks.map((item) => (
            <Link
              className="app-surface-muted app-border app-hover-muted flex items-center gap-3 rounded-2xl border p-4 transition"
              key={item.to}
              to={item.to}
            >
              <span className="app-accent-soft flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border">
                {item.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="app-text block text-sm font-black">{item.label}</span>
                <span className="app-muted mt-0.5 block text-xs font-semibold leading-5">
                  {item.description}
                </span>
              </span>
              <FiChevronRight className="app-muted h-4 w-4 shrink-0" />
            </Link>
          ))}
        </div>
      </section>

      <section className="grid items-start gap-5 xl:grid-cols-2">
        {canViewEmployees && (
          <ListCard
            emptyText="В доступной области пока нет сотрудников."
            items={employees.items}
            linkLabel={isEnterpriseDirector ? "Все сотрудники предприятия" : "Все сотрудники отдела"}
            linkTo="/employees"
            renderItem={(employee) => (
              <Link
                className="app-surface-muted app-border app-hover-muted flex items-center justify-between gap-4 rounded-2xl border px-4 py-3.5 transition"
                key={String(employee.id)}
                to={`/employees/${String(employee.id)}`}
              >
                <div className="min-w-0">
                  <p className="app-text truncate text-sm font-black">
                    {employeeName(employee)}
                  </p>
                  <p className="app-muted mt-1 truncate text-xs font-semibold">
                    {[employee.department_name, employee.position_name]
                      .filter(Boolean)
                      .join(" · ") || "Назначение не заполнено"}
                  </p>
                </div>
                <span className="app-muted shrink-0 text-xs font-bold">
                  {formatDate(employee.hire_date)}
                </span>
              </Link>
            )}
            title="Последние сотрудники"
          />
        )}

        {canViewVacations && (
          <ListCard
            emptyText="Ближайших отпусков в доступной области нет."
            items={vacations.items}
            linkLabel="Все отпуска"
            linkTo="/vacations"
            renderItem={(vacation) => (
              <Link
                className="app-surface-muted app-border app-hover-muted flex items-center justify-between gap-4 rounded-2xl border px-4 py-3.5 transition"
                key={String(vacation.id)}
                to={`/vacations?employee=${String(vacation.employee_id)}`}
              >
                <div className="min-w-0">
                  <p className="app-text truncate text-sm font-black">
                    {String(vacation.employee_name ?? "Сотрудник")}
                  </p>
                  <p className="app-muted mt-1 text-xs font-semibold">
                    {formatDate(vacation.starts_at)} — {formatDate(vacation.ends_at)}
                  </p>
                </div>
                <span className="app-accent-soft shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-black">
                  {vacationStatusLabel(vacation.status)}
                </span>
              </Link>
            )}
            title="Ближайшие отпуска"
          />
        )}
      </section>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: number;
}): JSX.Element {
  return (
    <article className="app-surface app-border flex items-center gap-3 rounded-[22px] border p-4">
      <span className="app-accent-soft flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="app-muted truncate text-[10px] font-black uppercase tracking-wide">
          {label}
        </p>
        <p className="app-text mt-0.5 text-xl font-black">{value}</p>
      </div>
    </article>
  );
}

function ListCard({
  emptyText,
  items,
  linkLabel,
  linkTo,
  renderItem,
  title,
}: {
  emptyText: string;
  items: HrRecord[];
  linkLabel: string;
  linkTo: string;
  renderItem: (item: HrRecord) => ReactNode;
  title: string;
}): JSX.Element {
  return (
    <article className="app-surface app-border rounded-[26px] border p-5">
      <div className="flex items-center justify-between gap-4">
        <h2 className="app-text text-lg font-black">{title}</h2>
        <Link className="app-link-accent text-xs font-black" to={linkTo}>
          {linkLabel}
        </Link>
      </div>
      <div className="mt-4 space-y-2.5">
        {items.length ? (
          items.map(renderItem)
        ) : (
          <div className="app-surface-muted app-muted rounded-2xl p-5 text-center text-sm font-semibold">
            {emptyText}
          </div>
        )}
      </div>
    </article>
  );
}

function employeeName(employee: HrRecord): string {
  return (
    [employee.last_name, employee.first_name, employee.middle_name]
      .map((value) => String(value ?? "").trim())
      .filter(Boolean)
      .join(" ") || "Сотрудник"
  );
}

function vacationStatusLabel(value: unknown): string {
  const labels: Record<string, string> = {
    planned: "Запланирован",
    approved: "Согласован",
    rejected: "Отклонён",
    completed: "Завершён",
  };
  return labels[String(value ?? "")] ?? String(value ?? "—");
}
