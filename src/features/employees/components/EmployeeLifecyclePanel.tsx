import { useCallback, useEffect, useMemo, useState } from "react";
import { FiArrowUpRight, FiCreditCard, FiClock, FiPlus } from "react-icons/fi";
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
  const [departments, setDepartments] = useState<SelectOption[]>([]);
  const [positions, setPositions] = useState<
    Array<SelectOption & { departmentId: string; salary: string }>
  >([]);
  const [careerOpen, setCareerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [career, setCareer] = useState({
    departmentId: String(employee.department_id ?? ""),
    positionId: String(employee.position_id ?? ""),
    salaryMode: "keep",
    salary: String(employee.salary ?? 0),
    effectiveAt: new Date().toISOString().slice(0, 10),
    reason: "",
    note: "",
  });

  const loadData = useCallback(async () => {
    const [historyResult, departmentResult, positionResult] =
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
      const updated = await hrApiClient.changeEmployment({
        employeeId,
        departmentId: Number(career.departmentId),
        positionId: Number(career.positionId),
        salaryMode: career.salaryMode as "keep" | "position" | "custom",
        salary:
          career.salaryMode === "custom" ? Number(career.salary) : undefined,
        effectiveAt: career.effectiveAt,
        reason: career.reason,
        note: career.note,
      });
      await onEmployeeUpdated(updated);
      await loadData();
      setCareerOpen(false);
      toast.success("Кадровое изменение сохранено в журнале");
    } catch (error) {
      toast.error(
        getErrorMessage(error, "Не удалось сохранить кадровое изменение"),
      );
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
          icon={<FiCreditCard />}
          label="Текущая зарплата"
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
                { value: "position", label: "Установить оклад должности" },
                { value: "custom", label: "Указать вручную" },
              ]}
            />
          </Field>
          {career.salaryMode === "custom" && (
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
          <Field label="Дата вступления в силу">
            <Input
              required
              type="date"
              value={career.effectiveAt}
              onChange={(e) =>
                setCareer((v) => ({ ...v, effectiveAt: e.target.value }))
              }
            />
          </Field>
          <Field label="Основание изменения">
            <Input
              required
              placeholder="Например: приказ №12 от 13.07.2026"
              value={career.reason}
              onChange={(e) =>
                setCareer((v) => ({ ...v, reason: e.target.value }))
              }
            />
          </Field>
          <Field label="Комментарий">
            <Input
              value={career.note}
              onChange={(e) =>
                setCareer((v) => ({ ...v, note: e.target.value }))
              }
            />
          </Field>
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
function getErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback;

  const marker = "Error: ";
  const markerIndex = error.message.lastIndexOf(marker);
  return markerIndex >= 0
    ? error.message.slice(markerIndex + marker.length)
    : error.message;
}
