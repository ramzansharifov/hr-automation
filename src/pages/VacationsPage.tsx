import { useCallback, useEffect, useState } from "react";
import {
  FiCalendar,
  FiEdit2,
  FiPlus,
  FiRefreshCw,
  FiTrash2,
  FiUser,
} from "react-icons/fi";
import { useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";

import { useAuth } from "../features/auth/AuthContext";
import { HrEntityDeleteDialog } from "../features/hr-entities/components/HrEntityDeleteDialog";
import { HrEntityDialog } from "../features/hr-entities/components/HrEntityDialog";
import { getLeadershipRole } from "../shared/access/leadership";
import { formatDate } from "../shared/lib/format";
import { hrApiClient } from "../shared/lib/hrApiClient";
import type { HrRecord } from "../shared/types/hr";
import {
  Button,
  DataTable,
  IconButton,
  PageHeader,
  useStoredViewMode,
  type DataTableColumn,
} from "../shared/ui";

export function VacationsPage(): JSX.Element {
  const { hasPermission, session } = useAuth();
  const leadershipRole = getLeadershipRole(session.roles);
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
      toast.error(errorMessage(error, "Не удалось загрузить реестр отпусков"));
    } finally {
      setIsLoading(false);
    }
  }, [employeeFilter]);

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

  function renderActions(record: HrRecord): JSX.Element {
    const recordCanDelete = String(record.status ?? "planned") === "planned";
    return (
      <>
        {canOpenEditor && (
          <IconButton
            icon={<FiEdit2 />}
            label={canEdit && canApprove ? "Редактировать или согласовать отпуск" : canApprove ? "Согласовать отпуск" : "Редактировать отпуск"}
            onClick={() => openEdit(record)}
            size="sm"
          />
        )}
        {canDelete && recordCanDelete && (
          <IconButton
            icon={<FiTrash2 />}
            label="Удалить отпуск"
            onClick={() => openDelete(record)}
            size="sm"
            tone="danger"
          />
        )}
      </>
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
  const pageTitle =
    leadershipRole === "enterprise_director"
      ? "Отпуска предприятия"
      : leadershipRole === "department_head"
        ? "Отпуска отдела"
        : "Отпуска";
  const pageDescription =
    leadershipRole === "enterprise_director"
      ? `Отпуска сотрудников ${session.enterpriseName || "вашего предприятия"}. Данные автоматически ограничены предприятием, которым вы руководите.`
      : leadershipRole === "department_head"
        ? `Отпуска сотрудников ${session.departmentName || "вашего отдела"}. Данные автоматически ограничены вашим подразделением.`
        : "Оформление, согласование и контроль отпусков сотрудников.";

  const columns: DataTableColumn<HrRecord>[] = [
    {
      key: "employee",
      header: "Сотрудник",
      render: (record) => (
        <span className="app-text font-black">
          {String(record.employee_name ?? "Сотрудник")}
        </span>
      ),
    },
    {
      key: "type",
      header: "Вид отпуска",
      render: (record) => (
        <span className="app-accent-text font-bold">
          {String(record.vacation_type_name ?? "Отпуск")}
        </span>
      ),
    },
    {
      key: "period",
      header: "Период",
      render: (record) => (
        <span className="app-text-soft whitespace-nowrap">
          {formatDate(record.starts_at)} — {formatDate(record.ends_at)}
        </span>
      ),
    },
    {
      key: "days",
      header: "Дней",
      align: "center",
      render: (record) => (
        <span className="app-text font-black">{String(record.days_count ?? "—")}</span>
      ),
    },
    {
      key: "paid",
      header: "Оплата",
      render: (record) => (
        <span className="app-surface-muted app-border rounded-full border px-3 py-1 text-xs font-black">
          {Number(record.is_paid) === 1 ? "Оплачиваемый" : "Неоплачиваемый"}
        </span>
      ),
    },
    {
      key: "status",
      header: "Статус",
      render: (record) => <StatusBadge status={String(record.status ?? "planned")} />,
    },
    {
      key: "approval",
      header: "Согласование",
      render: (record) => (
        <div className="min-w-[150px]">
          <p className="app-text-soft text-sm font-semibold">
            {record.approved_by_name ? String(record.approved_by_name) : "—"}
          </p>
          <p className="app-muted mt-1 text-xs">
            {record.approved_at ? formatDate(record.approved_at) : "Не согласован"}
          </p>
        </div>
      ),
    },
    ...(hasActions
      ? [
          {
            key: "actions",
            header: "Действия",
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
            <Button
              leftIcon={<FiPlus className="h-4 w-4" />}
              onClick={openCreate}
              style={{ background: "#ffffff", color: "#0f172a" }}
              variant="ghost"
            >
              Оформить отпуск
            </Button>
          ) : undefined
        }
        title={pageTitle}
      />

      <section className="grid gap-4 sm:grid-cols-3">
        <MetricCard icon={<FiCalendar />} label="Всего записей" value={records.length} />
        <MetricCard icon={<FiUser />} label="Ожидают решения" value={plannedCount} />
        <MetricCard
          icon={<FiCalendar />}
          label="Согласованы / впереди"
          value={`${approvedCount} / ${upcomingCount}`}
        />
      </section>

      <DataTable
        ariaLabel="Реестр отпусков"
        card={{
          leading: () => <FiCalendar className="h-5 w-5" />,
          title: (record) => String(record.employee_name ?? "Сотрудник"),
          meta: (record) => (
            <>
              <span className="app-text-soft">
                <span className="app-muted">Вид: </span>
                {String(record.vacation_type_name ?? "Отпуск")}
              </span>
              <span className="app-text-soft">
                <span className="app-muted">Период: </span>
                {formatDate(record.starts_at)} — {formatDate(record.ends_at)}
              </span>
              <span className="app-text-soft">
                <span className="app-muted">Дней: </span>
                {String(record.days_count ?? "—")}
              </span>
              <StatusBadge status={String(record.status ?? "planned")} />
            </>
          ),
          actions: hasActions ? (record) => renderActions(record) : undefined,
        }}
        columns={columns}
        emptyDescription="В доступной области данных пока нет записей об отпусках."
        emptyTitle="Отпусков пока нет"
        footer={
          <>
            Всего: <span className="app-text font-black">{records.length}</span>
          </>
        }
        getRowKey={(record) => String(record.id)}
        isLoading={isLoading}
        loadingLabel="Загрузка отпусков..."
        notice={
          employeeFilter
            ? `Показаны отпуска выбранного сотрудника · ${records.length}`
            : undefined
        }
        onViewModeChange={setViewMode}
        rows={records}
        toolbar={
          <Button
            leftIcon={
              <FiRefreshCw
                className={isLoading ? "h-4 w-4 animate-spin" : "h-4 w-4"}
              />
            }
            onClick={() => void loadData()}
            variant="secondary"
          >
            Обновить
          </Button>
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
      {statusLabel(status)}
    </span>
  );
}

function statusLabel(value: unknown): string {
  const labels: Record<string, string> = {
    planned: "Запланирован",
    approved: "Согласован",
    rejected: "Отклонён",
    completed: "Завершён",
  };
  return labels[String(value ?? "")] ?? String(value ?? "—");
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
