import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import {
  FiBriefcase,
  FiCalendar,
  FiChevronRight,
  FiGrid,
  FiLayers,
  FiUserCheck,
  FiUsers,
} from "react-icons/fi";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";

import { AttentionQueueSection } from "../features/attention/AttentionQueueSection";
import { useAuth } from "../features/auth/AuthContext";
import type { LeadershipRoleKey } from "../shared/access/leadership";
import { useAppLocale, useAppText } from "../shared/i18n";
import { formatDate } from "../shared/lib/format";
import { hrApiClient } from "../shared/lib/hrApiClient";
import type {
  HrDashboardStats,
  HrListResult,
  HrRecord,
} from "../shared/types/hr";
import { ActionButton, AnimatedNumber, PageHeader } from "../shared/ui";

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
  const text = useAppText();
  const locale = useAppLocale();
  const { hasPermission, session } = useAuth();
  const [stats, setStats] = useState<HrDashboardStats>(initialStats);
  const [employees, setEmployees] = useState<HrListResult>(emptyList);
  const [vacations, setVacations] = useState<HrListResult>(emptyList);
  const [isLoading, setIsLoading] = useState(true);

  const canViewEmployees = hasPermission("employees.view");
  const canViewVacations = hasPermission("vacations.view");
  const canViewVacancies = hasPermission("vacancies.view");
  const canViewCandidates = hasPermission("candidates.view");
  const canViewAttention = hasPermission("attention.view");
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
        toast.warning(text("Часть данных обзора недоступна по текущим разрешениям", "Some dashboard data is unavailable with the current permissions"));
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : text("Не удалось загрузить обзор руководителя", "Failed to load leadership dashboard"),
      );
    } finally {
      setIsLoading(false);
    }
  }, [canViewEmployees, canViewVacations, text]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const title = isEnterpriseDirector
    ? session.enterpriseName || text("Моё предприятие", "My enterprise")
    : session.departmentName || text("Мой отдел", "My department");
  const description = isEnterpriseDirector
    ? text(
        "Ключевая кадровая картина предприятия: команда, структура, отпуска и подбор. Все показатели ограничены вашим предприятием.",
        "Key enterprise HR overview: team, structure, vacations, and recruitment. All metrics are limited to your enterprise.",
      )
    : text(
        "Ключевая кадровая картина отдела: команда, должности, отпуска и подбор. Все показатели ограничены вашим отделом.",
        "Key department HR overview: team, positions, vacations, and recruitment. All metrics are limited to your department.",
      );

  const quickLinks = [
    isEnterpriseDirector
      ? {
          label: text("Предприятие", "Enterprise"),
          description: text("Основная информация и контакты", "Main information and contacts"),
          to: "/my-enterprise",
          icon: <FiLayers />,
          visible: hasPermission("directory.view"),
        }
      : {
          label: text("Отдел", "Department"),
          description: text("Информация о подразделении и руководстве", "Department and leadership information"),
          to: "/my-department",
          icon: <FiBriefcase />,
          visible: hasPermission("directory.view"),
        },
    isEnterpriseDirector
      ? {
          label: text("Отделы", "Departments"),
          description: text("Структура подразделений предприятия", "Enterprise department structure"),
          to: "/management/departments",
          icon: <FiGrid />,
          visible: hasPermission("departments.view"),
        }
      : {
          label: text("Предприятие", "Enterprise"),
          description: text("Контекст предприятия и директор", "Enterprise context and director"),
          to: "/my-enterprise",
          icon: <FiLayers />,
          visible: hasPermission("directory.view"),
        },
    {
      label: isEnterpriseDirector ? text("Сотрудники предприятия", "Enterprise employees") : text("Сотрудники отдела", "Department employees"),
      description: text("Карточки сотрудников в вашей области", "Employee profiles in your scope"),
      to: "/employees",
      icon: <FiUsers />,
      visible: canViewEmployees,
    },
    {
      label: isEnterpriseDirector ? text("Отпуска предприятия", "Enterprise vacations") : text("Отпуска отдела", "Department vacations"),
      description: text("Планы и статусы отпусков команды", "Team vacation plans and statuses"),
      to: "/vacations",
      icon: <FiCalendar />,
      visible: canViewVacations,
    },
    {
      label: text("Вакансии", "Vacancies"),
      description: text("Открытые позиции в доступной структуре", "Open positions in the available structure"),
      to: "/vacancies",
      icon: <FiBriefcase />,
      visible: canViewVacancies,
    },
    {
      label: text("Кандидаты", "Candidates"),
      description: text("Кандидаты по доступным вакансиям", "Candidates for available vacancies"),
      to: "/candidates",
      icon: <FiUserCheck />,
      visible: canViewCandidates,
    },
  ].filter((item) => item.visible);

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <ActionButton
            action="refresh"
            loading={isLoading}
            onClick={() => void loadDashboard()}
          />
        }
        description={description}
        eyebrow={isEnterpriseDirector ? text("Управление предприятием", "Enterprise management") : text("Управление отделом", "Department management")}
        icon={isEnterpriseDirector ? <FiLayers /> : <FiBriefcase />}
        meta={
          <span className="app-accent-soft inline-flex rounded-full border px-3 py-1 text-xs font-bold">
            {isEnterpriseDirector ? text("Директор предприятия", "Enterprise director") : text("Руководитель отдела", "Department head")}
          </span>
        }
        title={title}
      />

      {canViewAttention ? <AttentionQueueSection /> : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <MetricCard icon={<FiUsers />} label={text("Сотрудники", "Employees")} value={stats.employeesTotal} />
        {isEnterpriseDirector ? (
          <MetricCard icon={<FiGrid />} label={text("Отделы", "Departments")} value={stats.departmentsTotal} />
        ) : (
          <MetricCard icon={<FiBriefcase />} label={text("Должности", "Positions")} value={stats.positionsTotal} />
        )}
        <MetricCard
          icon={<FiCalendar />}
          label={text("Ближайшие отпуска", "Upcoming vacations")}
          value={stats.upcomingVacations}
        />
        <MetricCard
          icon={<FiCalendar />}
          label={text("Активные отпуска", "Active vacations")}
          value={stats.activeVacations}
        />
        <MetricCard
          icon={<FiBriefcase />}
          label={text("Открытые вакансии", "Open vacancies")}
          value={stats.openVacancies}
        />
        <MetricCard
          icon={<FiUserCheck />}
          label={text("Кандидаты на оффере", "Candidates at offer stage")}
          value={stats.candidatesOnOffer}
        />
      </section>

      <section className="app-surface app-border rounded-[26px] border p-5">
        <div className="mb-4">
          <p className="app-text text-lg font-black">{text("Быстрый доступ", "Quick access")}</p>
          <p className="app-muted mt-1 text-xs font-semibold">
            {text("Только разделы, доступные вашей системной роли и области ответственности.", "Only sections available to your system role and responsibility scope.")}
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
            emptyText={text("В доступной области пока нет сотрудников.", "There are no employees in the available scope yet.")}
            items={employees.items}
            linkLabel={isEnterpriseDirector ? text("Все сотрудники предприятия", "All enterprise employees") : text("Все сотрудники отдела", "All department employees")}
            linkTo="/employees"
            renderItem={(employee) => (
              <Link
                className="app-surface-muted app-border app-hover-muted flex items-center justify-between gap-4 rounded-2xl border px-4 py-3.5 transition"
                key={String(employee.id)}
                to={`/employees/${String(employee.id)}`}
              >
                <div className="min-w-0">
                  <p className="app-text truncate text-sm font-black">
                    {employeeName(employee, text)}
                  </p>
                  <p className="app-muted mt-1 truncate text-xs font-semibold">
                    {[employee.department_name, employee.position_name]
                      .filter(Boolean)
                      .join(" · ") || text("Назначение не заполнено", "Assignment not completed")}
                  </p>
                </div>
                <span className="app-muted shrink-0 text-xs font-bold">
                  {formatDate(employee.hire_date, locale)}
                </span>
              </Link>
            )}
            title={text("Последние сотрудники", "Latest employees")}
          />
        )}

        {canViewVacations && (
          <ListCard
            emptyText={text("Ближайших отпусков в доступной области нет.", "There are no upcoming vacations in the available scope.")}
            items={vacations.items}
            linkLabel={text("Все отпуска", "All vacations")}
            linkTo="/vacations"
            renderItem={(vacation) => (
              <Link
                className="app-surface-muted app-border app-hover-muted flex items-center justify-between gap-4 rounded-2xl border px-4 py-3.5 transition"
                key={String(vacation.id)}
                to={`/vacations?employee=${String(vacation.employee_id)}`}
              >
                <div className="min-w-0">
                  <p className="app-text truncate text-sm font-black">
                    {String(vacation.employee_name ?? text("Сотрудник", "Employee"))}
                  </p>
                  <p className="app-muted mt-1 text-xs font-semibold">
                    {formatDate(vacation.starts_at, locale)} — {formatDate(vacation.ends_at, locale)}
                  </p>
                </div>
                <span className="app-accent-soft shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-black">
                  {vacationStatusLabel(vacation.status, text)}
                </span>
              </Link>
            )}
            title={text("Ближайшие отпуска", "Upcoming vacations")}
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
        <p className="app-text mt-0.5 text-xl font-black">
          <AnimatedNumber value={value} />
        </p>
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

function employeeName(
  employee: HrRecord,
  text: (ru: string, en: string) => string,
): string {
  return (
    [employee.last_name, employee.first_name, employee.middle_name]
      .map((value) => String(value ?? "").trim())
      .filter(Boolean)
      .join(" ") || text("Сотрудник", "Employee")
  );
}

function vacationStatusLabel(
  value: unknown,
  text: (ru: string, en: string) => string,
): string {
  const labels: Record<string, [string, string]> = {
    planned: ["Запланирован", "Planned"],
    approved: ["Согласован", "Approved"],
    rejected: ["Отклонён", "Rejected"],
    completed: ["Завершён", "Completed"],
  };
  const label = labels[String(value ?? "")];
  return label ? text(label[0], label[1]) : String(value ?? "—");
}
