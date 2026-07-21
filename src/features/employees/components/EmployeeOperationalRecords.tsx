import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  FiCalendar,
  FiCreditCard,
  FiEdit2,
  FiExternalLink,
  FiPlus,
  FiTrash2,
} from "react-icons/fi";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";

import { formatCurrency, formatDate, humanizeStatus } from "../../../shared/lib/format";
import { hrApiClient } from "../../../shared/lib/hrApiClient";
import type { HrEntityKey, HrRecord } from "../../../shared/types/hr";
import { Button, EmptyState, LoadingState } from "../../../shared/ui";
import { HrEntityDeleteDialog } from "../../hr-entities/components/HrEntityDeleteDialog";
import { HrEntityDialog } from "../../hr-entities/components/HrEntityDialog";

interface EmployeeOperationalPanelProps {
  employeeId: number;
  locale: string;
}

interface EmployeePayrollPanelProps extends EmployeeOperationalPanelProps {
  baseSalary: unknown;
}

type OperationalEntity = Extract<HrEntityKey, "vacations" | "payroll">;

interface EmployeeRecordPanelProps {
  createInitialRecord: HrRecord;
  description: string;
  employeeId: number;
  emptyDescription: string;
  emptyTitle: string;
  entity: OperationalEntity;
  icon: ReactNode;
  locale: string;
  orderBy: string;
  registryPath: string;
  renderRecord: (record: HrRecord, actions: RecordActions) => ReactNode;
  title: string;
}

interface RecordActions {
  onDelete: () => void;
  onEdit: () => void;
}

export function EmployeeVacationsPanel({
  employeeId,
  locale,
}: EmployeeOperationalPanelProps): JSX.Element {
  const { t } = useTranslation();

  return (
    <EmployeeRecordPanel
      createInitialRecord={{ employee_id: employeeId }}
      description="Персональная история отпусков этого сотрудника. Общие записи других сотрудников здесь не отображаются."
      employeeId={employeeId}
      emptyDescription="Добавьте первый отпуск сотрудника или откройте общий реестр отпусков."
      emptyTitle="У сотрудника пока нет отпусков"
      entity="vacations"
      icon={<FiCalendar className="h-6 w-6" />}
      locale={locale}
      orderBy="starts_at"
      registryPath={`/filters/vacations?employee=${employeeId}`}
      title="Отпуска сотрудника"
      renderRecord={(record, actions) => (
        <article className="app-surface app-border rounded-[24px] border p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="app-accent-soft rounded-full border px-3 py-1 text-xs font-black">
                  {humanizeStatus(record.status, t)}
                </span>
                <span className="app-surface-muted app-border rounded-full border px-3 py-1 text-xs font-bold">
                  {Number(record.is_paid) === 1 ? "Оплачиваемый" : "Неоплачиваемый"}
                </span>
              </div>
              <h3 className="app-text mt-3 text-lg font-black">
                {getString(record.vacation_type) || "Отпуск"}
              </h3>
              <p className="app-muted mt-2 text-sm font-semibold">
                {formatDate(record.starts_at, locale)} — {formatDate(record.ends_at, locale)}
              </p>
            </div>
            <RecordActionsButtons actions={actions} label="отпуск" />
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <RecordMetric label="Дней" value={getString(record.days_count) || "—"} />
            <RecordMetric
              label="Отпускные"
              value={formatCurrency(record.payment_amount, locale)}
            />
            <RecordMetric
              label="Дата согласования"
              value={formatDate(record.approved_at, locale)}
            />
          </div>

          {(record.reason || record.note) && (
            <div className="app-border-soft mt-5 grid gap-3 border-t pt-4 text-sm">
              {record.reason && (
                <p className="app-text-soft">
                  <span className="app-text font-black">Основание: </span>
                  {getString(record.reason)}
                </p>
              )}
              {record.note && (
                <p className="app-text-soft">
                  <span className="app-text font-black">Комментарий: </span>
                  {getString(record.note)}
                </p>
              )}
            </div>
          )}
        </article>
      )}
    />
  );
}

export function EmployeePayrollPanel({
  baseSalary,
  employeeId,
  locale,
}: EmployeePayrollPanelProps): JSX.Element {
  return (
    <EmployeeRecordPanel
      createInitialRecord={{ employee_id: employeeId, base_salary: baseSalary ?? 0 }}
      description="Персональная история начислений этого сотрудника. Сведения по другим сотрудникам доступны только в общем реестре."
      employeeId={employeeId}
      emptyDescription="Добавьте первое начисление сотрудника или откройте общий реестр начислений."
      emptyTitle="У сотрудника пока нет начислений"
      entity="payroll"
      icon={<FiCreditCard className="h-6 w-6" />}
      locale={locale}
      orderBy="accrual_month"
      registryPath={`/filters/payroll?employee=${employeeId}`}
      title="Начисления сотрудника"
      renderRecord={(record, actions) => (
        <article className="app-surface app-border rounded-[24px] border p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="app-accent-text text-xs font-black uppercase tracking-[0.16em]">
                Расчётный период
              </p>
              <h3 className="app-text mt-2 text-xl font-black">
                {formatMonth(record.accrual_month, locale)}
              </h3>
              <p className="app-muted mt-2 text-sm font-semibold">
                Выплачено: {formatDate(record.paid_at, locale)}
              </p>
            </div>
            <RecordActionsButtons actions={actions} label="начисление" />
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <RecordMetric label="Оклад" value={formatCurrency(record.base_salary, locale)} />
            <RecordMetric label="Премия" value={formatCurrency(record.bonus, locale)} />
            <RecordMetric label="Надбавка" value={formatCurrency(record.allowance, locale)} />
            <RecordMetric label="Удержания" value={formatCurrency(record.deductions, locale)} />
            <RecordMetric label="Налоги" value={formatCurrency(record.taxes, locale)} />
            <RecordMetric
              emphasized
              label="К выплате"
              value={formatCurrency(record.net_amount, locale)}
            />
          </div>

          {record.note && (
            <p className="app-text-soft app-border-soft mt-5 border-t pt-4 text-sm">
              <span className="app-text font-black">Комментарий: </span>
              {getString(record.note)}
            </p>
          )}
        </article>
      )}
    />
  );
}

function EmployeeRecordPanel({
  createInitialRecord,
  description,
  employeeId,
  emptyDescription,
  emptyTitle,
  entity,
  icon,
  locale,
  orderBy,
  registryPath,
  renderRecord,
  title,
}: EmployeeRecordPanelProps): JSX.Element {
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
      setRecords(await loadEmployeeRecords(entity, employeeId, orderBy));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Не удалось загрузить персональные записи сотрудника",
      );
    } finally {
      setIsLoading(false);
    }
  }, [employeeId, entity, orderBy]);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  function openCreate(): void {
    setDialogMode("create");
    setEditingRecord(null);
    setIsFormOpen(true);
  }

  function openEdit(record: HrRecord): void {
    setDialogMode("edit");
    setEditingRecord(record);
    setIsFormOpen(true);
  }

  function openDelete(record: HrRecord): void {
    setDeletingRecord(record);
    setIsDeleteOpen(true);
  }

  async function saveRecord(data: HrRecord): Promise<void> {
    if (dialogMode === "create") {
      await hrApiClient.create({ entity, data: { ...data, employee_id: employeeId } });
    } else {
      await hrApiClient.update({
        entity,
        id: getRecordId(editingRecord),
        data: { ...data, employee_id: employeeId },
      });
    }

    await loadRecords();
  }

  async function deleteRecord(): Promise<void> {
    await hrApiClient.delete({ entity, id: getRecordId(deletingRecord) });
    setDeletingRecord(null);
    await loadRecords();
  }

  return (
    <div className="space-y-5">
      <section className="app-surface-muted app-border rounded-[24px] border p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <span className="app-accent-soft flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border">
              {icon}
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="app-text text-xl font-black">{title}</h2>
                <span className="app-accent-soft rounded-full border px-2.5 py-1 text-xs font-black">
                  {records.length}
                </span>
              </div>
              <p className="app-muted mt-2 max-w-3xl text-sm font-medium">{description}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              leftIcon={<FiExternalLink className="h-4 w-4" />}
              type="button"
              variant="secondary"
            >
              <Link to={registryPath}>Открыть общий реестр</Link>
            </Button>
            <Button leftIcon={<FiPlus className="h-4 w-4" />} onClick={openCreate}>
              Добавить запись
            </Button>
          </div>
        </div>
      </section>

      {isLoading ? (
        <LoadingState label="Загрузка персональных записей..." />
      ) : records.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {records.map((record) =>
            renderRecord(record, {
              onDelete: () => openDelete(record),
              onEdit: () => openEdit(record),
            }),
          )}
        </div>
      )}

      <HrEntityDialog
        entity={entity}
        initialRecord={dialogMode === "edit" ? editingRecord : createInitialRecord}
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
    </div>
  );
}

function RecordActionsButtons({
  actions,
  label,
}: {
  actions: RecordActions;
  label: string;
}): JSX.Element {
  return (
    <div className="flex shrink-0 gap-2">
      <Button
        aria-label={`Редактировать ${label}`}
        className="h-10 w-10 p-0"
        onClick={actions.onEdit}
        type="button"
        variant="ghost"
      >
        <FiEdit2 className="h-4 w-4" />
      </Button>
      <Button
        aria-label={`Удалить ${label}`}
        className="h-10 w-10 p-0"
        onClick={actions.onDelete}
        type="button"
        variant="ghost"
      >
        <FiTrash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

function RecordMetric({
  emphasized = false,
  label,
  value,
}: {
  emphasized?: boolean;
  label: string;
  value: string;
}): JSX.Element {
  return (
    <div
      className={[
        "rounded-2xl border p-4",
        emphasized ? "app-accent-soft app-accent-border" : "app-surface-muted app-border",
      ].join(" ")}
    >
      <p className="app-muted text-xs font-bold uppercase tracking-wide">{label}</p>
      <p className="app-text mt-1 text-base font-black">{value}</p>
    </div>
  );
}

async function loadEmployeeRecords(
  entity: OperationalEntity,
  employeeId: number,
  orderBy: string,
): Promise<HrRecord[]> {
  const records: HrRecord[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const result = await hrApiClient.list({
      entity,
      page,
      pageSize: 100,
      filters: {
        employee_id: { operator: "equals", value: employeeId },
      },
      orderBy,
      orderDirection: "desc",
    });

    records.push(...result.items);
    totalPages = Math.max(result.totalPages, 1);
    page += 1;
  } while (page <= totalPages);

  return records;
}

function formatMonth(value: unknown, locale: string): string {
  const rawValue = getString(value);
  const match = /^(\d{4})-(\d{2})$/.exec(rawValue);

  if (!match) return rawValue || "—";

  const year = Number(match[1]);
  const month = Number(match[2]);
  const formatted = new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));

  return formatted.charAt(0).toLocaleUpperCase(locale) + formatted.slice(1);
}

function getRecordId(record: HrRecord | null): number {
  const id = Number(record?.id);

  if (!Number.isInteger(id) || id <= 0) {
    throw new Error("Не удалось определить запись сотрудника");
  }

  return id;
}

function getString(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}
