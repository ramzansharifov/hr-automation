import Chart from "chart.js/auto";
import type {
  ChartConfiguration,
  ChartDataset,
  ChartType,
  TooltipItem,
} from "chart.js";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

export type AnalyticsChartKind = "bar" | "line" | "doughnut";

export interface AnalyticsChartSeries {
  label: string;
  values: number[];
}

interface AnalyticsChartProps {
  emptyText?: string;
  height?: number;
  horizontal?: boolean;
  icon?: ReactNode;
  kind: AnalyticsChartKind;
  labels: string[];
  series: AnalyticsChartSeries[];
  title: string;
  valueSuffix?: string;
}

export function AnalyticsChart({
  emptyText = "Пока недостаточно данных.",
  height = 300,
  horizontal = false,
  icon,
  kind,
  labels,
  series,
  title,
  valueSuffix = "",
}: AnalyticsChartProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [themeRevision, setThemeRevision] = useState(0);
  const hasData = series.some((item) => item.values.some((value) => value !== 0));

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setThemeRevision((value) => value + 1);
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "data-accent", "class"],
    });
    return () => observer.disconnect();
  }, []);

  const theme = useMemo(() => readChartTheme(themeRevision), [themeRevision]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !hasData) return;

    const datasets = createDatasets(kind, series, theme);
    const config: ChartConfiguration = {
      type: kind as ChartType,
      data: {
        labels,
        datasets,
      },
      options: createChartOptions({
        horizontal,
        kind,
        theme,
        valueSuffix,
      }),
    };

    const chart = new Chart(canvas, config);
    return () => chart.destroy();
  }, [hasData, horizontal, kind, labels, series, theme, valueSuffix]);

  return (
    <article className="app-surface app-border rounded-[24px] border p-5 sm:p-6">
      <div className="flex items-center gap-3">
        {icon ? (
          <span className="app-accent-soft flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border">
            {icon}
          </span>
        ) : null}
        <h3 className="app-text font-black">{title}</h3>
      </div>
      {hasData ? (
        <div className="mt-5 min-w-0" style={{ height }}>
          <canvas aria-label={title} ref={canvasRef} role="img" />
        </div>
      ) : (
        <div
          className="app-surface-muted app-border app-muted mt-5 flex items-center justify-center rounded-2xl border border-dashed px-5 text-center text-sm"
          style={{ minHeight: Math.min(height, 220) }}
        >
          {emptyText}
        </div>
      )}
    </article>
  );
}

interface ChartTheme {
  accent: string;
  background: string;
  border: string;
  muted: string;
  surface: string;
  text: string;
  palette: string[];
}

function readChartTheme(revision: number): ChartTheme {
  void revision;
  const root = document.documentElement;
  const styles = getComputedStyle(root);
  const dark = root.dataset.theme === "dark";

  return {
    accent: cssValue(styles, "--accent", dark ? "#818cf8" : "#4f46e5"),
    background: dark ? "#111827" : "#ffffff",
    border: cssValue(styles, "--color-border-soft", dark ? "#2b3442" : "#e5e9ef"),
    muted: cssValue(styles, "--color-text-muted", dark ? "#9ca3af" : "#596273"),
    surface: cssValue(styles, "--color-surface", dark ? "#111827" : "#ffffff"),
    text: cssValue(styles, "--color-text", dark ? "#f3f4f6" : "#111827"),
    palette: dark
      ? ["#818cf8", "#34d399", "#60a5fa", "#fbbf24", "#f472b6", "#22d3ee", "#c084fc", "#fb7185"]
      : ["#4f46e5", "#059669", "#2563eb", "#d97706", "#db2777", "#0891b2", "#7c3aed", "#e11d48"],
  };
}

function cssValue(
  styles: CSSStyleDeclaration,
  name: string,
  fallback: string,
): string {
  const value = styles.getPropertyValue(name).trim();
  return value || fallback;
}

function createDatasets(
  kind: AnalyticsChartKind,
  series: AnalyticsChartSeries[],
  theme: ChartTheme,
): ChartDataset[] {
  if (kind === "doughnut") {
    const first = series[0];
    return [
      {
        label: first?.label ?? "",
        data: first?.values ?? [],
        backgroundColor: (first?.values ?? []).map(
          (_, index) => theme.palette[index % theme.palette.length],
        ),
        borderColor: theme.surface,
        borderWidth: 2,
        hoverBorderWidth: 2,
        hoverOffset: 7,
      },
    ];
  }

  return series.map((item, index) => {
    const color = index === 0 ? theme.accent : theme.palette[(index + 1) % theme.palette.length];
    if (kind === "line") {
      return {
        label: item.label,
        data: item.values,
        borderColor: color,
        backgroundColor: color,
        borderWidth: 3,
        pointBackgroundColor: theme.surface,
        pointBorderColor: color,
        pointBorderWidth: 2,
        pointHoverRadius: 6,
        pointRadius: 4,
        tension: 0.34,
        fill: false,
      };
    }

    return {
      label: item.label,
      data: item.values,
      backgroundColor: color,
      borderColor: color,
      borderRadius: 8,
      borderSkipped: false,
      maxBarThickness: 44,
    };
  });
}

function createChartOptions({
  horizontal,
  kind,
  theme,
  valueSuffix,
}: {
  horizontal: boolean;
  kind: AnalyticsChartKind;
  theme: ChartTheme;
  valueSuffix: string;
}): ChartConfiguration["options"] {
  const tooltip = {
    backgroundColor: theme.background,
    borderColor: theme.border,
    borderWidth: 1,
    titleColor: theme.text,
    bodyColor: theme.text,
    displayColors: true,
    padding: 12,
    callbacks: {
      label: (item: TooltipItem<ChartType>) => {
        const label = item.dataset.label ? `${item.dataset.label}: ` : "";
        const raw =
          typeof item.raw === "number"
            ? item.raw
            : Array.isArray(item.raw)
              ? item.raw[1]
              : Number(item.formattedValue.replace(/\s/g, ""));
        const value = Number.isFinite(Number(raw))
          ? Number(raw).toLocaleString("ru-RU")
          : item.formattedValue;
        return `${label}${value}${valueSuffix}`;
      },
    },
  };

  if (kind === "doughnut") {
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 650,
        easing: "easeOutQuart",
      },
      plugins: {
        legend: {
          display: true,
          position: "bottom",
          labels: {
            boxHeight: 8,
            boxWidth: 8,
            color: theme.muted,
            padding: 16,
            usePointStyle: true,
            pointStyle: "circle",
          },
        },
        tooltip,
      },
    };
  }

  const categoryAxis = {
    grid: {
      display: false,
    },
    ticks: {
      color: theme.muted,
      font: {
        size: 11,
        weight: 600 as const,
      },
      maxRotation: horizontal ? 0 : 35,
      minRotation: 0,
    },
    border: {
      display: false,
    },
  };
  const valueAxis = {
    beginAtZero: true,
    grid: {
      color: theme.border,
      drawTicks: false,
    },
    ticks: {
      color: theme.muted,
      precision: 0,
      padding: 8,
    },
    border: {
      display: false,
    },
  };

  return {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: horizontal ? "y" : "x",
    interaction: {
      intersect: false,
      mode: "index",
    },
    animation: {
      duration: 650,
      easing: "easeOutQuart",
    },
    plugins: {
      legend: {
        display: kind === "line" && seriesLegendNeeded(kind),
        labels: {
          boxHeight: 8,
          boxWidth: 8,
          color: theme.muted,
          padding: 16,
          usePointStyle: true,
          pointStyle: "circle",
        },
      },
      tooltip,
    },
    scales: horizontal
      ? {
          x: valueAxis,
          y: categoryAxis,
        }
      : {
          x: categoryAxis,
          y: valueAxis,
        },
  };
}

function seriesLegendNeeded(kind: AnalyticsChartKind): boolean {
  return kind === "line";
}
