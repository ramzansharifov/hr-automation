import { useEffect, useState } from "react";
import {
  FiBarChart2,
  FiBriefcase,
  FiCalendar,
  FiClock,
  FiTrendingDown,
  FiTrendingUp,
  FiUsers,
} from "react-icons/fi";
import { toast } from "react-toastify";

import { hrApiClient } from "../shared/lib/hrApiClient";
import type { AnalyticsSeriesPoint, HrAnalyticsReport } from "../shared/types/hr";
import { LoadingState, PageHeader, StatCard } from "../shared/ui";

export function AnalyticsPage(): JSX.Element {
  const [report, setReport] = useState<HrAnalyticsReport | null>(null);

  useEffect(() => {
    void hrApiClient
      .getAnalytics()
      .then(setReport)
      .catch((error) => toast.error(errorMessage(error, "Не удалось загрузить аналитику")));
  }, []);

  if (!report) return <LoadingState label="Собираем HR-аналитику..." />;

  return (
    <div className="grid gap-6">
      <PageHeader
        description="Ключевые показатели кадрового состава, движения, подбора и отпусков в доступной организационной области."
        eyebrow="HR Analytics"
        icon={<FiBarChart2 />}
        title="Аналитика"
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={FiUsers} title="Активные сотрудники" value={report.activeEmployees} />
        <StatCard icon={FiClock} title="Ожидают оформления" value={report.pendingEmployees} />
        <StatCard icon={FiBriefcase} title="Открытые вакансии" value={report.openVacancies} />
        <StatCard icon={FiCalendar} title="Сегодня в отпуске" value={report.employeesOnLeaveToday} />
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Metric title="Средний возраст" value={report.averageAge === null ? "—" : `${report.averageAge} лет`} />
        <Metric title="Средний стаж" value={report.averageTenureYears === null ? "—" : `${report.averageTenureYears} лет`} />
        <Metric title="Средний time-to-hire" value={report.averageTimeToHireDays === null ? "—" : `${report.averageTimeToHireDays} дн.`} />
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <SeriesCard title="Численность по предприятиям" icon={<FiUsers />} points={report.headcountByEnterprise} />
        <SeriesCard title="Численность по отделам" icon={<FiUsers />} points={report.headcountByDepartment} />
        <SeriesCard title="Приёмы за 12 месяцев" icon={<FiTrendingUp />} points={report.hiresByMonth} />
        <SeriesCard title="Увольнения за 12 месяцев" icon={<FiTrendingDown />} points={report.terminationsByMonth} />
        <SeriesCard title="Вакансии по статусам" icon={<FiBriefcase />} points={report.vacanciesByStatus} />
        <SeriesCard title="Отпускные дни по видам" icon={<FiCalendar />} points={report.leaveByType} />
      </section>
    </div>
  );
}

function Metric({ title, value }: { title: string; value: string }): JSX.Element {
  return (
    <article className="app-surface app-border rounded-[22px] border p-5">
      <p className="app-muted text-sm font-bold">{title}</p>
      <p className="app-text mt-2 text-2xl font-black">{value}</p>
    </article>
  );
}

function SeriesCard({
  icon,
  points,
  title,
}: {
  icon: React.ReactNode;
  points: AnalyticsSeriesPoint[];
  title: string;
}): JSX.Element {
  const max = Math.max(...points.map((point) => point.value), 1);
  return (
    <article className="app-surface app-border rounded-[24px] border p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <span className="app-accent-soft flex h-10 w-10 items-center justify-center rounded-xl">{icon}</span>
        <h2 className="app-text font-black">{title}</h2>
      </div>
      <div className="mt-5 grid gap-3">
        {points.length === 0 ? (
          <p className="app-muted text-sm">Пока недостаточно данных.</p>
        ) : (
          points.slice(0, 12).map((point) => (
            <div className="grid gap-1" key={point.label}>
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="app-text truncate font-semibold">{point.label}</span>
                <span className="app-muted font-black">{point.value}</span>
              </div>
              <div className="app-surface-muted h-2 overflow-hidden rounded-full">
                <div
                  className="h-full rounded-full bg-[var(--accent)]"
                  style={{ width: `${Math.max((point.value / max) * 100, point.value > 0 ? 3 : 0)}%` }}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </article>
  );
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message.split("Error: ").pop() || fallback : fallback;
}
