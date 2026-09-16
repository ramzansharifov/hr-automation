import { useCallback, useEffect, useState } from "react";
import { FiActivity, FiSearch } from "react-icons/fi";
import { toast } from "react-toastify";

import { useAuth } from "../features/auth/AuthContext";
import { useAppLocale, useAppText } from "../shared/i18n";
import { hrApiClient } from "../shared/lib/hrApiClient";
import type { AuditEvent } from "../shared/types/hr";
import {
  ActionButton,
  DataTable,
  Input,
  PageHeader,
  type DataTableColumn,
} from "../shared/ui";

export function AuditLogPage(): JSX.Element {
  const text = useAppText();
  const locale = useAppLocale();
  const { session } = useAuth();
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
      toast.error(getErrorMessage(error, text("Не удалось загрузить журнал действий", "Failed to load audit log")));
    } finally {
      setIsLoading(false);
    }
  }, [search, text]);

  useEffect(() => {
    void load("");
    // The initial request intentionally ignores the empty mutable search field.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const columns: DataTableColumn<AuditEvent>[] = [
    {
      key: "occurredAt",
      header: text("Дата и время", "Date and time"),
      render: (event) => (
        <span className="app-text whitespace-nowrap font-bold">
          {formatAuditDate(event.occurredAt, locale)}
        </span>
      ),
    },
    {
      key: "actor",
      header: text("Кто", "Actor"),
      render: (event) => (
        <div className="min-w-[170px]">
          <p className="app-text font-black">{event.actorUsername}</p>
          <p className="app-muted mt-1 text-xs">
            {actorTypeLabel(event.actorAccountType, text)}
          </p>
        </div>
      ),
    },
    {
      key: "action",
      header: text("Действие", "Action"),
      render: (event) => (
        <span className="app-accent-soft app-accent-text inline-flex rounded-full border px-2.5 py-1 text-xs font-black">
          {actionLabel(event.action, text)}
        </span>
      ),
    },
    {
      key: "entity",
      header: text("Объект", "Object"),
      render: (event) => (
        <div className="min-w-[130px]">
          <p className="app-text font-bold">{entityLabel(event.entityType, text)}</p>
          {event.entityId !== null && (
            <p className="app-muted mt-1 text-xs">ID {event.entityId}</p>
          )}
        </div>
      ),
    },
    {
      key: "change",
      header: text("Изменение", "Change"),
      render: (event) => <ChangeSummary event={event} text={text} />,
    },
  ];

  const auditScope = session.permissionScopes["audit.view"];
  const description =
    auditScope === "enterprise"
      ? text(
          `Неизменяемая история действий, относящихся к предприятию «${session.enterpriseName || "текущее предприятие"}».`,
          `Immutable history of actions related to enterprise “${session.enterpriseName || "current enterprise"}”.`,
        )
      : auditScope === "department"
        ? text(
            `Неизменяемая история действий, относящихся к отделу «${session.departmentName || "текущий отдел"}».`,
            `Immutable history of actions related to department “${session.departmentName || "current department"}”.`,
          )
        : text(
            "Неизменяемая история кадровых, административных и системных операций.",
            "Immutable history of HR, administrative, and system operations.",
          );

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <ActionButton
            action="refresh"
            loading={isLoading}
            onClick={() => void load()}
          />
        }
        description={description}
        eyebrow={text("Администрирование", "Administration")}
        icon={<FiActivity />}
        title={text("Журнал действий", "Audit log")}
      />

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
              placeholder={text("Пользователь, действие, сущность или ID", "User, action, entity, or ID")}
              value={search}
            />
          </div>
          <ActionButton action="search" type="submit" />
          {search && (
            <ActionButton
              action="reset"
              onClick={() => {
                setSearch("");
                void load("");
              }}
              type="button"
            />
          )}
        </form>
      </section>

      <DataTable
        ariaLabel={text("Журнал действий", "Audit log")}
        columns={columns}
        emptyDescription={text("По выбранному запросу события не найдены.", "No events match the selected query.")}
        emptyTitle={text("Записей нет", "No records")}
        footer={
          <>
            {text("Записей:", "Records:")} <span className="app-text font-black">{events.length}</span>
          </>
        }
        getRowKey={(event) => event.id}
        isLoading={isLoading}
        loadingLabel={text("Загрузка журнала действий...", "Loading audit log...")}
        rows={events}
        showViewModeToggle={false}
        viewMode="table"
      />
    </div>
  );
}

function ChangeSummary({
  event,
  text,
}: {
  event: AuditEvent;
  text: (ru: string, en: string) => string;
}): JSX.Element {
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
        {changed.length > 0
          ? text(
              `Изменены поля: ${changed.slice(0, 6).join(", ")}`,
              `Changed fields: ${changed.slice(0, 6).join(", ")}`,
            )
          : text("Запись обновлена", "Record updated")}
      </p>
    );
  }
  return <span className="app-muted text-xs">—</span>;
}

function formatAuditDate(value: string, locale: string): string {
  const date = new Date(value.includes("T") ? value : `${value.replace(" ", "T")}Z`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(locale);
}

function actorTypeLabel(
  value: AuditEvent["actorAccountType"],
  text: (ru: string, en: string) => string,
): string {
  if (value === "system_admin") return text("Системный администратор", "System administrator");
  if (value === "employee_user") return text("Пользователь сотрудника", "Employee user");
  return text("Система", "System");
}

const actionLabels: Record<string, [string, string]> = {
  create: ["Создание", "Create"],
  update: ["Изменение", "Update"],
  delete: ["Удаление", "Delete"],
  login: ["Вход", "Sign in"],
  logout: ["Выход", "Sign out"],
  "password.change": ["Смена пароля", "Password change"],
  "employment.change": ["Кадровое изменение", "Employment change"],
  "employment.terminate": ["Увольнение", "Termination"],
  "employment.correct_hire_date": ["Исправление даты приёма", "Hire date correction"],
  "candidate.hire": ["Приём кандидата", "Candidate hire"],
  "vacancy.create": ["Создание вакансии", "Vacancy creation"],
  "vacancy.update": ["Изменение вакансии", "Vacancy update"],
  "vacancy.delete": ["Удаление вакансии", "Vacancy deletion"],
  "candidate.create": ["Создание кандидата", "Candidate creation"],
  "candidate.update": ["Изменение кандидата", "Candidate update"],
  "candidate.delete": ["Удаление кандидата", "Candidate deletion"],
  "access.role.create": ["Создание роли", "Role creation"],
  "access.role.update": ["Изменение роли", "Role update"],
  "access.role.delete": ["Удаление роли", "Role deletion"],
  "access.user.create": ["Создание пользователя", "User creation"],
  "access.user.update": ["Изменение пользователя", "User update"],
  "access.user.delete": ["Удаление пользователя", "User deletion"],
  "access.password.reset": ["Сброс пароля", "Password reset"],
  "backup.create": ["Резервная копия", "Backup"],
  "backup.restore": ["Восстановление", "Restore"],
  "export.employees_csv": ["Экспорт сотрудников", "Employee export"],
};

function actionLabel(
  value: string,
  text: (ru: string, en: string) => string,
): string {
  const label = actionLabels[value];
  return label ? text(label[0], label[1]) : value;
}

const entityLabels: Record<string, [string, string]> = {
  employees: ["Сотрудник", "Employee"],
  candidates: ["Кандидат", "Candidate"],
  vacancies: ["Вакансия", "Vacancy"],
  vacations: ["Отпуск", "Vacation"],
  vacation_types: ["Вид отпуска", "Vacation type"],
  enterprises: ["Предприятие", "Enterprise"],
  departments: ["Отдел", "Department"],
  positions: ["Должность", "Position"],
  roles: ["Роль", "Role"],
  users: ["Пользователь", "User"],
  auth: ["Авторизация", "Authentication"],
  system: ["Система", "System"],
};

function entityLabel(
  value: string,
  text: (ru: string, en: string) => string,
): string {
  const label = entityLabels[value];
  return label ? text(label[0], label[1]) : value;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback;
  const parts = error.message.split("Error: ");
  return parts[parts.length - 1] || fallback;
}
