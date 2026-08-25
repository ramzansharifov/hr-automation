import { useCallback, useEffect, useState } from "react";
import { FiAlertCircle, FiArrowRight, FiRefreshCw } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import { useBusinessContext } from "../business-context/useBusinessContext";
import { hrApiClient } from "../../shared/lib/hrApiClient";
import type { AttentionItem } from "../../shared/types/hr";
import { Button, EmptyState, LoadingState } from "../../shared/ui";

export function AttentionQueueSection(): JSX.Element {
  const navigate = useNavigate();
  const { state: businessContext } = useBusinessContext();
  const [items, setItems] = useState<AttentionItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      setItems(await hrApiClient.listAttentionItems());
    } catch (error) {
      toast.error(errorMessage(error, "Не удалось загрузить рабочую очередь"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, businessContext?.enterpriseId, businessContext?.departmentId]);

  const critical = items.filter((item) => item.severity === "critical").length;
  const warnings = items.filter((item) => item.severity === "warning").length;

  return (
    <section className="app-surface app-border overflow-hidden rounded-[28px] border">
      <div className="app-border-soft flex flex-col gap-4 border-b px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex min-w-0 items-start gap-3">
          <span className="app-accent-soft app-accent-text flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border">
            <FiAlertCircle className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h2 className="app-text text-lg font-black">Требует внимания</h2>
              <div className="app-muted flex flex-wrap items-center gap-2 text-xs font-bold">
                <span>{items.length} задач</span>
                <span>•</span>
                <span>{critical} критичных</span>
                <span>•</span>
                <span>{warnings} требуют внимания</span>
              </div>
            </div>
            <p className="app-muted mt-1 text-sm font-semibold leading-5">
              Кадровые ситуации, сроки и незавершённые действия в текущем рабочем контексте.
            </p>
          </div>
        </div>
        <Button
          disabled={loading}
          leftIcon={<FiRefreshCw className={loading ? "animate-spin" : undefined} />}
          onClick={() => void load()}
          size="sm"
          variant="secondary"
        >
          Обновить
        </Button>
      </div>

      <div className="p-4 sm:p-5">
        {loading ? (
          <LoadingState label="Собираем кадровые задачи..." />
        ) : items.length === 0 ? (
          <EmptyState
            description="Сейчас нет просроченных сроков, незавершённых назначений и других кадровых ситуаций, требующих действия."
            title="Рабочая очередь пуста"
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
                      Срок: {formatDate(item.dueDate)}
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

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ru-RU").format(new Date(`${value}T00:00:00`));
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message.split("Error: ").pop() || fallback : fallback;
}
