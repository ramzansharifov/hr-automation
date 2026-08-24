import { useCallback, useEffect, useState } from "react";
import {
  FiArrowUpRight,
  FiCalendar,
  FiClock,
  FiDollarSign,
  FiEdit3,
  FiPlus,
  FiUserX,
} from "react-icons/fi";
import { toast } from "react-toastify";

import { formatCurrency, formatDate } from "../../../shared/lib/format";
import { hrApiClient } from "../../../shared/lib/hrApiClient";
import type { HrRecord } from "../../../shared/types/hr";
import {
  Button,
  Dialog,
  Input,
  SearchableSelect,
  Select,
  Textarea,
  type SelectOption,
} from "../../../shared/ui";
import {
  loadEmployeeRelationOptions,
  type DepartmentOption,
  type PositionOption,
} from "../lib/employeeRelations";

interface EmployeeLifecyclePanelProps {
  canChangeEmployment: boolean;
  canTerminate: boolean;
  employee: HrRecord;
  employeeId: number;
  locale: string;
  onEmployeeUpdated: (employee: HrRecord) => Promise<void>;
}

export function EmployeeLifecyclePanel({
  canChangeEmployment,
  canTerminate,
  employee,
  employeeId,
  locale,
  onEmployeeUpdated,
}: EmployeeLifecyclePanelProps): JSX.Element {
  const [history, setHistory] = useState<HrRecord[]>([]);
  const [enterprises, setEnterprises] = useState<SelectOption[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [positions, setPositions] = useState<PositionOption[]>([]);
  const [careerOpen, setCareerOpen] = useState(false);
  const [terminationOpen, setTerminationOpen] = useState(false);
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const [career, setCareer] = useState({
    enterpriseId: "",
    departmentId: String(employee.department_id ?? ""),
    positionId: String(employee.position_id ?? ""),
    salaryMode: "keep",
    salary: String(employee.salary ?? 0),
    effectiveAt: today,
    reason: "",
  });
  const [termination, setTermination] = useState({
    effectiveAt: today,
    reason: "",
  });
  const [correction, setCorrection] = useState({
    hireDate: String(employee.hire_date ?? ""),
    reason: "",
  });

  const loadData = useCallback(async () => {
    const historyResult = await hrApiClient.list({
      entity: "employment_history",
      page: 1,
      pageSize: 100,
      filters: { employee_id: employeeId },
      orderBy: "effective_at",
      orderDirection: "desc",
    });
    setHistory(historyResult.items);

    if (!canChangeEmployment) {
      setEnterprises([]);
      setDepartments([]);
      setPositions([]);
      return;
    }

    const relationOptions = await loadEmployeeRelationOptions();
    setEnterprises(relationOptions.enterprises);
    setDepartments(relationOptions.departments);
    setPositions(relationOptions.positions);
  }, [canChangeEmployment, employeeId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    const departmentId = String(employee.department_id ?? "");
    const enterpriseId =
      departments.find((department) => department.value === departmentId)
        ?.enterpriseId ?? "";
    setCareer((current) => ({
      ...current,
      enterpriseId,
      departmentId,
      positionId: String(employee.position_id ?? ""),
      salary: String(employee.salary ?? 0),
    }));
    setCorrection((current) => ({
      ...current,
      hireDate: String(employee.hire_date ?? ""),
    }));
  }, [departments, employee]);

  const availableDepartments = career.enterpriseId
    ? departments.filter(
        (department) => department.enterpriseId === career.enterpriseId,
      )
    : [];
  const availablePositions = career.departmentId
    ? positions.filter(
        (position) => position.departmentId === career.departmentId,
      )
    : [];

  const currentAssignmentStartedAt = String(
    history.find(
      (item) =>
        String(item.new_position_id ?? "") ===
          String(employee.position_id ?? "") &&
        String(item.change_type ?? "") !== "terminated",
    )?.effective_at ??
      employee.hire_date ??
      "",
  );
  const isActive = String(employee.status) === "active";
  const careerEndDate = isActive ? undefined : String(employee.terminated_at ?? "");

  async function saveCareerChange(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (!canChangeEmployment) return;
    if (!career.enterpriseId || !career.departmentId || !career.positionId) {
      toast.error("Выберите предприятие, отдел и должность");
      return;
    }
    setSaving(true);
    try {
      const updated = await hrApiClient.changeEmployment({
        employeeId,
        enterpriseId: Number(career.enterpriseId),
        departmentId: Number(career.departmentId),
        positionId: Number(career.positionId),
        salaryMode: career.salaryMode as "keep" | "custom",
        salary:
          career.salaryMode === "custom" ? Number(career.salary) : undefined,
        effectiveAt: career.effectiveAt,
        reason: career.reason,
      });
      await onEmployeeUpdated(updated);
      await loadData();
      setCareerOpen(false);
      setCareer((current) => ({ ...current, reason: "" }));
      toast.success("Кадровое изменение сохранено в журнале");
    } catch (error) {
      toast.error(getErrorMessage(error, "Не удалось сохранить кадровое изменение"));
    } finally {
      setSaving(false);
    }
  }

  async function terminate(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (!canTerminate) return;
    setSaving(true);
    try {
      const updated = await hrApiClient.terminateEmployee({
        employeeId,
        effectiveAt: termination.effectiveAt,
        reason: termination.reason,
      });
      await onEmployeeUpdated(updated);
      await loadData();
      setTerminationOpen(false);
      setTermination((current) => ({ ...current, reason: "" }));
      toast.success("Увольнение зафиксировано в кадровом журнале");
    } catch (error) {
      toast.error(getErrorMessage(error, "Не удалось оформить увольнение"));
    } finally {
      setSaving(false);
    }
  }

  async function correctHireDate(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (!canChangeEmployment) return;
    setSaving(true);
    try {
      const updated = await hrApiClient.correctHireDate({
        employeeId,
        hireDate: correction.hireDate,
        reason: correction.reason,
      });
      await onEmployeeUpdated(updated);
      await loadData();
      setCorrectionOpen(false);
      setCorrection((current) => ({ ...current, reason: "" }));
      toast.success("Дата приёма исправлена вместе с кадровым журналом");
    } catch (error) {
      toast.error(getErrorMessage(error, "Не удалось исправить дату приёма"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-3">
        <Metric
          icon={<FiClock />}
          label="Общий стаж"
          value={durationBetween(String(employee.hire_date ?? ""), careerEndDate)}
        />
        <Metric
          icon={<FiArrowUpRight />}
          label="На текущей должности"
          value={
            isActive
              ? employee.position_id
                ? durationBetween(currentAssignmentStartedAt)
                : "Не назначена"
              : "Работа завершена"
          }
        />
        <Metric
          icon={<FiDollarSign />}
          label="Текущий оклад"
          value={formatCurrency(employee.salary, locale)}
        />
      </div>

      <section className="app-surface-muted app-border rounded-[24px] border p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="app-accent-text text-xs font-black uppercase tracking-[0.18em]">
              Карьера
            </p>
            <h2 className="app-text mt-1 text-xl font-black">
              Кадровый журнал
            </h2>
          </div>
          {(canChangeEmployment || canTerminate) && (
            <div className="flex flex-wrap gap-2">
              {canChangeEmployment && (
                <Button
                  leftIcon={<FiCalendar />}
                  onClick={() => setCorrectionOpen(true)}
                  variant="secondary"
                >
                  Исправить дату приёма
                </Button>
              )}
              {isActive && canChangeEmployment && (
                <Button leftIcon={<FiPlus />} onClick={() => setCareerOpen(true)}>
                  Кадровое изменение
                </Button>
              )}
              {isActive && canTerminate && (
                <Button
                  leftIcon={<FiUserX />}
                  onClick={() => setTerminationOpen(true)}
                  variant="secondary"
                >
                  Уволить
                </Button>
              )}
            </div>
          )}
        </div>
        <div className="mt-5 space-y-3">
          {history.map((item) => (
            <HistoryItem key={String(item.id)} item={item} locale={locale} />
          ))}
          {history.length === 0 && (
            <p className="app-muted rounded-2xl border border-dashed p-5 text-sm">
              Кадровых событий пока нет.
            </p>
          )}
        </div>
      </section>

      {canChangeEmployment && (
        <>
          <Dialog
            open={careerOpen}
            onOpenChange={setCareerOpen}
            title="Кадровое изменение"
            description="Перевод между предприятиями и отделами, смена должности или оклада с обязательной датой и основанием."
          >
            <form className="grid gap-4" onSubmit={saveCareerChange}>
              <Field label="Предприятие">
                <SearchableSelect
                  options={enterprises}
                  value={career.enterpriseId}
                  onValueChange={(enterpriseId) =>
                    setCareer((value) => ({
                      ...value,
                      enterpriseId,
                      departmentId: "",
                      positionId: "",
                    }))
                  }
                  placeholder="Выберите предприятие"
                  searchPlaceholder="Поиск предприятия"
                />
              </Field>
              <Field label="Отдел">
                <SearchableSelect
                  disabled={!career.enterpriseId}
                  options={availableDepartments}
                  value={career.departmentId}
                  onValueChange={(departmentId) =>
                    setCareer((value) => ({ ...value, departmentId, positionId: "" }))
                  }
                  placeholder={
                    career.enterpriseId
                      ? "Выберите отдел"
                      : "Сначала выберите предприятие"
                  }
                  searchPlaceholder="Поиск отдела"
                />
              </Field>
              <Field label="Новая должность">
                <SearchableSelect
                  disabled={!career.departmentId}
                  options={availablePositions}
                  value={career.positionId}
                  onValueChange={(positionId) =>
                    setCareer((value) => ({ ...value, positionId }))
                  }
                  placeholder={
                    career.departmentId
                      ? "Выберите должность"
                      : "Сначала выберите отдел"
                  }
                  searchPlaceholder="Поиск должности"
                />
              </Field>
              <Field label="Оклад">
                <Select
                  value={career.salaryMode}
                  onValueChange={(salaryMode) =>
                    setCareer((value) => ({ ...value, salaryMode }))
                  }
                  options={[
                    { value: "keep", label: "Оставить без изменений" },
                    { value: "custom", label: "Указать новый оклад" },
                  ]}
                />
              </Field>
              {career.salaryMode === "custom" && (
                <Field label="Новый оклад">
                  <Input
                    min="0"
                    type="number"
                    value={career.salary}
                    onChange={(event) =>
                      setCareer((value) => ({ ...value, salary: event.target.value }))
                    }
                  />
                </Field>
              )}
              <Field label="Дата вступления в силу">
                <Input
                  required
                  type="date"
                  value={career.effectiveAt}
                  onChange={(event) =>
                    setCareer((value) => ({ ...value, effectiveAt: event.target.value }))
                  }
                />
              </Field>
              <Field label="Основание изменения">
                <Textarea
                  required
                  placeholder="Например: перевод в другое предприятие по приказу №12"
                  rows={3}
                  value={career.reason}
                  onChange={(event) =>
                    setCareer((value) => ({ ...value, reason: event.target.value }))
                  }
                />
              </Field>
              <DialogActions onCancel={() => setCareerOpen(false)} saving={saving} />
            </form>
          </Dialog>

          <Dialog
            open={correctionOpen}
            onOpenChange={setCorrectionOpen}
            title="Исправить дату приёма"
            description="Исправление синхронно обновит карточку сотрудника и исходную запись о приёме в кадровом журнале."
          >
            <form className="grid gap-4" onSubmit={correctHireDate}>
              <Field label="Дата приёма">
                <Input
                  required
                  type="date"
                  value={correction.hireDate}
                  onChange={(event) =>
                    setCorrection((value) => ({ ...value, hireDate: event.target.value }))
                  }
                />
              </Field>
              <Field label="Причина исправления">
                <Textarea
                  required
                  rows={3}
                  value={correction.reason}
                  onChange={(event) =>
                    setCorrection((value) => ({ ...value, reason: event.target.value }))
                  }
                />
              </Field>
              <DialogActions onCancel={() => setCorrectionOpen(false)} saving={saving} />
            </form>
          </Dialog>
        </>
      )}

      {canTerminate && (
        <Dialog
          open={terminationOpen}
          onOpenChange={setTerminationOpen}
          title="Уволить сотрудника"
          description="Карточка и вся кадровая история останутся в системе. Связанная учётная запись будет заблокирована автоматически."
        >
          <form className="grid gap-4" onSubmit={terminate}>
            <Field label="Дата увольнения">
              <Input
                required
                type="date"
                value={termination.effectiveAt}
                onChange={(event) =>
                  setTermination((value) => ({
                    ...value,
                    effectiveAt: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="Основание увольнения">
              <Textarea
                required
                placeholder="Приказ, заявление или иное основание"
                rows={4}
                value={termination.reason}
                onChange={(event) =>
                  setTermination((value) => ({ ...value, reason: event.target.value }))
                }
              />
            </Field>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
              Сотрудник не удаляется: он переходит в завершённый кадровый статус, а данные остаются доступны в истории.
            </div>
            <DialogActions onCancel={() => setTerminationOpen(false)} saving={saving} destructive />
          </form>
        </Dialog>
      )}
    </div>
  );
}

function DialogActions({
  destructive = false,
  onCancel,
  saving,
}: {
  destructive?: boolean;
  onCancel: () => void;
  saving: boolean;
}): JSX.Element {
  return (
    <div className="flex justify-end gap-3">
      <Button type="button" variant="secondary" onClick={onCancel}>
        Отмена
      </Button>
      <Button disabled={saving} type="submit" variant={destructive ? "secondary" : "primary"}>
        {destructive ? "Подтвердить увольнение" : "Сохранить"}
      </Button>
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}): JSX.Element {
  return (
    <div className="app-surface app-border flex items-center gap-4 rounded-[20px] border p-4">
      <span className="app-accent-soft flex h-11 w-11 items-center justify-center rounded-2xl">
        {icon}
      </span>
      <div>
        <p className="app-muted text-xs font-bold uppercase tracking-wide">{label}</p>
        <p className="app-text mt-1 text-lg font-black">{value}</p>
      </div>
    </div>
  );
}

function Field({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}): JSX.Element {
  return (
    <label className="grid gap-2">
      <span className="app-text text-sm font-bold">{label}</span>
      {children}
    </label>
  );
}

function HistoryItem({
  item,
  locale,
}: {
  item: HrRecord;
  locale: string;
}): JSX.Element {
  const changeType = String(item.change_type ?? "");
  const terminated = changeType === "terminated";
  const title = terminated
    ? "Увольнение"
    : changeType === "hired"
      ? "Приём на работу"
      : changeType === "department_leader"
        ? "Назначение руководителем отдела"
        : String(item.new_position_name ?? "Кадровое изменение");
  const department = terminated
    ? String(item.previous_department_name ?? "")
    : String(item.new_department_name ?? "");
  const salary = terminated ? item.previous_salary : item.new_salary;

  return (
    <article className="app-surface app-border rounded-2xl border p-4">
      <div className="flex flex-wrap justify-between gap-2">
        <p className="app-text flex items-center gap-2 font-black">
          {terminated ? <FiUserX /> : changeType === "hired" ? <FiEdit3 /> : null}
          {title}
        </p>
        <time className="app-muted text-sm font-bold">
          {formatDate(item.effective_at, locale)}
        </time>
      </div>
      <p className="app-muted mt-2 text-sm">
        {department || "Отдел не указан"}
        {salary !== null && salary !== undefined
          ? ` · ${formatCurrency(salary, locale)}`
          : ""}
      </p>
      <p className="app-muted mt-2 text-xs">
        {String(item.reason ?? "Кадровое изменение")}
      </p>
    </article>
  );
}

function durationBetween(startDate: string, endDate?: string): string {
  if (!startDate) return "—";
  const start = new Date(`${startDate}T00:00:00`).getTime();
  const end = endDate
    ? new Date(`${endDate}T00:00:00`).getTime()
    : Date.now();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return "—";
  const months = Math.max(0, Math.floor((end - start) / 2629800000));
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return years ? `${years} г. ${rest} мес.` : `${rest} мес.`;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback;
  const marker = "Error: ";
  const markerIndex = error.message.lastIndexOf(marker);
  return markerIndex >= 0
    ? error.message.slice(markerIndex + marker.length)
    : error.message;
}
