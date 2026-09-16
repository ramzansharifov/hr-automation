import { useCallback, useEffect, useState } from "react";
import { FiCalendar } from "react-icons/fi";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";

import { appText, useAppText } from "../../../shared/i18n";
import { formatDate, humanizeStatus } from "../../../shared/lib/format";
import { hrApiClient } from "../../../shared/lib/hrApiClient";
import type { HrRecord } from "../../../shared/types/hr";
import {
  ActionButton,
  ActionLink,
  EmptyState,
  LoadingState,
  RecordActions,
} from "../../../shared/ui";
import { HrEntityDeleteDialog } from "../../hr-entities/components/HrEntityDeleteDialog";
import { HrEntityDialog } from "../../hr-entities/components/HrEntityDialog";

interface EmployeeOperationalPanelProps {
  canCreate: boolean;
  canDelete: boolean;
  canEdit: boolean;
  employeeId: number;
  locale: string;
  onBeforeAction?: (record?: HrRecord | null) => Promise<void>;
}

interface VacationCardActions {
  onDelete?: () => void;
  onEdit?: () => void;
}

const hiddenEmployeeFieldNames = ["employee_id"];

export function EmployeeVacationsPanel({
  canCreate,
  canDelete,
  canEdit,
  employeeId,
  locale,
  onBeforeAction,
}: EmployeeOperationalPanelProps): JSX.Element {
  const text = useAppText();
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
      setRecords(await hrApiClient.listEmployeeVacations(employeeId));
    } catch (error) {
      toast.error(getErrorMessage(error, text("Не удалось загрузить отпуска сотрудника", "Failed to load employee vacations")), {
        toastId: `employee-vacations-load-${employeeId}`,
      });
    } finally {
      setIsLoading(false);
    }
  }, [employeeId, text]);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  async function openCreate(): Promise<void> {
    if (!canCreate) return;
    try {
      await onBeforeAction?.(null);
      setDialogMode("create");
      setEditingRecord(null);
      setIsFormOpen(true);
    } catch (error) {
      toast.error(getErrorMessage(error, text("Не удалось подготовить рабочую область", "Failed to prepare workspace")), {
        toastId: `employee-vacations-workspace-${employeeId}`,
      });
    }
  }

  async function openEdit(record: HrRecord): Promise<void> {
    if (!canEdit) return;
    try {
      await onBeforeAction?.(record);
      setDialogMode("edit");
      setEditingRecord(record);
      setIsFormOpen(true);
    } catch (error) {
      toast.error(getErrorMessage(error, text("Не удалось подготовить рабочую область", "Failed to prepare workspace")), {
        toastId: `employee-vacations-workspace-${employeeId}`,
      });
    }
  }

  function openDelete(record: HrRecord): void {
    if (!canDelete || !canDeleteVacation(record)) return;
    setDeletingRecord(record);
    setIsDeleteOpen(true);
  }

  async function saveRecord(data: HrRecord): Promise<void> {
    await onBeforeAction?.(editingRecord);
    const employeeRecord = { ...data, employee_id: employeeId };
    if (dialogMode === "create") {
      if (!canCreate) return;
      await hrApiClient.create({ entity: "vacations", data: employeeRecord });
    } else {
      if (!canEdit) return;
      await hrApiClient.update({
        entity: "vacations",
        id: getRecordId(editingRecord),
        data: employeeRecord,
      });
    }
    await loadRecords();
  }

  async function deleteRecord(): Promise<void> {
    if (!canDelete) return;
    await onBeforeAction?.(deletingRecord);
    await hrApiClient.delete({
      entity: "vacations",
      id: getRecordId(deletingRecord),
    });
    setDeletingRecord(null);
    await loadRecords();
  }

  const hasActions = canEdit || canDelete;

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
                <h2 className="app-text text-xl font-black">{text("Отпуска сотрудника", "Employee vacations")}</h2>
                <span className="app-accent-soft rounded-full border px-2.5 py-1 text-xs font-black">
                  {records.length}
                </span>
              </div>
              <p className="app-muted mt-2 max-w-3xl text-sm font-medium">
                {text("Персональная история отпусков: вид, период, статус, оплачиваемость и лицо, согласовавшее отпуск.", "Personal vacation history: type, period, status, payment, and approver.")}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <ActionLink
              action="open"
              to={`/vacations?employee=${employeeId}`}
            >
              {text("Открыть общий реестр", "Open full registry")}
            </ActionLink>
            {canCreate && (
              <ActionButton action="create" onClick={() => void openCreate()}>
                {text("Оформить отпуск", "Create vacation")}
              </ActionButton>
            )}
          </div>
        </div>
      </section>

      {isLoading ? (
        <LoadingState label={text("Загрузка отпусков...", "Loading vacations...")} />
      ) : records.length === 0 ? (
        <EmptyState
          title={text("У сотрудника пока нет отпусков", "Employee has no vacations yet")}
          description={
            canCreate
              ? text("Оформите первый отпуск сотрудника или откройте общий реестр отпусков.", "Create the employee’s first vacation or open the full vacation registry.")
              : text("Записи об отпусках пока отсутствуют.", "There are no vacation records yet.")
          }
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {records.map((record) => (
            <VacationCard
              actions={
                hasActions
                  ? {
                      onDelete:
                        canDelete && canDeleteVacation(record)
                          ? () => openDelete(record)
                          : undefined,
                      onEdit: canEdit ? () => void openEdit(record) : undefined,
                    }
                  : undefined
              }
              key={String(record.id)}
              locale={locale}
              record={record}
              statusLabel={humanizeVacationStatus(record.status, t)}
              text={text}
            />
          ))}
        </div>
      )}

      {(canCreate || canEdit) && (
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
      )}

      {canDelete && (
        <HrEntityDeleteDialog
          onConfirm={deleteRecord}
          onOpenChange={(open) => {
            setIsDeleteOpen(open);
            if (!open) setDeletingRecord(null);
          }}
          open={isDeleteOpen}
        />
      )}
    </div>
  );
}

function VacationCard({
  actions,
  locale,
  record,
  statusLabel,
  text,
}: {
  actions?: VacationCardActions;
  locale: string;
  record: HrRecord;
  statusLabel: string;
  text: (ru: string, en: string) => string;
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
              {Number(record.is_paid) === 1 ? text("Оплачиваемый", "Paid") : text("Неоплачиваемый", "Unpaid")}
            </span>
          </div>
          <h3 className="app-text mt-3 text-lg font-black">
            {getString(record.vacation_type_name) || text("Отпуск", "Vacation")}
          </h3>
          <p className="app-muted mt-2 text-sm font-semibold">
            {formatDate(record.starts_at, locale)} — {formatDate(record.ends_at, locale)}
          </p>
        </div>
        {actions && (
          <RecordActions
            className="shrink-0"
            deleteLabel={text("Удалить отпуск", "Delete vacation")}
            editLabel={text("Редактировать отпуск", "Edit vacation")}
            onDelete={actions.onDelete}
            onEdit={actions.onEdit}
            size="md"
          />
        )}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <RecordMetric label={text("Дней", "Days")} value={getString(record.days_count) || "—"} />
        <RecordMetric
          label={text("Дата согласования", "Approval date")}
          value={record.approved_at ? formatDate(record.approved_at, locale) : "—"}
        />
      </div>

      {Boolean(record.approved_by_name || record.reason) && (
        <div className="app-border-soft mt-5 grid gap-3 border-t pt-4 text-sm">
          {Boolean(record.approved_by_name) && (
            <p className="app-text-soft">
              <span className="app-text font-black">{text("Согласовал:", "Approved by:")} </span>
              {getString(record.approved_by_name)}
            </p>
          )}
          {Boolean(record.reason) && (
            <p className="app-text-soft">
              <span className="app-text font-black">{text("Основание:", "Reason:")} </span>
              {getString(record.reason)}
            </p>
          )}
        </div>
      )}
    </article>
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

function canDeleteVacation(record: HrRecord): boolean {
  return String(record.status ?? "planned") === "planned";
}

function getRecordId(record: HrRecord | null): number {
  const id = Number(record?.id);
  if (!Number.isFinite(id)) throw new Error(appText("Не удалось определить запись отпуска", "Unable to identify vacation record"));
  return id;
}

function getString(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

function humanizeVacationStatus(value: unknown, t: (key: string) => string): string {
  const labels: Record<string, [string, string]> = {
    planned: ["Запланирован", "Planned"],
    approved: ["Согласован", "Approved"],
    rejected: ["Отклонён", "Rejected"],
    completed: ["Завершён", "Completed"],
  };
  const label = labels[String(value ?? "")];
  return label ? appText(label[0], label[1]) : humanizeStatus(value, t);
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback;
  const parts = error.message.split("Error: ");
  return parts[parts.length - 1] || fallback;
}
