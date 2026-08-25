import { useEffect, useMemo, useState } from "react";
import { FiAlertTriangle, FiCalendar, FiSave } from "react-icons/fi";
import { toast } from "react-toastify";

import { useAuth } from "../features/auth/AuthContext";
import { hrApiClient } from "../shared/lib/hrApiClient";
import type { HrRecord, LeaveOverview } from "../shared/types/hr";
import {
  Button,
  EmptyState,
  Input,
  LoadingState,
  PageHeader,
  SearchableSelect,
  Select,
  StatCard,
  type SelectOption,
} from "../shared/ui";

export function LeaveManagementPage(): JSX.Element {
  const { hasPermission, session } = useAuth();
  const [employees, setEmployees] = useState<HrRecord[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [overview, setOverview] = useState<LeaveOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [entitlement, setEntitlement] = useState("28");
  const [carryover, setCarryover] = useState("0");
  const [adjustment, setAdjustment] = useState("0");
  const [calendarDate, setCalendarDate] = useState("");
  const [calendarMode, setCalendarMode] = useState("holiday");
  const [calendarName, setCalendarName] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    void loadEmployees()
      .then((records) => {
        if (!active) return;
        setEmployees(records);
        setEmployeeId((current) => current || String(records[0]?.id ?? ""));
      })
      .catch((error) => {
        if (active) toast.error(errorMessage(error, "Не удалось загрузить сотрудников"));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!employeeId) {
      setOverview(null);
      return;
    }
    void loadOverview();
  }, [employeeId, year]);

  const employeeOptions = useMemo<SelectOption[]>(
    () =>
      employees.map((employee) => ({
        value: String(employee.id),
        label: `${employeeName(employee)}${employee.department_name ? ` — ${employee.department_name}` : ""}`,
      })),
    [employees],
  );

  async function loadOverview(): Promise<void> {
    setLoading(true);
    try {
      const result = await hrApiClient.getLeaveOverview({
        employeeId: Number(employeeId),
        year: Number(year),
      });
      setOverview(result);
      setEntitlement(String(result.balance.entitlementDays));
      setCarryover(String(result.balance.carryoverDays));
      setAdjustment(String(result.balance.adjustmentDays));
    } catch (error) {
      toast.error(errorMessage(error, "Не удалось рассчитать отпускной баланс"));
      setOverview(null);
    } finally {
      setLoading(false);
    }
  }

  async function saveBalance(): Promise<void> {
    if (!employeeId) return;
    setSaving(true);
    try {
      await hrApiClient.saveLeaveBalance({
        employeeId: Number(employeeId),
        year: Number(year),
        entitlementDays: Number(entitlement),
        carryoverDays: Number(carryover),
        adjustmentDays: Number(adjustment),
      });
      toast.success("Отпускной баланс сохранён");
      await loadOverview();
    } catch (error) {
      toast.error(errorMessage(error, "Не удалось сохранить отпускной баланс"));
    } finally {
      setSaving(false);
    }
  }

  async function saveCalendarDay(): Promise<void> {
    const enterpriseId = resolveEnterpriseId(session.enterpriseId, employees, employeeId);
    if (!enterpriseId) {
      toast.error("Для настройки календаря не определено предприятие");
      return;
    }
    if (!calendarDate) {
      toast.error("Выберите дату календаря");
      return;
    }
    setSaving(true);
    try {
      await hrApiClient.saveWorkCalendarDay({
        enterpriseId,
        date: calendarDate,
        isWorkday: calendarMode === "workday",
        name: calendarName.trim() || undefined,
      });
      toast.success("Производственный календарь обновлён");
      setCalendarDate("");
      setCalendarName("");
      await loadOverview();
    } catch (error) {
      toast.error(errorMessage(error, "Не удалось обновить календарь"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        description="Рабочие дни считаются по производственному календарю предприятия: базово понедельник–пятница, а праздники, переносы и рабочие выходные задаются отдельно."
        eyebrow="Leave Management"
        icon={<FiCalendar />}
        title="Управление отпусками"
      />

      <section className="app-surface app-border grid gap-4 rounded-[24px] border p-5 sm:grid-cols-[minmax(0,1fr)_180px] sm:p-6">
        <Field label="Сотрудник">
          <SearchableSelect
            ariaLabel="Сотрудник"
            onValueChange={setEmployeeId}
            options={employeeOptions}
            placeholder="Выберите сотрудника"
            searchPlaceholder="Поиск по сотрудникам"
            value={employeeId}
          />
        </Field>
        <Field label="Расчётный год">
          <Select
            onValueChange={setYear}
            options={yearOptions()}
            value={year}
          />
        </Field>
      </section>

      {loading && !overview ? (
        <LoadingState label="Рассчитываем отпускной баланс..." />
      ) : !employeeId || !overview ? (
        <EmptyState
          description="Выберите сотрудника, чтобы увидеть остаток дней, отпуска и предупреждения."
          title="Сотрудник не выбран"
        />
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard icon={FiCalendar} title="Начислено" value={formatDays(overview.balance.entitlementDays)} />
            <StatCard icon={FiCalendar} title="Перенос" value={formatDays(overview.balance.carryoverDays)} />
            <StatCard icon={FiCalendar} title="Использовано" value={formatDays(overview.balance.usedDays)} />
            <StatCard icon={FiCalendar} title="Остаток" value={formatDays(overview.balance.remainingDays)} />
          </section>

          {overview.warnings.length > 0 && (
            <section className="grid gap-3">
              {overview.warnings.map((warning) => (
                <div
                  className="flex gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/5 p-4 text-sm font-semibold text-amber-700 dark:text-amber-300"
                  key={warning}
                >
                  <FiAlertTriangle className="mt-0.5 shrink-0" />
                  <span>{warning}</span>
                </div>
              ))}
            </section>
          )}

          <section className="grid gap-5 xl:grid-cols-2">
            <article className="app-surface app-border rounded-[24px] border p-5 sm:p-6">
              <h2 className="app-text text-lg font-black">Отпускной баланс</h2>
              <p className="app-muted mt-1 text-sm leading-6">
                Остаток = начисление + перенос + корректировка − утверждённые и завершённые рабочие дни отпуска.
              </p>
              <div className="mt-5 grid gap-4 sm:grid-cols-3">
                <Field label="Начисление">
                  <Input disabled={!hasPermission("leave.manage")} min="0" onChange={(event) => setEntitlement(event.target.value)} step="0.5" type="number" value={entitlement} />
                </Field>
                <Field label="Перенос">
                  <Input disabled={!hasPermission("leave.manage")} min="0" onChange={(event) => setCarryover(event.target.value)} step="0.5" type="number" value={carryover} />
                </Field>
                <Field label="Корректировка">
                  <Input disabled={!hasPermission("leave.manage")} onChange={(event) => setAdjustment(event.target.value)} step="0.5" type="number" value={adjustment} />
                </Field>
              </div>
              {hasPermission("leave.manage") && (
                <div className="mt-4 flex justify-end">
                  <Button disabled={saving} leftIcon={<FiSave />} onClick={() => void saveBalance()}>
                    Сохранить баланс
                  </Button>
                </div>
              )}
            </article>

            <article className="app-surface app-border rounded-[24px] border p-5 sm:p-6">
              <h2 className="app-text text-lg font-black">Производственный календарь</h2>
              <p className="app-muted mt-1 text-sm leading-6">
                По умолчанию суббота и воскресенье нерабочие. Здесь задаются праздники, переносы и рабочие выходные предприятия.
              </p>
              {hasPermission("leave.calendar_manage") ? (
                <div className="mt-5 grid gap-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Дата">
                      <Input onChange={(event) => setCalendarDate(event.target.value)} type="date" value={calendarDate} />
                    </Field>
                    <Field label="Тип дня">
                      <Select
                        onValueChange={setCalendarMode}
                        options={[
                          { value: "holiday", label: "Выходной / праздник" },
                          { value: "workday", label: "Рабочий день" },
                        ]}
                        value={calendarMode}
                      />
                    </Field>
                  </div>
                  <Field label="Название / основание">
                    <Input onChange={(event) => setCalendarName(event.target.value)} placeholder="Например: День независимости" value={calendarName} />
                  </Field>
                  <div className="flex justify-end">
                    <Button disabled={saving} onClick={() => void saveCalendarDay()}>
                      Сохранить день
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="app-muted mt-5 text-sm">Изменение календаря доступно на уровне предприятия.</p>
              )}
            </article>
          </section>

          <article className="app-surface app-border overflow-hidden rounded-[24px] border">
            <div className="app-surface-muted app-border-soft border-b px-5 py-4 sm:px-6">
              <h2 className="app-text font-black">Отпуска за {year} год</h2>
              <p className="app-muted mt-1 text-sm">
                Запланировано: {formatDays(overview.balance.plannedDays)} · учтено в остатке: {formatDays(overview.balance.usedDays)}
              </p>
            </div>
            {overview.vacations.length === 0 ? (
              <EmptyState title="Отпусков за этот год нет" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="app-muted text-xs font-black uppercase tracking-wide">
                    <tr>
                      <th className="px-5 py-4">Вид</th>
                      <th className="px-5 py-4">Период</th>
                      <th className="px-5 py-4">Календарных</th>
                      <th className="px-5 py-4">Рабочих</th>
                      <th className="px-5 py-4">Статус</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border-soft)]">
                    {overview.vacations.map((vacation) => (
                      <tr key={String(vacation.id)}>
                        <td className="app-text px-5 py-4 font-bold">{String(vacation.vacation_type_name ?? "Отпуск")}</td>
                        <td className="app-muted px-5 py-4">{formatDate(String(vacation.starts_at))} — {formatDate(String(vacation.ends_at))}</td>
                        <td className="app-muted px-5 py-4">{String(vacation.days_count ?? 0)}</td>
                        <td className="app-text px-5 py-4 font-black">{String(vacation.working_days_count ?? 0)}</td>
                        <td className="app-muted px-5 py-4">{vacationStatus(String(vacation.status ?? "planned"))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>
        </>
      )}
    </div>
  );
}

function Field({ children, label }: { children: React.ReactNode; label: string }): JSX.Element {
  return (
    <label className="grid gap-2">
      <span className="app-text text-sm font-black">{label}</span>
      {children}
    </label>
  );
}

async function loadEmployees(): Promise<HrRecord[]> {
  const records: HrRecord[] = [];
  let page = 1;
  let totalPages = 1;
  do {
    const result = await hrApiClient.list({
      entity: "employees",
      filters: { lifecycle_status: ["active", "pending_assignment"] },
      orderBy: "last_name",
      orderDirection: "asc",
      page,
      pageSize: 100,
    });
    records.push(...result.items);
    totalPages = Math.max(result.totalPages, 1);
    page += 1;
  } while (page <= totalPages);
  return records;
}

function resolveEnterpriseId(
  sessionEnterpriseId: number | null,
  employees: HrRecord[],
  employeeId: string,
): number | null {
  if (sessionEnterpriseId) return sessionEnterpriseId;
  const employee = employees.find((item) => String(item.id) === employeeId);
  const value = Number(employee?.enterprise_id);
  return Number.isInteger(value) && value > 0 ? value : null;
}

function employeeName(record: HrRecord): string {
  return [record.last_name, record.first_name, record.middle_name]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .join(" ");
}

function yearOptions(): SelectOption[] {
  const current = new Date().getFullYear();
  return Array.from({ length: 5 }, (_, index) => current - 2 + index).map((value) => ({
    value: String(value),
    label: String(value),
  }));
}

function formatDays(value: number): string {
  return `${Number.isInteger(value) ? value : value.toFixed(1)} дн.`;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ru-RU").format(new Date(`${value}T00:00:00`));
}

function vacationStatus(status: string): string {
  const labels: Record<string, string> = {
    planned: "Запланирован",
    approved: "Утверждён",
    rejected: "Отклонён",
    completed: "Завершён",
  };
  return labels[status] ?? status;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message.split("Error: ").pop() || fallback : fallback;
}
