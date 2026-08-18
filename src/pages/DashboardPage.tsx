import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import {
  FiAlertCircle,
  FiBriefcase,
  FiCalendar,
  FiGrid,
  FiRefreshCw,
  FiShield,
  FiUserCheck,
  FiUsers,
} from "react-icons/fi";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";

import { useAuth } from "../features/auth/AuthContext";
import { getAppLocale } from "../shared/i18n";
import { formatDate, humanizeStatus } from "../shared/lib/format";
import { hrApiClient } from "../shared/lib/hrApiClient";
import type { HrDashboardStats, HrListResult } from "../shared/types/hr";
import { PageHeader } from "../shared/ui";
import { StatCard } from "../shared/ui/StatCard";

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
  pageSize: 5,
  totalPages: 0,
};

export function DashboardPage(): JSX.Element {
  const { i18n, t } = useTranslation();
  const { session } = useAuth();
  const locale = getAppLocale(i18n.language);
  const permissions = new Set(session.permissionCodes);
  const canViewEmployees = permissions.has("employees.view");
  const canViewVacations = permissions.has("vacations.view");
  const canViewRecruitment = permissions.has("recruitment.view");
  const canManageAccess = permissions.has("access.manage");
  const canViewAudit = permissions.has("audit.view");

  const [stats, setStats] = useState<HrDashboardStats>(initialStats);
  const [employees, setEmployees] = useState<HrListResult>(emptyList);
  const [vacations, setVacations] = useState<HrListResult>(emptyList);
  const [isLoading, setIsLoading] = useState(true);

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
              pageSize: 5,
              orderBy: "hire_date",
              orderDirection: "desc",
            })
            .then(setEmployees),
        );
      } else {
        setEmployees(emptyList);
      }

      if (canViewVacations) {
        const today = new Date().toISOString().slice(0, 10);
        tasks.push(
          hrApiClient
            .list({
              entity: "vacations",
              page: 1,
              pageSize: 5,
              orderBy: "starts_at",
              orderDirection: "asc",
              filters: {
                status: { operator: "in", value: ["planned", "approved"] },
                starts_at: { operator: "gte", value: today },
              },
            })
            .then(setVacations),
        );
      } else {
        setVacations(emptyList);
      }

      const results = await Promise.allSettled(tasks);
      if (results.some((result) => result.status === "rejected")) {
        toast.warning("Часть дополнительных данных главной страницы недоступна по текущим правам");
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("common.errors.dashboardLoad"),
      );
    } finally {
      setIsLoading(false);
    }
  }, [canViewEmployees, canViewVacations, t]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const attentionTotal =
    stats.blockedUsers + stats.employeesMissingAssignment + stats.emailConflicts;

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <button
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-5 text-sm font-black text-white backdrop-blur transition hover:bg-white/15"
            onClick={() => void loadDashboard()}
            type="button"
          >
            <FiRefreshCw className={isLoading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            {t("common.actions.refresh")}
          </button>
        }
        description="Сводка кадровых процессов и ситуаций, которые требуют внимания."
        eyebrow="HR Control Center"
        icon={<FiGrid />}
        title={t("dashboard.hero.title")}
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Сотрудники" value={stats.employeesTotal} icon={FiUsers} />
        <StatCard title="Отделы" value={stats.departmentsTotal} icon={FiGrid} />
        <StatCard title="Ближайшие отпуска · 30 дней" value={stats.upcomingVacations} icon={FiCalendar} />
        <StatCard title="Открытые вакансии" value={stats.openVacancies} icon={FiBriefcase} />
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AttentionCard
          icon={<FiUserCheck />}
          label="Кандидаты на оффере"
          value={stats.candidatesOnOffer}
          link={canViewRecruitment ? "/candidates" : undefined}
        />
        <AttentionCard
          icon={<FiShield />}
          label="Заблокированные пользователи"
          value={stats.blockedUsers}
          link={canManageAccess ? "/access" : undefined}
        />
        <AttentionCard
          icon={<FiAlertCircle />}
          label="Без отдела или должности"
          value={stats.employeesMissingAssignment}
          link={canViewEmployees ? "/employees" : undefined}
        />
        <AttentionCard
          icon={<FiAlertCircle />}
          label="Конфликты email"
          value={stats.emailConflicts}
          link={canViewAudit ? "/audit" : undefined}
        />
      </section>

      {attentionTotal === 0 && (
        <div className="app-surface app-border rounded-2xl border px-5 py-4 text-sm font-bold text-emerald-600">
          Критичных кадровых несостыковок сейчас не обнаружено.
        </div>
      )}

      <section className="grid gap-5 xl:grid-cols-2">
        {canViewEmployees && (
          <DashboardListCard linkLabel="Все сотрудники" linkTo="/employees" title="Последние приёмы">
            {employees.items.map((employee) => (
              <Link
                className="app-surface-muted app-border app-hover-muted flex items-center justify-between gap-4 rounded-2xl border px-4 py-3.5 transition"
                key={String(employee.id)}
                to={`/employees/${String(employee.id)}`}
              >
                <div className="min-w-0">
                  <p className="app-text truncate font-black">
                    {[employee.last_name, employee.first_name, employee.middle_name]
                      .filter(Boolean)
                      .join(" ")}
                  </p>
                  <p className="app-muted mt-1 text-sm font-medium">
                    {[employee.enterprise_name, employee.department_name, employee.position_name]
                      .filter(Boolean)
                      .join(" · ") || "Назначение не заполнено"}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="app-muted text-xs font-bold">{formatDate(employee.hire_date, locale)}</p>
                  <span className="app-accent-soft mt-1 inline-flex rounded-full border px-2.5 py-1 text-[11px] font-black">
                    {humanizeStatus(employee.status, t)}
                  </span>
                </div>
              </Link>
            ))}
            {!isLoading && employees.items.length === 0 && <EmptyDashboardRow />}
          </DashboardListCard>
        )}

        {canViewVacations && (
          <DashboardListCard linkLabel="Реестр отпусков" linkTo="/vacations" title="Ближайшие отпуска">
            {vacations.items.map((vacation) => (
              <Link
                className="app-surface-muted app-border app-hover-muted flex items-center justify-between gap-4 rounded-2xl border px-4 py-3.5 transition"
                key={String(vacation.id)}
                to={`/vacations?employee=${String(vacation.employee_id)}`}
              >
                <div className="min-w-0">
                  <p className="app-text truncate font-black">{String(vacation.employee_name ?? "—")}</p>
                  <p className="app-muted mt-1 line-clamp-2 text-sm font-medium">
                    {String(vacation.vacation_type_name ?? "Отпуск")} · {formatDate(vacation.starts_at, locale)} — {formatDate(vacation.ends_at, locale)}
                  </p>
                </div>
                <span className="app-accent-soft shrink-0 rounded-full border px-3 py-1 text-xs font-black">
                  {humanizeStatus(vacation.status, t)}
                </span>
              </Link>
            ))}
            {!isLoading && vacations.items.length === 0 && <EmptyDashboardRow />}
          </DashboardListCard>
        )}
      </section>
    </div>
  );
}

function AttentionCard({
  icon,
  label,
  link,
  value,
}: {
  icon: ReactNode;
  label: string;
  link?: string;
  value: number;
}): JSX.Element {
  const content = (
    <div className="app-surface app-border flex h-full items-center gap-4 rounded-[22px] border p-4">
      <span className="app-accent-soft app-accent-text flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl">{icon}</span>
      <div className="min-w-0">
        <p className="app-muted text-xs font-bold uppercase tracking-wide">{label}</p>
        <p className="app-text mt-1 text-2xl font-black">{value}</p>
      </div>
    </div>
  );
  return link ? <Link to={link}>{content}</Link> : content;
}

function DashboardListCard({
  children,
  linkLabel,
  linkTo,
  title,
}: {
  children: ReactNode;
  linkLabel: string;
  linkTo: string;
  title: string;
}): JSX.Element {
  return (
    <article className="app-surface app-border rounded-[28px] border p-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="app-text text-lg font-black">{title}</h2>
        <Link className="app-link-accent text-sm font-black" to={linkTo}>{linkLabel}</Link>
      </div>
      <div className="mt-5 space-y-3">{children}</div>
    </article>
  );
}

function EmptyDashboardRow(): JSX.Element {
  return (
    <div className="app-surface-muted app-muted rounded-2xl p-6 text-center text-sm font-medium">
      Записей нет
    </div>
  );
}