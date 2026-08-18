import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiCalendar,
  FiEdit2,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiSettings,
  FiTrash2,
  FiUser,
} from "react-icons/fi";
import { useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";

import { useAuth } from "../features/auth/AuthContext";
import { HrEntityDeleteDialog } from "../features/hr-entities/components/HrEntityDeleteDialog";
import { HrEntityDialog } from "../features/hr-entities/components/HrEntityDialog";
import { HrEntityTable } from "../features/hr-table/HrEntityTable";
import { formatDate } from "../shared/lib/format";
import { hrApiClient } from "../shared/lib/hrApiClient";
import type { HrRecord } from "../shared/types/hr";
import {
  Button,
  EmptyState,
  Input,
  LoadingState,
  PageHeader,
  Select,
  type SelectOption,
} from "../shared/ui";

const statusOptions: SelectOption[] = [
  { value: "all", label: "Все статусы" },
  { value: "planned", label: "Запланирован" },
  { value: "approved", label: "Согласован" },
  { value: "rejected", label: "Отклонён" },
  { value: "completed", label: "Завершён" },
];

export function VacationsPage(): JSX.Element {
  const { hasPermission, session } = useAuth();
  const [searchParams] = useSearchParams();
  const employeeFilter = positiveId(searchParams.get("employee"));
  const canManage = hasPermission("vacations.manage");
  const canManageTypes =
    canManage && session.permissionScopes["vacations.manage"] === "global";

  const [records, setRecords] = useState<HrRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [editingRecord, setEditingRecord] = useState<HrRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<HrRecord | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [showTypes, setShowTypes] = useState(false);

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

  const filteredRecords = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("ru");
    return records.filter((record) => {
      if (status !== "all" && String(record.status) !== status) return false;
      if (!query) return true;
      return [
        record.employee_name,
        record.vacation_type_name,
        record.reason,
        statusLabel(record.status),
      ]
        .map((value) => String(value ?? "").toLocaleLowerCase("ru"))
        .some((value) => value.includes(query));
    });
  }, [records, search, status]);

  function openCreate(): void {
    setEditingRecord(null);
    setIsFormOpen(true);
  }

  function openEdit(record: HrRecord): void {
    setEditingRecord(record);
    setIsFormOpen(true);
  }

  function openDelete(record: HrRecord): void {
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
    if (!deleteTarget) return;
    await hrApiClient.delete({
      entity: "vacations",
      id: Number(deleteTarget.id),
    });
    setDeleteTarget(null);
    await loadData();
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

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <>
            {canManageTypes && (
              <Button
                leftIcon={<FiSettings className="h-4 w-4" />}
                onClick={() => setShowTypes((current) => !current)}
                style={{ background: "#ffffff", color: "#0f172a" }}
                variant="ghost"
              >
                Виды отпусков
              </Button>
            )}
            {canManage && (
              <Button
                leftIcon={<FiPlus className="h-4 w-4" />}
                onClick={openCreate}
                style={{ background: "#ffffff", color: "#0f172a" }}
                variant="ghost"
              >
                Оформить отпуск
              </Button>
            )}
          </>
        }
        title="Отпуска"
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

      {canManageTypes && showTypes && (
        <section className="space-y-3">
          <div>
            <h2 className="app-text text-xl font-black">Справочник видов отпусков</h2>
            <p className="app-muted mt-1 text-sm">
              Виды отпусков едины для всей системы. Неактивные варианты сохраняются в истории, но не должны использоваться для новых записей.
            </p>
          </div>
          <HrEntityTable entity="vacation_types" />
        </section>
      )}

      <section className="app-surface app-border overflow-hidden rounded-[28px] border">
        <div className="app-border-soft flex flex-col gap-3 border-b p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-md">
            <FiSearch className="app-muted pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2" />
            <Input
              className="pl-11"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Сотрудник, вид отпуска или основание"
              value={search}
            />
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Select
              onValueChange={setStatus}
              options={statusOptions}
              value={status}
            />
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
          </div>
        </div>

        {employeeFilter && (
          <div className="app-border-soft app-surface-muted border-b px-5 py-3 text-sm font-bold">
            Показаны отпуска выбранного сотрудника · {records.length}
          </div>
        )}

        {isLoading ? (
          <div className="p-12">
            <LoadingState label="Загрузка отпусков..." />
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="py-14">
            <EmptyState
              description={
                records.length === 0
                  ? "В доступной области данных пока нет записей об отпусках."
                  : "Измените строку поиска или выбранный статус."
              }
              title={records.length === 0 ? "Отпусков пока нет" : "Ничего не найдено"}
            />
          </div>
        ) : (
          <div className="grid gap-4 p-5 xl:grid-cols-2">
            {filteredRecords.map((record) => (
              <VacationCard
                canManage={canManage}
                key={String(record.id)}
                onDelete={() => openDelete(record)}
                onEdit={() => openEdit(record)}
                record={record}
              />
            ))}
          </div>
        )}
      </section>

      {canManage && (
        <>
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
          <HrEntityDeleteDialog
            onConfirm={deleteVacation}
            onOpenChange={(open) => {
              setIsDeleteOpen(open);
              if (!open) setDeleteTarget(null);
            }}
            open={isDeleteOpen}
          />
        </>
      )}
    </div>
  );
}

function VacationCard({
  canManage,
  onDelete,
  onEdit,
  record,
}: {
  canManage: boolean;
  onDelete: () => void;
  onEdit: () => void;
  record: HrRecord;
}): JSX.Element {
  const status = String(record.status ?? "planned");
  const canDelete = canManage && ["planned", "rejected"].includes(status);

  return (
    <article className="app-surface-muted app-border rounded-[24px] border p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={status} />
            <span className="app-surface app-border rounded-full border px-3 py-1 text-xs font-black">
              {Number(record.is_paid) === 1 ? "Оплачиваемый" : "Неоплачиваемый"}
            </span>
          </div>
          <h2 className="app-text mt-3 text-lg font-black">
            {String(record.employee_name ?? "Сотрудник")}
          </h2>
          <p className="app-accent-text mt-1 text-sm font-bold">
            {String(record.vacation_type_name ?? "Отпуск")}
          </p>
        </div>
        {canManage && (
          <div className="flex shrink-0 gap-2">
            <Button
              aria-label="Редактировать отпуск"
              className="h-9 w-9 p-0"
              onClick={onEdit}
              variant="ghost"
            >
              <FiEdit2 className="h-4 w-4" />
            </Button>
            {canDelete && (
              <Button
                aria-label="Удалить отпуск"
                className="h-9 w-9 p-0"
                onClick={onDelete}
                variant="ghost"
              >
                <FiTrash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <SmallMetric
          label="Период"
          value={`${formatDate(record.starts_at)} — ${formatDate(record.ends_at)}`}
        />
        <SmallMetric label="Дней" value={String(record.days_count ?? "—")} />
        <SmallMetric
          label="Согласование"
          value={record.approved_at ? formatDate(record.approved_at) : "—"}
        />
      </div>

      {(record.reason || record.approved_by_name) && (
        <div className="app-border-soft mt-4 space-y-2 border-t pt-4 text-sm">
          {record.approved_by_name && (
            <p className="app-text-soft">
              <span className="app-text font-black">Согласовал: </span>
              {String(record.approved_by_name)}
            </p>
          )}
          {record.reason && (
            <p className="app-text-soft">
              <span className="app-text font-black">Основание: </span>
              {String(record.reason)}
            </p>
          )}
        </div>
      )}
    </article>
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

function SmallMetric({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="app-surface app-border rounded-2xl border p-3">
      <p className="app-muted text-[11px] font-black uppercase tracking-wide">{label}</p>
      <p className="app-text mt-1 text-sm font-bold">{value}</p>
    </div>
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
