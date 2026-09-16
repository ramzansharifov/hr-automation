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

import {
  AnalyticsChart,
  type AnalyticsChartSeries,
} from "../features/analytics/AnalyticsChart";
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
  const [report, setReport] = useState<HrAnalyticsReport | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadReport = useCallback(async (refresh = false): Promise<void> => {
    if (refresh) setIsRefreshing(true);
    try {
      setReport(await hrApiClient.getAnalytics());
    } catch (error) {
      toast.error(errorMessage(error, "Не удалось загрузить аналитику"));
    } finally {
      if (refresh) setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  if (!report) return <LoadingState label="Собираем HR-аналитику..." />;

  const structureCharts = analyticsStructureCharts(report);
  const movement = movementChartData(report);

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
        description="Кадровый состав, движение, подбор и отпуска. Все показатели рассчитываются на backend только в области данных текущего разрешения."
        eyebrow="HR Analytics"
        icon={<FiBarChart2 />}
        title="Аналитика"
      />

      <ScopeNotice report={report} />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={FiUsers}
          title="Активные сотрудники"
          value={report.activeEmployees}
        />
        <StatCard
          icon={FiBriefcase}
          title="Открытые вакансии"
          value={report.openVacancies}
        />
        <StatCard
          icon={FiUserCheck}
          title="Кандидаты в процессе"
          value={report.candidatesInProcess}
        />
        <StatCard
          icon={FiCalendar}
          title="Сегодня в отпуске"
          value={report.employeesOnLeaveToday}
        />
      </section>

      <AnalyticsSection
        description="Текущий состав и качество заполнения кадровых данных."
        icon={<FiUsers />}
        title="Кадровый состав"
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Metric
            title="Средний возраст"
            value={formatUnit(report.averageAge, "лет")}
          />
          <Metric
            title="Средний стаж"
            value={formatUnit(report.averageTenureYears, "лет")}
          />
          <Metric
            title="Требуют дооформления"
            value={report.pendingEmployees}
          />
          <Metric
            title="Уволенные в базе"
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
                  label: "Сотрудников",
                  values: chart.points.map((point) => point.value),
                },
              ]}
              title={chart.title}
            />
          ))}
        </div>
      </AnalyticsSection>

      <AnalyticsSection
        description="Приёмы и увольнения за последние 12 месяцев в текущей области данных."
        icon={<FiActivity />}
        title="Кадровое движение"
      >
        <div className="grid gap-4 md:grid-cols-3">
          <MovementMetric
            icon={<FiTrendingUp />}
            label="Принято за 12 месяцев"
            value={report.hiresLast12Months}
          />
          <MovementMetric
            icon={<FiTrendingDown />}
            label="Уволено за 12 месяцев"
            value={report.terminationsLast12Months}
          />
          <MovementMetric
            icon={<FiActivity />}
            label="Чистое изменение"
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
          title="Динамика приёмов и увольнений"
        />
      </AnalyticsSection>

      <AnalyticsSection
        description="Состояние вакансий и воронки кандидатов без выхода за доступное предприятие или отдел."
        icon={<FiBriefcase />}
        title="Подбор"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Metric
            title="Средний time-to-hire"
            value={formatUnit(report.averageTimeToHireDays, "дн.")}
          />
          <Metric
            title="Кандидаты в активной воронке"
            value={report.candidatesInProcess}
          />
        </div>

        <div className="grid gap-5 xl:grid-cols-2">
          <AnalyticsChart
            height={330}
            icon={<FiUserCheck />}
            kind="doughnut"
            labels={report.candidatesByStatus.map((point) =>
              candidateStatusLabel(point.label),
            )}
            series={[
              {
                label: "Кандидатов",
                values: report.candidatesByStatus.map((point) => point.value),
              },
            ]}
            title="Кандидаты по этапам"
          />
          <AnalyticsChart
            height={330}
            icon={<FiBriefcase />}
            kind="doughnut"
            labels={report.vacanciesByStatus.map((point) =>
              vacancyStatusLabel(point.label),
            )}
            series={[
              {
                label: "Вакансий",
                values: report.vacanciesByStatus.map((point) => point.value),
              },
            ]}
            title="Вакансии по статусам"
          />
        </div>
      </AnalyticsSection>

      <AnalyticsSection
        description="Использованные отпускные дни текущего года в доступной области."
        icon={<FiCalendar />}
        title="Отпуска"
      >
        <AnalyticsChart
          height={chartHeight(report.leaveByType)}
          horizontal
          icon={<FiCalendar />}
          kind="bar"
          labels={report.leaveByType.map((point) => point.label)}
          series={[
            {
              label: "Дней",
              values: report.leaveByType.map((point) => point.value),
            },
          ]}
          title="Отпускные дни по видам"
          valueSuffix=" дн."
        />
      </AnalyticsSection>
    </div>
  );
}

function ScopeNotice({ report }: { report: HrAnalyticsReport }): JSX.Element {
  return (
    <section className="app-surface app-border flex flex-col gap-4 rounded-[24px] border p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <span className="app-accent-soft flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border">
          <FiShield className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="app-text font-black">Область данных защищена ролью</p>
          <p className="app-muted mt-1 text-sm leading-6">
            Backend вернул только агрегаты области:{" "}
            <span className="app-text font-bold">{report.scope.label}</span>.
            Выбор фильтров в интерфейсе не может расширить эту область.
          </p>
        </div>
      </div>
      <div className="app-surface-muted app-border shrink-0 rounded-xl border px-4 py-3 text-right">
        <p className="app-muted text-[11px] font-black uppercase tracking-wide">
          Обновлено
        </p>
        <p className="app-text mt-1 text-sm font-bold">
          {formatDateTime(report.generatedAt)}
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
): Array<{ title: string; points: AnalyticsSeriesPoint[] }> {
  if (report.scope.type === "global") {
    return [
      {
        title: "Численность по предприятиям",
        points: report.headcountByEnterprise,
      },
      {
        title: "Численность по отделам",
        points: report.headcountByDepartment,
      },
    ];
  }
  if (report.scope.type === "enterprise") {
    return [
      {
        title: "Численность по отделам",
        points: report.headcountByDepartment,
      },
      {
        title: "Численность по должностям",
        points: report.headcountByPosition,
      },
    ];
  }
  return [
    {
      title: "Численность по должностям",
      points: report.headcountByPosition,
    },
  ];
}

function movementChartData(report: HrAnalyticsReport): {
  labels: string[];
  series: AnalyticsChartSeries[];
} {
  const months = lastTwelveMonths(report.generatedAt);
  const hires = new Map(report.hiresByMonth.map((point) => [point.label, point.value]));
  const terminations = new Map(
    report.terminationsByMonth.map((point) => [point.label, point.value]),
  );

  return {
    labels: months.map(formatMonth),
    series: [
      {
        label: "Принято",
        values: months.map((month) => hires.get(month) ?? 0),
      },
      {
        label: "Уволено",
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

function formatUnit(value: number | null, unit: string): string {
  return value === null ? "—" : `${value.toLocaleString("ru-RU")} ${unit}`;
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatMonth(value: string): string {
  if (!/^\d{4}-\d{2}$/.test(value)) return value;
  const date = new Date(`${value}-01T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ru-RU", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  }).format(date);
}

function vacancyStatusLabel(value: string): string {
  const labels: Record<string, string> = {
    draft: "Черновик",
    open: "Открыта",
    closed: "Закрыта",
  };
  return labels[value] ?? value;
}

function candidateStatusLabel(value: string): string {
  const labels: Record<string, string> = {
    new: "Новый",
    screening: "Первичный отбор",
    interview: "Собеседование",
    offer: "Оффер",
    hired: "Принят на работу",
    rejected: "Отклонён",
  };
  return labels[value] ?? value;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error
    ? error.message.split("Error: ").pop() || fallback
    : fallback;
}
