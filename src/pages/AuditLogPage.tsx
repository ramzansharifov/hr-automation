import { useCallback, useEffect, useState } from "react";
import { FiActivity, FiRefreshCw, FiSearch } from "react-icons/fi";
import { toast } from "react-toastify";

import { hrApiClient } from "../shared/lib/hrApiClient";
import type { AuditEvent } from "../shared/types/hr";
import { Button, EmptyState, Input, LoadingState } from "../shared/ui";

export function AuditLogPage(): JSX.Element {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async (query = search): Promise<void> => {
    setIsLoading(true);
    try {
      setEvents(
        await hrApiClient.listAuditEvents({
          search: query.trim() || undefined,
          limit: 300,
        }),
      );
    } catch (error) {
      toast.error(getErrorMessage(error, "Не удалось загрузить журнал действий"));
    } finally {
      setIsLoading(false);
    }
  }, [search]);

  useEffect(() => {
    void load("");
    // The initial request intentionally ignores the empty mutable search field.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      <section className="app-accent-gradient-panel flex flex-col gap-5 rounded-[30px] border p-7 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-white">
            <FiActivity className="h-6 w-6" />
          </span>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-white/65">
              Администрирование
            </p>
            <h1 className="mt-1 text-3xl font-black tracking-tight text-white sm:text-4xl">
              Журнал действий
            </h1>
            <p className="mt-2 max-w-3xl text-sm font-medium text-white/70">
              Неизменяемая история кадровых, административных и системных операций.
            </p>
          </div>
        </div>
        <Button
          className="border-white/20 bg-white/10 text-white"
          leftIcon={<FiRefreshCw className={isLoading ? "animate-spin" : ""} />}
          onClick={() => void load()}
          variant="ghost"
        >
          Обновить
        </Button>
      </section>

      <section className="app-surface app-border rounded-[26px] border p-5">
        <form
          className="flex flex-col gap-3 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            void load(search);
          }}
        >
          <div className="relative flex-1">
            <FiSearch className="app-muted pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2" />
            <Input
              className="pl-11"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Пользователь, действие, сущность или ID"
              value={search}
            />
          </div>
          <Button type="submit">Найти</Button>
          {search && (
            <Button
              onClick={() => {
                setSearch("");
                void load("");
              }}
              type="button"
              variant="secondary"
            >
              Сбросить
            </Button>
          )}
        </form>
      </section>

      {isLoading ? (
        <LoadingState label="Загрузка журнала действий..." />
      ) : events.length === 0 ? (
        <EmptyState
          title="Записей нет"
          description="По выбранному запросу события не найдены."
        />
      ) : (
        <section className="app-surface app-border overflow-hidden rounded-[26px] border">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] border-collapse text-left">
              <thead className="app-surface-muted">
                <tr className="app-border-soft border-b">
                  <HeaderCell>Дата и время</HeaderCell>
                  <HeaderCell>Кто</HeaderCell>
                  <HeaderCell>Действие</HeaderCell>
                  <HeaderCell>Объект</HeaderCell>
                  <HeaderCell>Изменение</HeaderCell>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr className="app-border-soft border-b last:border-b-0" key={event.id}>
                    <Cell>
                      <span className="font-bold">{formatAuditDate(event.occurredAt)}</span>
                    </Cell>
                    <Cell>
                      <p className="app-text font-black">{event.actorUsername}</p>
                      <p className="app-muted mt-1 text-xs">{actorTypeLabel(event.actorAccountType)}</p>
                    </Cell>
                    <Cell>
                      <span className="app-accent-soft app-accent-text inline-flex rounded-full border px-2.5 py-1 text-xs font-black">
                        {actionLabel(event.action)}
                      </span>
                    </Cell>
                    <Cell>
                      <p className="app-text font-bold">{entityLabel(event.entityType)}</p>
                      {event.entityId !== null && (
                        <p className="app-muted mt-1 text-xs">ID {event.entityId}</p>
                      )}
                    </Cell>
                    <Cell>
                      <ChangeSummary event={event} />
                    </Cell>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function HeaderCell({ children }: { children: React.ReactNode }): JSX.Element {
  return <th className="app-muted px-5 py-4 text-xs font-black uppercase tracking-wide">{children}</th>;
}

function Cell({ children }: { children: React.ReactNode }): JSX.Element {
  return <td className="app-text-soft px-5 py-4 align-top text-sm">{children}</td>;
}

function ChangeSummary({ event }: { event: AuditEvent }): JSX.Element {
  if (event.metadata && Object.keys(event.metadata).length > 0) {
    return (
      <p className="app-muted max-w-md text-xs leading-5">
        {Object.entries(event.metadata)
          .slice(0, 3)
          .map(([key, value]) => `${key}: ${String(value ?? "—")}`)
          .join(" · ")}
      </p>
    );
  }
  if (event.before && event.after) {
    const changed = Object.keys(event.after).filter(
      (key) => JSON.stringify(event.before?.[key]) !== JSON.stringify(event.after?.[key]),
    );
    return (
      <p className="app-muted max-w-md text-xs leading-5">
        {changed.length > 0 ? `Изменены поля: ${changed.slice(0, 6).join(", ")}` : "Запись обновлена"}
      </p>
    );
  }
  return <span className="app-muted text-xs">—</span>;
}

function formatAuditDate(value: string): string {
  const date = new Date(value.includes("T") ? value : `${value.replace(" ", "T")}Z`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("ru-RU");
}

function actorTypeLabel(value: AuditEvent["actorAccountType"]): string {
  if (value === "system_admin") return "Системный администратор";
  if (value === "employee_user") return "Пользователь сотрудника";
  return "Система";
}

const actionLabels: Record<string, string> = {
  create: "Создание",
  update: "Изменение",
  delete: "Удаление",
  login: "Вход",
  logout: "Выход",
  "password.change": "Смена пароля",
  "employment.change": "Кадровое изменение",
  "employment.terminate": "Увольнение",
  "employment.correct_hire_date": "Исправление даты приёма",
  "candidate.hire": "Приём кандидата",
  "vacancy.create": "Создание вакансии",
  "vacancy.update": "Изменение вакансии",
  "vacancy.delete": "Удаление вакансии",
  "candidate.create": "Создание кандидата",
  "candidate.update": "Изменение кандидата",
  "candidate.delete": "Удаление кандидата",
  "backup.create": "Резервная копия",
  "backup.restore": "Восстановление",
  "export.employees_csv": "Экспорт сотрудников",
};

function actionLabel(value: string): string {
  return actionLabels[value] ?? value;
}

const entityLabels: Record<string, string> = {
  employees: "Сотрудник",
  candidates: "Кандидат",
  vacancies: "Вакансия",
  vacations: "Отпуск",
  enterprises: "Предприятие",
  departments: "Отдел",
  positions: "Должность",
  roles: "Роль",
  users: "Пользователь",
  auth: "Авторизация",
  system: "Система",
};

function entityLabel(value: string): string {
  return entityLabels[value] ?? value;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback;
  const parts = error.message.split("Error: ");
  return parts[parts.length - 1] || fallback;
}
