import { useCallback, useEffect, useState } from "react";
import {
  FiCalendar,
  FiEdit2,
  FiExternalLink,
  FiPlus,
  FiTrash2,
} from "react-icons/fi";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";

import { formatDate, humanizeStatus } from "../../../shared/lib/format";
import { hrApiClient } from "../../../shared/lib/hrApiClient";
import type { HrRecord } from "../../../shared/types/hr";
import { Button, EmptyState, LoadingState } from "../../../shared/ui";
import { HrEntityDeleteDialog } from "../../hr-entities/components/HrEntityDeleteDialog";
import { HrEntityDialog } from "../../hr-entities/components/HrEntityDialog";

interface EmployeeOperationalPanelProps {
  canManage: boolean;
  employeeId: number;
  locale: string;
}

interface RecordActions {
  onDelete: () => void;
  onEdit: () => void;
}

const hiddenEmployeeFieldNames = ["employee_id"];

export function EmployeeVacationsPanel({
  canManage,
  employeeId,
  locale,
}: EmployeeOperationalPanelProps): JSX.Element {
  const { t } = useTranslation();
  const [records, setRecords] = useState<HrRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [editingRecord, setEditingRecord] = useState<HrRecord | null>(null);
  const [deletingRecord, setDeletingRecord] = useState<HrRecord | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const loadRecords = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      setRecords(await loadEmployeeVacations(employeeId));
    } catch (error) {
      toast.error(getErrorMessage(error, "Не удалось загрузить отпуска сотрудника"));
    } finally {
      setIsLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  function openCreate(): void {
    if (!canManage) return;
    setDialogMode("create");
    setEditingRecord(null);
    setIsFormOpen(true);
  }

  function openEdit(record: HrRecord): void {
    if (!canManage) return;
    setDialogMode("edit");
    setEditingRecord(record);
    setIsFormOpen(true);
  }

  function openDelete(record: HrRecord): void {
    if (!canManage) return;
    setDeletingRecord(record);
    setIsDeleteOpen(true);
  }

  async function saveRecord(data: HrRecord): Promise<void> {
    const employeeRecord = { ...data, employee_id: employeeId };
    if (dialogMode === "create") {
      await hrApiClient.create({ entity: "vacations", data: employeeRecord });
    } else {
      await hrApiClient.update({
        entity: "vacations",
        id: getRecordId(editingRecord),
        data: employeeRecord,
      });
    }
    await loadRecords();
  }

  async function deleteRecord(): Promise<void> {
    await hrApiClient.delete({
      entity: "vacations",
      id: getRecordId(deletingRecord),
    });
    setDeletingRecord(null);
    await loadRecords();
  }

  return (
    <div className="space-y-5">
      <section className="app-surface-muted app-border rounded-[24px] border p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <span className="app-accent-soft flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border">
              <FiCalendar className="h-6 w-6" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="app-text text-xl font-black">Отпуска сотрудника</h2>
                <span className="app-accent-soft rounded-full border px-2.5 py-1 text-xs font-black">
                  {records.length}
                </span>
              </div>
              <p className="app-muted mt-2 max-w-3xl text-sm font-medium">
                Персональная история отпусков: вид, период, статус, оплачиваемость и лицо, согласовавшее отпуск.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              className="app-button-secondary inline-flex h-11 items-center justify-center gap-2 rounded-2xl border px-4 text-sm font-bold transition"
              to={`/filters?module=vacations&employee=${employeeId}`}
            >
              <FiExternalLink className="h-4 w-4" />
              Открыть общий реестр
            </Link>
            {canManage && (
              <Button leftIcon={<FiPlus className="h-4 w-4" />} onClick={openCreate}>
                Оформить отпуск
              </Button>
            )}
          </div>
        </div>
      </section>

      {isLoading ? (
        <LoadingState label="Загрузка отпусков..." />
      ) : records.length === 0 ? (
        <EmptyState
          title="У сотрудника пока нет отпусков"
          description={
            canManage
              ? "Оформите первый отпуск сотрудника или откройте общий реестр отпусков."
              : "Записи об отпусках пока отсутствуют."
          }
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {records.map((record) => (
            <VacationCard
              actions={
                canManage
                  ? {
                      onDelete: () => openDelete(record),
                      onEdit: () => openEdit(record),
                    }
                  : undefined
              }
              key={String(record.id)}
              locale={locale}
              record={record}
              statusLabel={humanizeVacationStatus(record.status, t)}
            />
          ))}
        </div>
      )}

      {canManage && (
        <>
          <HrEntityDialog
            entity="vacations"
            hiddenFieldNames={hiddenEmployeeFieldNames}
            initialRecord={
              dialogMode === "edit"
                ? editingRecord
                : { employee_id: employeeId, status: "planned", is_paid: 1 }
            }
            mode={dialogMode}
            onOpenChange={(open) => {
              setIsFormOpen(open);
              if (!open) setEditingRecord(null);
            }}
            onSubmit={saveRecord}
            open={isFormOpen}
          />

          <HrEntityDeleteDialog
            onConfirm={deleteRecord}
            onOpenChange={(open) => {
              setIsDeleteOpen(open);
              if (!open) setDeletingRecord(null);
            }}
            open={isDeleteOpen}
          />
        </>
      )}
    </div>
  );
}

function VacationCard({
  actions,
  locale,
  record,
  statusLabel,
}: {
  actions?: RecordActions;
  locale: string;
  record: HrRecord;
  statusLabel: string;
}): JSX.Element {
  return (
    <article className="app-surface app-border rounded-[24px] border p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="app-accent-soft rounded-full border px-3 py-1 text-xs font-black">
              {statusLabel}
            </span>
            <span className="app-surface-muted app-border rounded-full border px-3 py-1 text-xs font-bold">
              {Number(record.is_paid) === 1 ? "Оплачиваемый" : "Неоплачиваемый"}
            </span>
          </div>
          <h3 className="app-text mt-3 text-lg font-black">
            {getString(record.vacation_type_name) || "Отпуск"}
          </h3>
          <p className="app-muted mt-2 text-sm font-semibold">
            {formatDate(record.starts_at, locale)} — {formatDate(record.ends_at, locale)}
          </p>
        </div>
        {actions && <RecordActionsButtons actions={actions} />}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <RecordMetric label="Дней" value={getString(record.days_count) || "—"} />
        <RecordMetric
          label="Дата согласования"
          value={record.approved_at ? formatDate(record.approved_at, locale) : "—"}
        />
      </div>

      {Boolean(record.approved_by_name || record.reason) && (
        <div className="app-border-soft mt-5 grid gap-3 border-t pt-4 text-sm">
          {Boolean(record.approved_by_name) && (
            <p className="app-text-soft">
              <span className="app-text font-black">Согласовал: </span>
              {getString(record.approved_by_name)}
            </p>
          )}
          {Boolean(record.reason) && (
            <p className="app-text-soft">
              <span className="app-text font-black">Основание: </span>
              {getString(record.reason)}
            </p>
          )}
        </div>
      )}
    </article>
  );
}

function RecordActionsButtons({ actions }: { actions: RecordActions }): JSX.Element {
  return (
    <div className="flex shrink-0 gap-2">
      <Button aria-label="Редактировать отпуск" className="h-10 w-10 p-0" onClick={actions.onEdit} type="button" variant="ghost">
        <FiEdit2 className="h-4 w-4" />
      </Button>
      <Button aria-label="Удалить отпуск" className="h-10 w-10 p-0" onClick={actions.onDelete} type="button" variant="ghost">
        <FiTrash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

function RecordMetric({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="app-surface-muted app-border rounded-2xl border p-4">
      <p className="app-muted text-xs font-bold uppercase tracking-wide">{label}</p>
      <p className="app-text mt-1 text-base font-black">{value}</p>
    </div>
  );
}

async function loadEmployeeVacations(employeeId: number): Promise<HrRecord[]> {
  const records: HrRecord[] = [];
  let page = 1;
  let totalPages = 1;
  do {
    const result = await hrApiClient.list({
      entity: "vacations",
      page,
      pageSize: 100,
      filters: { employee_id: { operator: "equals", value: employeeId } },
      orderBy: "starts_at",
      orderDirection: "desc",
    });
    records.push(...result.items);
    totalPages = Math.max(result.totalPages, 1);
    page += 1;
  } while (page <= totalPages);
  return records;
}

function getRecordId(record: HrRecord | null): number {
  const id = Number(record?.id);
  if (!Number.isFinite(id)) throw new Error("Не удалось определить запись отпуска");
  return id;
}

function getString(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

function humanizeVacationStatus(value: unknown, t: (key: string) => string): string {
  const labels: Record<string, string> = {
    planned: "Запланирован",
    approved: "Согласован",
    rejected: "Отклонён",
    completed: "Завершён",
  };
  return labels[String(value ?? "")] ?? humanizeStatus(value, t);
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback;
  const parts = error.message.split("Error: ");
  return parts[parts.length - 1] || fallback;
}
