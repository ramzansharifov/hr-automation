import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  FiActivity,
  FiBarChart2,
  FiBriefcase,
  FiCalendar,
  FiLayers,
  FiShield,
  FiTrendingDown,
  FiTrendingUp,
  FiUserCheck,
  FiUsers,
} from "react-icons/fi";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";

import {
  AnalyticsChart,
  type AnalyticsChartSeries,
} from "../features/analytics/AnalyticsChart";
import { getAppLocale } from "../shared/i18n";
import { hrApiClient } from "../shared/lib/hrApiClient";
import type {
  AnalyticsSeriesPoint,
  HrAnalyticsReport,
} from "../shared/types/hr";
import {
  ActionButton,
  AnimatedNumber,
  LoadingState,
  PageHeader,
  StatCard,
} from "../shared/ui";

export function AnalyticsPage(): JSX.Element {
  const { i18n, t } = useTranslation();
  const locale = getAppLocale(i18n.resolvedLanguage ?? i18n.language);
  const [report, setReport] = useState<HrAnalyticsReport | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadReport = useCallback(async (refresh = false): Promise<void> => {
    if (refresh) setIsRefreshing(true);
    try {
      setReport(await hrApiClient.getAnalytics());
    } catch (error) {
      toast.error(errorMessage(error, t("analytics.refreshError")));
    } finally {
      if (refresh) setIsRefreshing(false);
    }
  }, [t]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  if (!report) return <LoadingState label={t("analytics.loading")} />;

  const structureCharts = analyticsStructureCharts(report, t);
  const movement = movementChartData(report, t, locale);

  return (
    <div className="grid gap-6">
      <PageHeader
        actions={
          <ActionButton
            action="refresh"
            loading={isRefreshing}
            onClick={() => void loadReport(true)}
          >
            Обновить
          </ActionButton>
        }
        description={t("analytics.description")}
        eyebrow="HR Analytics"
        icon={<FiBarChart2 />}
        title={t("analytics.title")}
      />

      <ScopeNotice locale={locale} report={report} t={t} />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={FiUsers}
          title={t("analytics.metrics.activeEmployees")}
          value={report.activeEmployees}
        />
        <StatCard
          icon={FiBriefcase}
          title={t("analytics.metrics.openVacancies")}
          value={report.openVacancies}
        />
        <StatCard
          icon={FiUserCheck}
          title={t("analytics.metrics.candidatesInProcess")}
          value={report.candidatesInProcess}
        />
        <StatCard
          icon={FiCalendar}
          title={t("analytics.metrics.onLeaveToday")}
          value={report.employeesOnLeaveToday}
        />
      </section>

      <AnalyticsSection
        description={t("analytics.sections.workforce.description")}
        icon={<FiUsers />}
        title={t("analytics.sections.workforce.title")}
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Metric
            title={t("analytics.metrics.averageAge")}
            value={formatUnit(report.averageAge, t("analytics.units.years"), locale)}
          />
          <Metric
            title={t("analytics.metrics.averageTenure")}
            value={formatUnit(report.averageTenureYears, t("analytics.units.years"), locale)}
          />
          <Metric
            title={t("analytics.metrics.pendingEmployees")}
            value={report.pendingEmployees}
          />
          <Metric
            title={t("analytics.metrics.terminatedEmployees")}
            value={report.terminatedEmployees}
          />
        </div>

        <div
          className={
            structureCharts.length > 1
              ? "grid gap-5 xl:grid-cols-2"
              : "grid gap-5"
          }
        >
          {structureCharts.map((chart) => (
            <AnalyticsChart
              height={chartHeight(chart.points)}
              horizontal
              icon={<FiLayers />}
              key={chart.title}
              kind="bar"
              labels={chart.points.map((point) => point.label)}
              series={[
                {
                  label: t("analytics.charts.employees"),
                  values: chart.points.map((point) => point.value),
                },
              ]}
              title={chart.title}
            />
          ))}
        </div>
      </AnalyticsSection>

      <AnalyticsSection
        description={t("analytics.sections.movement.description")}
        icon={<FiActivity />}
        title={t("analytics.sections.movement.title")}
      >
        <div className="grid gap-4 md:grid-cols-3">
          <MovementMetric
            icon={<FiTrendingUp />}
            label={t("analytics.metrics.hires12m")}
            value={report.hiresLast12Months}
          />
          <MovementMetric
            icon={<FiTrendingDown />}
            label={t("analytics.metrics.terminations12m")}
            value={report.terminationsLast12Months}
          />
          <MovementMetric
            icon={<FiActivity />}
            label={t("analytics.metrics.netChange")}
            signed
            value={report.netChangeLast12Months}
          />
        </div>

        <AnalyticsChart
          height={340}
          icon={<FiActivity />}
          kind="line"
          labels={movement.labels}
          series={movement.series}
          title={t("analytics.charts.movement")}
        />
      </AnalyticsSection>

      <AnalyticsSection
        description={t("analytics.sections.recruitment.description")}
        icon={<FiBriefcase />}
        title={t("analytics.sections.recruitment.title")}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Metric
            title={t("analytics.metrics.averageTimeToHire")}
            value={formatUnit(report.averageTimeToHireDays, t("analytics.units.days"), locale)}
          />
          <Metric
            title={t("analytics.metrics.activePipeline")}
            value={report.candidatesInProcess}
          />
        </div>

        <div className="grid gap-5 xl:grid-cols-2">
          <AnalyticsChart
            height={330}
            icon={<FiUserCheck />}
            kind="doughnut"
            labels={report.candidatesByStatus.map((point) =>
              candidateStatusLabel(point.label, t),
            )}
            series={[
              {
                label: t("analytics.charts.candidates"),
                values: report.candidatesByStatus.map((point) => point.value),
              },
            ]}
            title={t("analytics.charts.candidatesStages")}
          />
          <AnalyticsChart
            height={330}
            icon={<FiBriefcase />}
            kind="doughnut"
            labels={report.vacanciesByStatus.map((point) =>
              vacancyStatusLabel(point.label, t),
            )}
            series={[
              {
                label: t("analytics.charts.vacancies"),
                values: report.vacanciesByStatus.map((point) => point.value),
              },
            ]}
            title={t("analytics.charts.vacanciesStatuses")}
          />
        </div>
      </AnalyticsSection>

      <AnalyticsSection
        description={t("analytics.sections.vacations.description")}
        icon={<FiCalendar />}
        title={t("analytics.sections.vacations.title")}
      >
        <AnalyticsChart
          height={chartHeight(report.leaveByType)}
          horizontal
          icon={<FiCalendar />}
          kind="bar"
          labels={report.leaveByType.map((point) => point.label)}
          series={[
            {
              label: t("analytics.charts.days"),
              values: report.leaveByType.map((point) => point.value),
            },
          ]}
          title={t("analytics.charts.vacationDays")}
          valueSuffix={` ${t("analytics.units.days")}`}
        />
      </AnalyticsSection>
    </div>
  );
}

function ScopeNotice({
  locale,
  report,
  t,
}: {
  locale: string;
  report: HrAnalyticsReport;
  t: TFunction;
}): JSX.Element {
  return (
    <section className="app-surface app-border flex flex-col gap-4 rounded-[24px] border p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <span className="app-accent-soft flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border">
          <FiShield className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="app-text font-black">{t("analytics.scope.title")}</p>
          <p className="app-muted mt-1 text-sm leading-6">
            {t("analytics.scope.description", {
              scope: localizedScopeLabel(report, t),
            })}
          </p>
        </div>
      </div>
      <div className="app-surface-muted app-border shrink-0 rounded-xl border px-4 py-3 text-right">
        <p className="app-muted text-[11px] font-black uppercase tracking-wide">
          {t("analytics.scope.updated")}
        </p>
        <p className="app-text mt-1 text-sm font-bold">
          {formatDateTime(report.generatedAt, locale)}
        </p>
      </div>
    </section>
  );
}

function AnalyticsSection({
  children,
  description,
  icon,
  title,
}: {
  children: ReactNode;
  description: string;
  icon: ReactNode;
  title: string;
}): JSX.Element {
  return (
    <section className="grid gap-4">
      <div className="flex items-start gap-3">
        <span className="app-accent-soft flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border">
          {icon}
        </span>
        <div>
          <h2 className="app-text text-lg font-black">{title}</h2>
          <p className="app-muted mt-1 text-sm">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function Metric({
  title,
  value,
}: {
  title: string;
  value: number | string;
}): JSX.Element {
  return (
    <article className="app-surface app-border rounded-[22px] border p-5">
      <p className="app-muted text-sm font-bold">{title}</p>
      <p className="app-text mt-2 text-2xl font-black">
        {typeof value === "number" ? <AnimatedNumber value={value} /> : value}
      </p>
    </article>
  );
}

function MovementMetric({
  icon,
  label,
  signed = false,
  value,
}: {
  icon: ReactNode;
  label: string;
  signed?: boolean;
  value: number;
}): JSX.Element {
  return (
    <article className="app-surface app-border flex items-center gap-4 rounded-[22px] border p-5">
      <span className="app-accent-soft flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border">
        {icon}
      </span>
      <div>
        <p className="app-muted text-xs font-black uppercase tracking-wide">
          {label}
        </p>
        <p className="app-text mt-1 text-2xl font-black">
          {signed && value > 0 ? "+" : ""}
          <AnimatedNumber value={value} />
        </p>
      </div>
    </article>
  );
}

function analyticsStructureCharts(
  report: HrAnalyticsReport,
  t: TFunction,
): Array<{ title: string; points: AnalyticsSeriesPoint[] }> {
  if (report.scope.type === "global") {
    return [
      {
        title: t("analytics.charts.headcountEnterprises"),
        points: report.headcountByEnterprise,
      },
      {
        title: t("analytics.charts.headcountDepartments"),
        points: report.headcountByDepartment,
      },
    ];
  }
  if (report.scope.type === "enterprise") {
    return [
      {
        title: t("analytics.charts.headcountDepartments"),
        points: report.headcountByDepartment,
      },
      {
        title: t("analytics.charts.headcountPositions"),
        points: report.headcountByPosition,
      },
    ];
  }
  return [
    {
      title: t("analytics.charts.headcountPositions"),
      points: report.headcountByPosition,
    },
  ];
}

function movementChartData(
  report: HrAnalyticsReport,
  t: TFunction,
  locale: string,
): {
  labels: string[];
  series: AnalyticsChartSeries[];
} {
  const months = lastTwelveMonths(report.generatedAt);
  const hires = new Map(report.hiresByMonth.map((point) => [point.label, point.value]));
  const terminations = new Map(
    report.terminationsByMonth.map((point) => [point.label, point.value]),
  );

  return {
    labels: months.map((month) => formatMonth(month, locale)),
    series: [
      {
        label: t("analytics.charts.hired"),
        values: months.map((month) => hires.get(month) ?? 0),
      },
      {
        label: t("analytics.charts.terminated"),
        values: months.map((month) => terminations.get(month) ?? 0),
      },
    ],
  };
}

function lastTwelveMonths(generatedAt: string): string[] {
  const current = new Date(generatedAt);
  const safeDate = Number.isNaN(current.getTime()) ? new Date() : current;
  const result: string[] = [];

  for (let offset = 11; offset >= 0; offset -= 1) {
    const date = new Date(
      Date.UTC(
        safeDate.getUTCFullYear(),
        safeDate.getUTCMonth() - offset,
        1,
      ),
    );
    result.push(
      `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`,
    );
  }

  return result;
}

function chartHeight(points: AnalyticsSeriesPoint[]): number {
  return Math.max(280, Math.min(440, 150 + points.length * 42));
}

function formatUnit(
  value: number | null,
  unit: string,
  locale: string,
): string {
  return value === null ? "—" : `${value.toLocaleString(locale)} ${unit}`;
}

function formatDateTime(value: string, locale: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatMonth(value: string, locale: string): string {
  if (!/^\d{4}-\d{2}$/.test(value)) return value;
  const date = new Date(`${value}-01T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  }).format(date);
}

function vacancyStatusLabel(value: string, t: TFunction): string {
  return t(`analytics.vacancyStatus.${value}`, { defaultValue: value });
}

function candidateStatusLabel(value: string, t: TFunction): string {
  return t(`analytics.candidateStatus.${value}`, { defaultValue: value });
}

function localizedScopeLabel(report: HrAnalyticsReport, t: TFunction): string {
  if (report.scope.type === "global") return t("analytics.scope.global");
  if (report.scope.type === "self") return t("analytics.scope.self");
  return report.scope.label;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error
    ? error.message.split("Error: ").pop() || fallback
    : fallback;
}
