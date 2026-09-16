import { useCallback, useEffect, useState } from "react";
import { FiCalendar, FiUser } from "react-icons/fi";
import { useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";

import { useAuth } from "../features/auth/AuthContext";
import { HrEntityDeleteDialog } from "../features/hr-entities/components/HrEntityDeleteDialog";
import { HrEntityDialog } from "../features/hr-entities/components/HrEntityDialog";
import { getLeadershipRole } from "../shared/access/leadership";
import { getScopedAdminRole } from "../shared/access/scopedAdmin";
import { useAppLocale, useAppText } from "../shared/i18n";
import { formatDate } from "../shared/lib/format";
import { hrApiClient } from "../shared/lib/hrApiClient";
import type { HrRecord } from "../shared/types/hr";
import {
  ActionButton,
  DataTable,
  PageHeader,
  RecordActions,
  useStoredViewMode,
  type DataTableColumn,
} from "../shared/ui";

export function VacationsPage(): JSX.Element {
  const text = useAppText();
  const locale = useAppLocale();
  const { hasPermission, session } = useAuth();
  const leadershipRole = getLeadershipRole(session.roles);
  const scopedAdminRole = getScopedAdminRole(session.roles);
  const [searchParams] = useSearchParams();
  const employeeFilter = positiveId(searchParams.get("employee"));
  const canCreate = hasPermission("vacations.create");
  const canEdit = hasPermission("vacations.edit");
  const canDelete = hasPermission("vacations.delete");
  const canApprove = hasPermission("vacations.approve");
  const canOpenEditor = canEdit || canApprove;
  const [viewMode, setViewMode] = useStoredViewMode("vacations");

  const [records, setRecords] = useState<HrRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingRecord, setEditingRecord] = useState<HrRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<HrRecord | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const loadData = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      const loaded: HrRecord[] = [];
      let page = 1;
      let totalPages = 1;
      do {
        const result = await hrApiClient.list({
          entity: "vacations",
          page,
          pageSize: 100,
          filters: employeeFilter
            ? { employee_id: { operator: "equals", value: employeeFilter } }
            : undefined,
          orderBy: "starts_at",
          orderDirection: "desc",
        });
        loaded.push(...result.items);
        totalPages = Math.max(result.totalPages, 1);
        page += 1;
      } while (page <= totalPages);
      setRecords(loaded);
    } catch (error) {
      toast.error(errorMessage(error, text("Не удалось загрузить реестр отпусков", "Failed to load vacation registry")));
    } finally {
      setIsLoading(false);
    }
  }, [employeeFilter, text]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  function openCreate(): void {
    if (!canCreate) return;
    setEditingRecord(null);
    setIsFormOpen(true);
  }

  function openEdit(record: HrRecord): void {
    if (!canOpenEditor) return;
    setEditingRecord(record);
    setIsFormOpen(true);
  }

  function openDelete(record: HrRecord): void {
    if (!canDelete) return;
    setDeleteTarget(record);
    setIsDeleteOpen(true);
  }

  async function saveVacation(data: HrRecord): Promise<void> {
    if (editingRecord) {
      await hrApiClient.update({
        entity: "vacations",
        id: Number(editingRecord.id),
        data,
      });
    } else {
      await hrApiClient.create({ entity: "vacations", data });
    }
    await loadData();
  }

  async function deleteVacation(): Promise<void> {
    if (!deleteTarget || !canDelete) return;
    await hrApiClient.delete({
      entity: "vacations",
      id: Number(deleteTarget.id),
    });
    setDeleteTarget(null);
    await loadData();
  }

  function renderActions(record: HrRecord): JSX.Element | null {
    const recordCanDelete = String(record.status ?? "planned") === "planned";
    const editLabel =
      canEdit && canApprove
        ? text("Редактировать или согласовать отпуск", "Edit or approve vacation")
        : canApprove
          ? text("Согласовать отпуск", "Approve vacation")
          : text("Редактировать отпуск", "Edit vacation");

    return (
      <RecordActions
        deleteLabel={text("Удалить отпуск", "Delete vacation")}
        editLabel={editLabel}
        onDelete={
          canDelete && recordCanDelete ? () => openDelete(record) : undefined
        }
        onEdit={canOpenEditor ? () => openEdit(record) : undefined}
      />
    );
  }

  const plannedCount = records.filter((record) => record.status === "planned").length;
  const approvedCount = records.filter((record) => record.status === "approved").length;
  const upcomingCount = records.filter((record) => {
    const startsAt = String(record.starts_at ?? "");
    return (
      ["planned", "approved"].includes(String(record.status)) &&
      startsAt >= todayIso()
    );
  }).length;
  const hasActions = canOpenEditor || canDelete;
  const hasEnterpriseScope =
    leadershipRole === "enterprise_director" || scopedAdminRole === "enterprise_admin";
  const hasDepartmentScope =
    leadershipRole === "department_head" || scopedAdminRole === "department_admin";
  const pageTitle = hasEnterpriseScope
    ? text("Отпуска предприятия", "Enterprise vacations")
    : hasDepartmentScope
      ? text("Отпуска отдела", "Department vacations")
      : text("Отпуска", "Vacations");
  const pageDescription =
    leadershipRole === "enterprise_director"
      ? text(
          `Отпуска сотрудников ${session.enterpriseName || "вашего предприятия"}. Данные автоматически ограничены предприятием, которым вы руководите.`,
          `Employee vacations for ${session.enterpriseName || "your enterprise"}. Data is automatically limited to the enterprise you lead.`,
        )
      : leadershipRole === "department_head"
        ? text(
            `Отпуска сотрудников ${session.departmentName || "вашего отдела"}. Данные автоматически ограничены вашим подразделением.`,
            `Employee vacations for ${session.departmentName || "your department"}. Data is automatically limited to your department.`,
          )
        : scopedAdminRole === "enterprise_admin"
          ? text(
              `Оформление, согласование и контроль отпусков ${session.enterpriseName || "вашего предприятия"}. Все операции автоматически ограничены этим предприятием.`,
              `Create, approve, and manage vacations for ${session.enterpriseName || "your enterprise"}. All operations are automatically limited to this enterprise.`,
            )
          : scopedAdminRole === "department_admin"
            ? text(
                `Оформление, согласование и контроль отпусков ${session.departmentName || "вашего отдела"}. Все операции автоматически ограничены этим подразделением.`,
                `Create, approve, and manage vacations for ${session.departmentName || "your department"}. All operations are automatically limited to this department.`,
              )
            : text(
                "Оформление, согласование и контроль отпусков сотрудников.",
                "Create, approve, and manage employee vacations.",
              );

  const columns: DataTableColumn<HrRecord>[] = [
    {
      key: "employee",
      header: text("Сотрудник", "Employee"),
      render: (record) => (
        <span className="app-text font-black">
          {String(record.employee_name ?? text("Сотрудник", "Employee"))}
        </span>
      ),
    },
    {
      key: "type",
      header: text("Вид отпуска", "Vacation type"),
      render: (record) => (
        <span className="app-accent-text font-bold">
          {String(record.vacation_type_name ?? text("Отпуск", "Vacation"))}
        </span>
      ),
    },
    {
      key: "period",
      header: text("Период", "Period"),
      render: (record) => (
        <span className="app-text-soft whitespace-nowrap">
          {formatDate(record.starts_at, locale)} — {formatDate(record.ends_at, locale)}
        </span>
      ),
    },
    {
      key: "days",
      header: text("Дней", "Days"),
      align: "center",
      render: (record) => (
        <span className="app-text font-black">{String(record.days_count ?? "—")}</span>
      ),
    },
    {
      key: "paid",
      header: text("Оплата", "Payment"),
      render: (record) => (
        <span className="app-surface-muted app-border rounded-full border px-3 py-1 text-xs font-black">
          {Number(record.is_paid) === 1 ? text("Оплачиваемый", "Paid") : text("Неоплачиваемый", "Unpaid")}
        </span>
      ),
    },
    {
      key: "status",
      header: text("Статус", "Status"),
      render: (record) => <StatusBadge status={String(record.status ?? "planned")} />,
    },
    {
      key: "approval",
      header: text("Согласование", "Approval"),
      render: (record) => (
        <div className="min-w-[150px]">
          <p className="app-text-soft text-sm font-semibold">
            {record.approved_by_name ? String(record.approved_by_name) : "—"}
          </p>
          <p className="app-muted mt-1 text-xs">
            {record.approved_at ? formatDate(record.approved_at, locale) : text("Не согласован", "Not approved")}
          </p>
        </div>
      ),
    },
    ...(hasActions
      ? [
          {
            key: "actions",
            header: text("Действия", "Actions"),
            align: "center" as const,
            render: (record: HrRecord) => (
              <div className="flex items-center justify-center gap-2">
                {renderActions(record)}
              </div>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        description={pageDescription}
        icon={<FiCalendar />}
        actions={
          canCreate ? (
            <ActionButton action="create" onClick={openCreate}>
              {text("Оформить отпуск", "Create vacation")}
            </ActionButton>
          ) : undefined
        }
        title={pageTitle}
      />

      <section className="grid gap-4 sm:grid-cols-3">
        <MetricCard icon={<FiCalendar />} label={text("Всего записей", "Total records")} value={records.length} />
        <MetricCard icon={<FiUser />} label={text("Ожидают решения", "Awaiting decision")} value={plannedCount} />
        <MetricCard
          icon={<FiCalendar />}
          label={text("Согласованы / впереди", "Approved / upcoming")}
          value={`${approvedCount} / ${upcomingCount}`}
        />
      </section>

      <DataTable
        ariaLabel={text("Реестр отпусков", "Vacation registry")}
        card={{
          leading: () => <FiCalendar className="h-5 w-5" />,
          title: (record) => String(record.employee_name ?? text("Сотрудник", "Employee")),
          meta: (record) => (
            <>
              <span className="app-text-soft">
                <span className="app-muted">{text("Вид:", "Type:")} </span>
                {String(record.vacation_type_name ?? text("Отпуск", "Vacation"))}
              </span>
              <span className="app-text-soft">
                <span className="app-muted">{text("Период:", "Period:")} </span>
                {formatDate(record.starts_at, locale)} — {formatDate(record.ends_at, locale)}
              </span>
              <span className="app-text-soft">
                <span className="app-muted">{text("Дней:", "Days:")} </span>
                {String(record.days_count ?? "—")}
              </span>
              <StatusBadge status={String(record.status ?? "planned")} />
            </>
          ),
          actions: hasActions ? (record) => renderActions(record) : undefined,
        }}
        columns={columns}
        emptyDescription={text("В доступной области данных пока нет записей об отпусках.", "There are no vacation records in the available data scope yet.")}
        emptyTitle={text("Отпусков пока нет", "No vacations yet")}
        footer={
          <>
            {text("Всего:", "Total:")} <span className="app-text font-black">{records.length}</span>
          </>
        }
        getRowKey={(record) => String(record.id)}
        isLoading={isLoading}
        loadingLabel={text("Загрузка отпусков...", "Loading vacations...")}
        notice={
          employeeFilter
            ? text(`Показаны отпуска выбранного сотрудника · ${records.length}`, `Showing vacations for the selected employee · ${records.length}`)
            : undefined
        }
        onViewModeChange={setViewMode}
        rows={records}
        toolbar={
          <ActionButton
            action="refresh"
            loading={isLoading}
            onClick={() => void loadData()}
          />
        }
        viewMode={viewMode}
      />

      {(canCreate || canOpenEditor) && (
        <HrEntityDialog
          entity="vacations"
          initialRecord={
            editingRecord ??
            (employeeFilter
              ? { employee_id: employeeFilter, status: "planned", is_paid: 1 }
              : { status: "planned", is_paid: 1 })
          }
          mode={editingRecord ? "edit" : "create"}
          onOpenChange={(open) => {
            setIsFormOpen(open);
            if (!open) setEditingRecord(null);
          }}
          onSubmit={saveVacation}
          open={isFormOpen}
        />
      )}
      {canDelete && (
        <HrEntityDeleteDialog
          onConfirm={deleteVacation}
          onOpenChange={(open) => {
            setIsDeleteOpen(open);
            if (!open) setDeleteTarget(null);
          }}
          open={isDeleteOpen}
        />
      )}
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
}: {
  icon: JSX.Element;
  label: string;
  value: number | string;
}): JSX.Element {
  return (
    <article className="app-surface app-border rounded-[24px] border p-5">
      <div className="flex items-center gap-3">
        <span className="app-accent-soft flex h-10 w-10 items-center justify-center rounded-xl border">
          {icon}
        </span>
        <div>
          <p className="app-muted text-xs font-black uppercase tracking-wide">{label}</p>
          <p className="app-text mt-1 text-2xl font-black">{value}</p>
        </div>
      </div>
    </article>
  );
}

function StatusBadge({ status }: { status: string }): JSX.Element {
  const className =
    status === "approved"
      ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-600"
      : status === "rejected"
        ? "border-rose-500/25 bg-rose-500/10 text-rose-600"
        : status === "completed"
          ? "app-surface app-border app-text-soft"
          : "border-amber-500/25 bg-amber-500/10 text-amber-600";
  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-black ${className}`}>
      {statusLabel(status, text)}
    </span>
  );
}

function statusLabel(
  value: unknown,
  text: (ru: string, en: string) => string,
): string {
  const labels: Record<string, [string, string]> = {
    planned: ["Запланирован", "Planned"],
    approved: ["Согласован", "Approved"],
    rejected: ["Отклонён", "Rejected"],
    completed: ["Завершён", "Completed"],
  };
  const label = labels[String(value ?? "")];
  return label ? text(label[0], label[1]) : String(value ?? "—");
}

function positiveId(value: string | null): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function errorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback;
  const parts = error.message.split("Error: ");
  return parts[parts.length - 1] || fallback;
}
