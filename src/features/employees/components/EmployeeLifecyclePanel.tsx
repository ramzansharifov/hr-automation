import { useCallback, useEffect, useMemo, useState } from "react";
import { FiArrowUpRight, FiCalendar, FiClock, FiPlus } from "react-icons/fi";
import { toast } from "react-toastify";

import { formatCurrency, formatDate } from "../../../shared/lib/format";
import { hrApiClient } from "../../../shared/lib/hrApiClient";
import type { HrRecord } from "../../../shared/types/hr";
import {
  Button,
  Dialog,
  Input,
  Select,
  type SelectOption,
} from "../../../shared/ui";

interface EmployeeLifecyclePanelProps {
  employee: HrRecord;
  employeeId: number;
  locale: string;
  onEmployeeUpdated: (employee: HrRecord) => Promise<void>;
}

export function EmployeeLifecyclePanel({
  employee,
  employeeId,
  locale,
  onEmployeeUpdated,
}: EmployeeLifecyclePanelProps): JSX.Element {
  const [history, setHistory] = useState<HrRecord[]>([]);
  const [vacations, setVacations] = useState<HrRecord[]>([]);
  const [departments, setDepartments] = useState<SelectOption[]>([]);
  const [positions, setPositions] = useState<
    Array<SelectOption & { departmentId: string; salary: string }>
  >([]);
  const [careerOpen, setCareerOpen] = useState(false);
  const [vacationOpen, setVacationOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [career, setCareer] = useState({
    departmentId: String(employee.department_id ?? ""),
    positionId: String(employee.position_id ?? ""),
    salaryMode: "keep",
    salary: String(employee.salary ?? 0),
  });
  const [vacation, setVacation] = useState({
    vacationType: "annual",
    startsAt: "",
    endsAt: "",
    isPaid: "1",
    paymentAmount: "0",
    reason: "",
  });

  const loadData = useCallback(async () => {
    const [historyResult, vacationResult, departmentResult, positionResult] =
      await Promise.all([
        hrApiClient.list({
          entity: "employment_history",
          page: 1,
          pageSize: 100,
          filters: { employee_id: employeeId },
          orderBy: "effective_at",
          orderDirection: "desc",
        }),
        hrApiClient.list({
          entity: "vacations",
          page: 1,
          pageSize: 100,
          filters: { employee_id: employeeId },
          orderBy: "starts_at",
          orderDirection: "desc",
        }),
        hrApiClient.list({
          entity: "departments",
          page: 1,
          pageSize: 100,
          orderBy: "name",
        }),
        hrApiClient.list({
          entity: "positions",
          page: 1,
          pageSize: 100,
          orderBy: "name",
        }),
      ]);
    setHistory(historyResult.items);
    setVacations(vacationResult.items);
    setDepartments(
      departmentResult.items.map((item) => ({
        value: String(item.id),
        label: String(item.name),
      })),
    );
    setPositions(
      positionResult.items.map((item) => ({
        value: String(item.id),
        label: String(item.name),
        departmentId: String(item.department_id ?? ""),
        salary: String(item.base_salary ?? 0),
      })),
    );
  }, [employeeId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const positionLabels = useMemo(
    () => new Map(positions.map((item) => [item.value, item.label])),
    [positions],
  );
  const departmentLabels = useMemo(
    () => new Map(departments.map((item) => [item.value, item.label])),
    [departments],
  );
  const currentAssignmentStartedAt = String(
    history.find(
      (item) =>
        String(item.new_position_id ?? "") ===
        String(employee.position_id ?? ""),
    )?.effective_at ??
      employee.hire_date ??
      "",
  );

  async function saveCareerChange(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (!career.positionId || !career.departmentId) {
      toast.error("Выберите отдел и должность");
      return;
    }
    setSaving(true);
    try {
      const updated = await hrApiClient.update({
        entity: "employees",
        id: employeeId,
        data: {
          department_id: Number(career.departmentId),
          position_id: Number(career.positionId),
          salary:
            career.salaryMode === "keep"
              ? Number(employee.salary ?? 0)
              : Number(career.salary),
        },
      });
      await onEmployeeUpdated(updated);
      await loadData();
      setCareerOpen(false);
      toast.success("Кадровое изменение сохранено в журнале");
    } catch {
      toast.error("Не удалось сохранить кадровое изменение");
    } finally {
      setSaving(false);
    }
  }

  async function saveVacation(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (
      !vacation.startsAt ||
      !vacation.endsAt ||
      vacation.endsAt < vacation.startsAt
    ) {
      toast.error("Проверьте период отпуска");
      return;
    }
    const days = daysInclusive(vacation.startsAt, vacation.endsAt);
    setSaving(true);
    try {
      await hrApiClient.create({
        entity: "vacations",
        data: {
          employee_id: employeeId,
          vacation_type: vacation.vacationType,
          starts_at: vacation.startsAt,
          ends_at: vacation.endsAt,
          days_count: days,
          is_paid: Number(vacation.isPaid),
          payment_amount:
            vacation.isPaid === "1" ? Number(vacation.paymentAmount) : 0,
          reason: vacation.reason || null,
          status: "planned",
        },
      });
      await loadData();
      setVacationOpen(false);
      setVacation({
        vacationType: "annual",
        startsAt: "",
        endsAt: "",
        isPaid: "1",
        paymentAmount: "0",
        reason: "",
      });
      toast.success("Отпуск добавлен");
    } catch {
      toast.error("Не удалось добавить отпуск");
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
          value={durationFrom(String(employee.hire_date ?? ""))}
        />
        <Metric
          icon={<FiArrowUpRight />}
          label="На текущей должности"
          value={durationFrom(currentAssignmentStartedAt)}
        />
        <Metric
          icon={<FiCalendar />}
          label="Отпусков в журнале"
          value={String(vacations.length)}
        />
      </div>

      <section className="app-surface-muted app-border rounded-[24px] border p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="app-accent-text text-xs font-black uppercase tracking-[0.18em]">
              Карьера
            </p>
            <h2 className="app-text mt-1 text-xl font-black">
              История назначений и зарплаты
            </h2>
          </div>
          <Button leftIcon={<FiPlus />} onClick={() => setCareerOpen(true)}>
            Изменить должность
          </Button>
        </div>
        <div className="mt-5 space-y-3">
          {history.map((item) => (
            <HistoryItem
              key={String(item.id)}
              item={item}
              locale={locale}
              positions={positionLabels}
              departments={departmentLabels}
            />
          ))}
          {history.length === 0 && (
            <p className="app-muted rounded-2xl border border-dashed p-5 text-sm">
              Изменений пока нет.
            </p>
          )}
        </div>
      </section>

      <section className="app-surface-muted app-border rounded-[24px] border p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="app-accent-text text-xs font-black uppercase tracking-[0.18em]">
              Отпуска
            </p>
            <h2 className="app-text mt-1 text-xl font-black">
              Периоды отсутствия
            </h2>
          </div>
          <Button
            leftIcon={<FiPlus />}
            onClick={() => setVacationOpen(true)}
            variant="secondary"
          >
            Добавить отпуск
          </Button>
        </div>
        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          {vacations.map((item) => (
            <VacationItem key={String(item.id)} item={item} locale={locale} />
          ))}
        </div>
        {vacations.length === 0 && (
          <p className="app-muted mt-5 rounded-2xl border border-dashed p-5 text-sm">
            Отпусков пока нет.
          </p>
        )}
      </section>

      <Dialog
        open={careerOpen}
        onOpenChange={setCareerOpen}
        title="Кадровое изменение"
        description="Повышение, перевод или понижение с выбором правила для зарплаты."
      >
        <form className="grid gap-4" onSubmit={saveCareerChange}>
          <Field label="Отдел">
            <Select
              options={departments}
              value={career.departmentId}
              onValueChange={(departmentId) =>
                setCareer((v) => ({ ...v, departmentId, positionId: "" }))
              }
              placeholder="Выберите отдел"
            />
          </Field>
          <Field label="Новая должность">
            <Select
              options={positions.filter(
                (item) =>
                  !career.departmentId ||
                  item.departmentId === career.departmentId,
              )}
              value={career.positionId}
              onValueChange={(positionId) => {
                const selected = positions.find(
                  (item) => item.value === positionId,
                );
                setCareer((v) => ({
                  ...v,
                  positionId,
                  salary: selected?.salary ?? v.salary,
                }));
              }}
              placeholder="Выберите должность"
            />
          </Field>
          <Field label="Заработная плата">
            <Select
              value={career.salaryMode}
              onValueChange={(salaryMode) =>
                setCareer((v) => ({ ...v, salaryMode }))
              }
              options={[
                { value: "keep", label: "Оставить без изменений" },
                { value: "position", label: "Изменить вручную / по должности" },
              ]}
            />
          </Field>
          {career.salaryMode === "position" && (
            <Field label="Новая зарплата">
              <Input
                min="0"
                type="number"
                value={career.salary}
                onChange={(e) =>
                  setCareer((v) => ({ ...v, salary: e.target.value }))
                }
              />
            </Field>
          )}
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setCareerOpen(false)}
            >
              Отмена
            </Button>
            <Button disabled={saving} type="submit">
              Сохранить изменение
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={vacationOpen}
        onOpenChange={setVacationOpen}
        title="Новый отпуск"
        description="Период, продолжительность и условия оплаты."
      >
        <form className="grid gap-4" onSubmit={saveVacation}>
          <Field label="Тип отпуска">
            <Select
              value={vacation.vacationType}
              onValueChange={(vacationType) =>
                setVacation((v) => ({ ...v, vacationType }))
              }
              options={[
                { value: "annual", label: "Ежегодный" },
                { value: "additional", label: "Дополнительный" },
                { value: "study", label: "Учебный" },
                { value: "unpaid", label: "Без сохранения зарплаты" },
                { value: "medical", label: "По состоянию здоровья" },
              ]}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Начало">
              <Input
                required
                type="date"
                value={vacation.startsAt}
                onChange={(e) =>
                  setVacation((v) => ({ ...v, startsAt: e.target.value }))
                }
              />
            </Field>
            <Field label="Окончание">
              <Input
                required
                type="date"
                value={vacation.endsAt}
                onChange={(e) =>
                  setVacation((v) => ({ ...v, endsAt: e.target.value }))
                }
              />
            </Field>
          </div>
          <Field label="Оплачиваемый">
            <Select
              value={vacation.isPaid}
              onValueChange={(isPaid) => setVacation((v) => ({ ...v, isPaid }))}
              options={[
                { value: "1", label: "Да" },
                { value: "0", label: "Нет" },
              ]}
            />
          </Field>
          {vacation.isPaid === "1" && (
            <Field label="Сумма отпускных">
              <Input
                min="0"
                type="number"
                value={vacation.paymentAmount}
                onChange={(e) =>
                  setVacation((v) => ({ ...v, paymentAmount: e.target.value }))
                }
              />
            </Field>
          )}
          <Field label="Основание / комментарий">
            <Input
              value={vacation.reason}
              onChange={(e) =>
                setVacation((v) => ({ ...v, reason: e.target.value }))
              }
            />
          </Field>
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setVacationOpen(false)}
            >
              Отмена
            </Button>
            <Button disabled={saving} type="submit">
              Добавить отпуск
            </Button>
          </div>
        </form>
      </Dialog>
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
        <p className="app-muted text-xs font-bold uppercase tracking-wide">
          {label}
        </p>
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
  positions,
  departments,
}: {
  item: HrRecord;
  locale: string;
  positions: Map<string, string>;
  departments: Map<string, string>;
}): JSX.Element {
  return (
    <article className="app-surface app-border rounded-2xl border p-4">
      <div className="flex flex-wrap justify-between gap-2">
        <p className="app-text font-black">
          {positions.get(String(item.new_position_id ?? "")) ??
            "Изменение условий"}
        </p>
        <time className="app-muted text-sm font-bold">
          {formatDate(item.effective_at, locale)}
        </time>
      </div>
      <p className="app-muted mt-2 text-sm">
        {departments.get(String(item.new_department_id ?? "")) ??
          "Отдел не указан"}{" "}
        · {formatCurrency(item.new_salary, locale)}
      </p>
      <p className="app-muted mt-2 text-xs">
        {String(item.reason ?? "Кадровое изменение")}
      </p>
    </article>
  );
}
function VacationItem({
  item,
  locale,
}: {
  item: HrRecord;
  locale: string;
}): JSX.Element {
  return (
    <article className="app-surface app-border rounded-2xl border p-4">
      <div className="flex justify-between gap-3">
        <p className="app-text font-black">
          {vacationTypeLabel(String(item.vacation_type))}
        </p>
        <span className="app-accent-soft rounded-full px-3 py-1 text-xs font-black">
          {Number(item.is_paid) ? "Оплачиваемый" : "Неоплачиваемый"}
        </span>
      </div>
      <p className="app-muted mt-3 text-sm font-semibold">
        {formatDate(item.starts_at, locale)} —{" "}
        {formatDate(item.ends_at, locale)} · {String(item.days_count)} дн.
      </p>
      {Number(item.is_paid) === 1 && (
        <p className="app-text mt-2 text-sm font-bold">
          Отпускные: {formatCurrency(item.payment_amount, locale)}
        </p>
      )}
    </article>
  );
}
function daysInclusive(start: string, end: string): number {
  return (
    Math.floor(
      (new Date(`${end}T00:00:00`).getTime() -
        new Date(`${start}T00:00:00`).getTime()) /
        86400000,
    ) + 1
  );
}
function durationFrom(date: string): string {
  if (!date) return "—";
  const months = Math.max(
    0,
    Math.floor(
      (Date.now() - new Date(`${date}T00:00:00`).getTime()) / 2629800000,
    ),
  );
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return years ? `${years} г. ${rest} мес.` : `${rest} мес.`;
}
function vacationTypeLabel(value: string): string {
  return (
    (
      {
        annual: "Ежегодный отпуск",
        additional: "Дополнительный отпуск",
        study: "Учебный отпуск",
        unpaid: "Без сохранения зарплаты",
        medical: "По состоянию здоровья",
      } as Record<string, string>
    )[value] ?? value
  );
}
