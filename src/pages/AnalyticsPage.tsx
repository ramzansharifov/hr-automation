import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  FiActivity,
  FiBarChart2,
  FiBriefcase,
  FiCalendar,
  FiClock,
  FiLayers,
  FiShield,
  FiTrendingDown,
  FiTrendingUp,
  FiUserCheck,
  FiUsers,
} from "react-icons/fi";
import { toast } from "react-toastify";

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

  const structureCards = analyticsStructureCards(report);

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
        <div className={structureCards.length > 1 ? "grid gap-5 xl:grid-cols-2" : "grid gap-5"}>
          {structureCards.map((card) => (
            <SeriesCard
              icon={<FiLayers />}
              key={card.title}
              points={card.points}
              title={card.title}
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
        <div className="grid gap-5 xl:grid-cols-2">
          <SeriesCard
            icon={<FiTrendingUp />}
            labelFormatter={formatMonth}
            points={report.hiresByMonth}
            title="Приёмы по месяцам"
          />
          <SeriesCard
            icon={<FiTrendingDown />}
            labelFormatter={formatMonth}
            points={report.terminationsByMonth}
            title="Увольнения по месяцам"
          />
        </div>
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
          <SeriesCard
            icon={<FiUserCheck />}
            labelFormatter={candidateStatusLabel}
            points={report.candidatesByStatus}
            title="Кандидаты по этапам"
          />
          <SeriesCard
            icon={<FiBriefcase />}
            labelFormatter={vacancyStatusLabel}
            points={report.vacanciesByStatus}
            title="Вакансии по статусам"
          />
        </div>
      </AnalyticsSection>

      <AnalyticsSection
        description="Использованные отпускные дни текущего года в доступной области."
        icon={<FiCalendar />}
        title="Отпуска"
      >
        <SeriesCard
          icon={<FiCalendar />}
          points={report.leaveByType}
          title="Отпускные дни по видам"
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
        <p className="app-muted text-xs font-black uppercase tracking-wide">{label}</p>
        <p className="app-text mt-1 text-2xl font-black">
          {signed && value > 0 ? "+" : ""}
          <AnimatedNumber value={value} />
        </p>
      </div>
    </article>
  );
}

function SeriesCard({
  icon,
  labelFormatter = identity,
  points,
  title,
}: {
  icon: ReactNode;
  labelFormatter?: (label: string) => string;
  points: AnalyticsSeriesPoint[];
  title: string;
}): JSX.Element {
  const max = Math.max(...points.map((point) => point.value), 1);
  return (
    <article className="app-surface app-border rounded-[24px] border p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <span className="app-accent-soft flex h-10 w-10 items-center justify-center rounded-xl border">
          {icon}
        </span>
        <h3 className="app-text font-black">{title}</h3>
      </div>
      <div className="mt-5 grid gap-3">
        {points.length === 0 ? (
          <p className="app-muted text-sm">Пока недостаточно данных.</p>
        ) : (
          points.slice(0, 12).map((point) => (
            <div className="grid gap-1.5" key={point.label}>
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="app-text truncate font-semibold">
                  {labelFormatter(point.label)}
                </span>
                <span className="app-text-soft shrink-0 font-black">
                  {point.value}
                </span>
              </div>
              <div
                aria-label={`${labelFormatter(point.label)}: ${point.value}`}
                className="app-surface-muted h-2 overflow-hidden rounded-full"
                role="img"
              >
                <div
                  className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-500"
                  style={{
                    width: `${Math.max(
                      (point.value / max) * 100,
                      point.value > 0 ? 3 : 0,
                    )}%`,
                  }}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </article>
  );
}

function analyticsStructureCards(
  report: HrAnalyticsReport,
): Array<{ title: string; points: AnalyticsSeriesPoint[] }> {
  if (report.scope.type === "global") {
    return [
      { title: "Численность по предприятиям", points: report.headcountByEnterprise },
      { title: "Численность по отделам", points: report.headcountByDepartment },
    ];
  }
  if (report.scope.type === "enterprise") {
    return [
      { title: "Численность по отделам", points: report.headcountByDepartment },
      { title: "Численность по должностям", points: report.headcountByPosition },
    ];
  }
  return [
    { title: "Численность по должностям", points: report.headcountByPosition },
  ];
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
    year: "numeric",
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

function identity(value: string): string {
  return value;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message.split("Error: ").pop() || fallback : fallback;
}
