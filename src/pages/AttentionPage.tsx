import { useEffect, useState } from "react";
import { FiAlertCircle, FiArrowRight, FiRefreshCw } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import { hrApiClient } from "../shared/lib/hrApiClient";
import type { AttentionItem } from "../shared/types/hr";
import { Button, EmptyState, LoadingState, PageHeader } from "../shared/ui";

export function AttentionPage(): JSX.Element {
  const navigate = useNavigate();
  const [items, setItems] = useState<AttentionItem[]>([]);
  const [loading, setLoading] = useState(true);

  async function load(): Promise<void> {
    setLoading(true);
    try {
      setItems(await hrApiClient.listAttentionItems());
    } catch (error) {
      toast.error(errorMessage(error, "Не удалось загрузить рабочую очередь"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const critical = items.filter((item) => item.severity === "critical").length;
  const warnings = items.filter((item) => item.severity === "warning").length;

  return (
    <div className="grid gap-6">
      <PageHeader
        actions={
          <Button leftIcon={<FiRefreshCw />} onClick={() => void load()} variant="secondary">
            Обновить
          </Button>
        }
        description="Единая очередь кадровых ситуаций, сроков и незавершённых действий. Каждая карточка ведёт сразу в нужный рабочий контекст."
        eyebrow="HR Workflow"
        icon={<FiAlertCircle />}
        meta={
          <div className="flex flex-wrap gap-2 text-xs font-bold text-white/80">
            <span>{items.length} задач</span>
            <span>•</span>
            <span>{critical} критичных</span>
            <span>•</span>
            <span>{warnings} требуют внимания</span>
          </div>
        }
        title="Требует внимания"
      />

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
              className="app-surface app-border group grid w-full gap-3 rounded-[22px] border p-5 text-left transition hover:-translate-y-0.5 hover:border-[var(--accent-border)] sm:grid-cols-[auto_1fr_auto] sm:items-center"
              key={item.id}
              onClick={() => navigate(item.path)}
              type="button"
            >
              <span className={`h-3 w-3 rounded-full ${severityClass(item.severity)}`} />
              <span className="min-w-0">
                <span className="app-text block font-black">{item.title}</span>
                <span className="app-muted mt-1 block text-sm leading-5">{item.description}</span>
                {item.dueDate && (
                  <span className="app-muted mt-2 block text-xs font-bold">Срок: {formatDate(item.dueDate)}</span>
                )}
              </span>
              <FiArrowRight className="app-muted transition group-hover:translate-x-1" />
            </button>
          ))}
        </div>
      )}
    </div>
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
