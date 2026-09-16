import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import {
  FiBriefcase,
  FiCalendar,
  FiGrid,
  FiUsers,
} from "react-icons/fi";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";

import { AttentionQueueSection } from "../features/attention/AttentionQueueSection";
import { useAuth } from "../features/auth/AuthContext";
import { useBusinessContext } from "../features/business-context/useBusinessContext";
import { getScopedAdminRole } from "../shared/access/scopedAdmin";
import { getAppLocale, useAppText } from "../shared/i18n";
import { formatDate, humanizeStatus } from "../shared/lib/format";
import { hrApiClient } from "../shared/lib/hrApiClient";
import type { HrDashboardStats, HrListResult } from "../shared/types/hr";
import { ActionButton, PageHeader } from "../shared/ui";
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
  const text = useAppText();
  const { i18n, t } = useTranslation();
  const { session } = useAuth();
  const { state: businessContext } = useBusinessContext();
  const locale = getAppLocale(i18n.language);
  const permissions = new Set(session.permissionCodes);
  const scopedAdminRole = getScopedAdminRole(session.roles);
  const canViewEmployees = permissions.has("employees.view");
  const canViewVacations = permissions.has("vacations.view");
  const canViewAttention = permissions.has("attention.view");

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
        toast.warning(text("Часть дополнительных данных главной страницы недоступна по текущим правам", "Some additional dashboard data is unavailable with the current permissions"));
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("common.errors.dashboardLoad"),
      );
    } finally {
      setIsLoading(false);
    }
  }, [canViewEmployees, canViewVacations, t, text]);

  useEffect(() => {
    void loadDashboard();
  }, [
    loadDashboard,
    businessContext?.enterpriseId,
    businessContext?.departmentId,
  ]);

  const pageTitle =
    scopedAdminRole === "enterprise_admin"
      ? text("Обзор предприятия", "Enterprise overview")
      : scopedAdminRole === "department_admin"
        ? text("Обзор отдела", "Department overview")
        : t("dashboard.hero.title");
  const pageDescription =
    scopedAdminRole === "enterprise_admin"
      ? text(
          `Сводка кадровых процессов ${session.enterpriseName || "вашего предприятия"}. Все показатели и действия ограничены этим предприятием.`,
          `HR process summary for ${session.enterpriseName || "your enterprise"}. All metrics and actions are limited to this enterprise.`,
        )
      : scopedAdminRole === "department_admin"
        ? text(
            `Сводка кадровых процессов ${session.departmentName || "вашего отдела"}. Все показатели и действия ограничены этим подразделением.`,
            `HR process summary for ${session.departmentName || "your department"}. All metrics and actions are limited to this department.`,
          )
        : text(
            "Сводка кадровых процессов и ситуаций, которые требуют внимания.",
            "Summary of HR processes and situations that require attention.",
          );

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <ActionButton
            action="refresh"
            loading={isLoading}
            onClick={() => void loadDashboard()}
          >
            {t("common.actions.refresh")}
          </ActionButton>
        }
        description={pageDescription}
        eyebrow={scopedAdminRole ? text("Локальное администрирование", "Local administration") : "HR Control Center"}
        icon={<FiGrid />}
        title={pageTitle}
      />

      {canViewAttention ? <AttentionQueueSection /> : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title={text("Сотрудники", "Employees")} value={stats.employeesTotal} icon={FiUsers} />
        {scopedAdminRole === "department_admin" ? (
          <StatCard title={text("Должности", "Positions")} value={stats.positionsTotal} icon={FiBriefcase} />
        ) : (
          <StatCard title={text("Отделы", "Departments")} value={stats.departmentsTotal} icon={FiGrid} />
        )}
        <StatCard title={text("Ближайшие отпуска · 30 дней", "Upcoming vacations · 30 days")} value={stats.upcomingVacations} icon={FiCalendar} />
        <StatCard title={text("Открытые вакансии", "Open vacancies")} value={stats.openVacancies} icon={FiBriefcase} />
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        {canViewEmployees && (
          <DashboardListCard linkLabel={text("Все сотрудники", "All employees")} linkTo="/employees" title={text("Последние приёмы", "Latest hires")}>
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
                      .join(" · ") || text("Назначение не заполнено", "Assignment not completed")}
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
            {!isLoading && employees.items.length === 0 && <EmptyDashboardRow text={text} />}
          </DashboardListCard>
        )}

        {canViewVacations && (
          <DashboardListCard linkLabel={text("Реестр отпусков", "Vacation registry")} linkTo="/vacations" title={text("Ближайшие отпуска", "Upcoming vacations")}>
            {vacations.items.map((vacation) => (
              <Link
                className="app-surface-muted app-border app-hover-muted flex items-center justify-between gap-4 rounded-2xl border px-4 py-3.5 transition"
                key={String(vacation.id)}
                to={`/vacations?employee=${String(vacation.employee_id)}`}
              >
                <div className="min-w-0">
                  <p className="app-text truncate font-black">{String(vacation.employee_name ?? "—")}</p>
                  <p className="app-muted mt-1 line-clamp-2 text-sm font-medium">
                    {String(vacation.vacation_type_name ?? text("Отпуск", "Vacation"))} · {formatDate(vacation.starts_at, locale)} — {formatDate(vacation.ends_at, locale)}
                  </p>
                </div>
                <span className="app-accent-soft shrink-0 rounded-full border px-3 py-1 text-xs font-black">
                  {humanizeStatus(vacation.status, t)}
                </span>
              </Link>
            ))}
            {!isLoading && vacations.items.length === 0 && <EmptyDashboardRow text={text} />}
          </DashboardListCard>
        )}
      </section>
    </div>
  );
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

function EmptyDashboardRow({
  text,
}: {
  text: (ru: string, en: string) => string;
}): JSX.Element {
  return (
    <div className="app-surface-muted app-muted rounded-2xl p-6 text-center text-sm font-medium">
      {text("Записей нет", "No records")}
    </div>
  );
}
