import { useCallback, useEffect, useState } from "react";
import { FiAlertCircle, FiArrowRight } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import { useBusinessContext } from "../business-context/useBusinessContext";
import { useAppLocale, useAppText } from "../../shared/i18n";
import { hrApiClient } from "../../shared/lib/hrApiClient";
import type { AttentionItem } from "../../shared/types/hr";
import { ActionButton, EmptyState, LoadingState } from "../../shared/ui";

export function AttentionQueueSection(): JSX.Element {
  const text = useAppText();
  const locale = useAppLocale();
  const navigate = useNavigate();
  const { state: businessContext } = useBusinessContext();
  const [items, setItems] = useState<AttentionItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      setItems(await hrApiClient.listAttentionItems());
    } catch (error) {
      toast.error(errorMessage(error, text("Не удалось загрузить рабочую очередь", "Failed to load attention queue")));
    } finally {
      setLoading(false);
    }
  }, [text]);

  useEffect(() => {
    void load();
  }, [load, businessContext?.enterpriseId, businessContext?.departmentId]);

  const critical = items.filter((item) => item.severity === "critical").length;
  const warnings = items.filter((item) => item.severity === "warning").length;

  return (
    <section className="app-surface app-border overflow-hidden rounded-[28px] border">
      <div className="app-border-soft flex flex-col gap-4 border-b px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="app-accent-soft app-accent-text flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border">
            <FiAlertCircle className="h-5 w-5" />
          </span>
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            <h2 className="app-text text-lg font-black">{text("Требует внимания", "Needs attention")}</h2>
            <div className="app-muted flex flex-wrap items-center gap-2 text-xs font-bold">
              <span>{items.length} {text("задач", "tasks")}</span>
              <span>•</span>
              <span>{critical} {text("критичных", "critical")}</span>
              <span>•</span>
              <span>{warnings} {text("требуют внимания", "need attention")}</span>
            </div>
          </div>
        </div>
        <ActionButton
          action="refresh"
          loading={loading}
          onClick={() => void load()}
          size="sm"
        />
      </div>

      <div className="p-4 sm:p-5">
        {loading ? (
          <LoadingState label={text("Собираем кадровые задачи...", "Collecting HR tasks...")} />
        ) : items.length === 0 ? (
          <EmptyState
            description={text("Сейчас нет просроченных сроков, незавершённых назначений и других кадровых ситуаций, требующих действия.", "There are currently no overdue deadlines, incomplete assignments, or other HR situations requiring action.")}
            title={text("Рабочая очередь пуста", "Attention queue is empty")}
          />
        ) : (
          <div className="grid gap-3">
            {items.map((item) => (
              <button
                className="app-surface-muted app-border group grid w-full gap-3 rounded-[20px] border p-4 text-left transition hover:-translate-y-0.5 hover:border-[var(--accent-border)] sm:grid-cols-[auto_1fr_auto] sm:items-center"
                key={item.id}
                onClick={() => navigate(item.path)}
                type="button"
              >
                <span className={`h-2.5 w-2.5 rounded-full ${severityClass(item.severity)}`} />
                <span className="min-w-0">
                  <span className="app-text block font-black">{item.title}</span>
                  <span className="app-muted mt-1 block text-sm leading-5">{item.description}</span>
                  {item.dueDate ? (
                    <span className="app-muted mt-2 block text-xs font-bold">
                      {text("Срок:", "Due:")} {formatDate(item.dueDate, locale)}
                    </span>
                  ) : null}
                </span>
                <FiArrowRight className="app-muted transition group-hover:translate-x-1" />
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function severityClass(severity: AttentionItem["severity"]): string {
  if (severity === "critical") return "bg-red-500";
  if (severity === "warning") return "bg-amber-500";
  return "bg-blue-500";
}

function formatDate(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale).format(new Date(`${value}T00:00:00`));
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message.split("Error: ").pop() || fallback : fallback;
}
