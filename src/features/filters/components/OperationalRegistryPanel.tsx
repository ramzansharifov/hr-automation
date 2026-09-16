import { useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "react-toastify";

import { useAppText } from "../../../shared/i18n";
import { hrApiClient } from "../../../shared/lib/hrApiClient";
import type { HrFilterCondition, HrRecord } from "../../../shared/types/hr";
import {
  ActionButton,
  Input,
  Select,
  type SelectOption,
} from "../../../shared/ui";
import { HrEntityTable } from "../../hr-table/HrEntityTable";
import {
  buildVacationHrFilters,
  clearStoredVacationFilterValues,
  emptyVacationFilters,
  getStoredVacationFilterValues,
  setStoredVacationFilterValues,
  type VacationFilterValues,
} from "../moduleFiltersStore";

export type OperationalRegistry = "vacations";

interface OperationalRegistryPanelProps {
  employeeId?: string;
  registry: OperationalRegistry;
}

export function OperationalRegistryPanel({
  employeeId = "",
  registry,
}: OperationalRegistryPanelProps): JSX.Element {
  const text = useAppText();
  const vacationStatusOptions: SelectOption[] = [
    { value: "planned", label: text("Запланирован", "Planned") },
    { value: "approved", label: text("Одобрен", "Approved") },
    { value: "rejected", label: text("Отклонён", "Rejected") },
    { value: "completed", label: text("Завершён", "Completed") },
  ];
  const paymentOptions: SelectOption[] = [
    { value: "1", label: text("Оплачиваемый", "Paid") },
    { value: "0", label: text("Неоплачиваемый", "Unpaid") },
  ];
  const initialFilters = useMemo(
    () => withEmployee(getStoredVacationFilterValues(), employeeId),
    [employeeId],
  );

  const [vacationFilters, setVacationFilters] =
    useState<VacationFilterValues>(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState<
    Record<string, HrFilterCondition> | undefined
  >(buildVacationHrFilters(initialFilters));
  const [employeeOptions, setEmployeeOptions] = useState<SelectOption[]>([]);
  const [isEmployeesLoading, setIsEmployeesLoading] = useState(true);

  useEffect(() => {
    let isActive = true;

    setIsEmployeesLoading(true);
    loadAllEmployees()
      .then((options) => {
        if (isActive) setEmployeeOptions(options);
      })
      .catch(() => {
        if (isActive) toast.error(text("Не удалось загрузить список сотрудников", "Failed to load employees"));
      })
      .finally(() => {
        if (isActive) setIsEmployeesLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [text]);

  function applyFilters(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setStoredVacationFilterValues(vacationFilters);
    setAppliedFilters(buildVacationHrFilters(vacationFilters));
    toast.success(text("Реестр отпусков обновлён", "Vacation registry updated"));
  }

  function clearFilters(): void {
    setVacationFilters(emptyVacationFilters);
    clearStoredVacationFilterValues();
    setAppliedFilters(undefined);
    toast.success(text("Фильтры очищены", "Filters cleared"));
  }

  return (
    <div className="space-y-6">
      <section className="app-surface app-border overflow-hidden rounded-[28px] border">
        <div className="app-border-soft border-b p-5 sm:p-7">
          <h2 className="app-text text-xl font-black">{text("Фильтры отпусков", "Vacation filters")}</h2>
          <p className="app-muted mt-2 text-sm font-medium">
            {text("Найдите отпуск по сотруднику, типу, статусу, признаку оплаты или точным датам.", "Find vacations by employee, type, status, payment, or exact dates.")}
          </p>
        </div>

        <form className="p-5 sm:p-7" onSubmit={applyFilters}>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            <FilterSelect
              disabled={isEmployeesLoading}
              label={text("Сотрудник", "Employee")}
              onValueChange={(value) =>
                setVacationFilters((current) => ({
                  ...current,
                  employee_id: value,
                }))
              }
              options={employeeOptions}
              value={vacationFilters.employee_id}
            />
            <FilterInput
              label={text("Тип отпуска", "Vacation type")}
              onChange={(value) =>
                setVacationFilters((current) => ({
                  ...current,
                  vacation_type: value,
                }))
              }
              value={vacationFilters.vacation_type}
            />
            <FilterSelect
              label={text("Статус", "Status")}
              onValueChange={(value) =>
                setVacationFilters((current) => ({
                  ...current,
                  status: value,
                }))
              }
              options={vacationStatusOptions}
              value={vacationFilters.status}
            />
            <FilterSelect
              label={text("Оплата", "Payment")}
              onValueChange={(value) =>
                setVacationFilters((current) => ({
                  ...current,
                  is_paid: value,
                }))
              }
              options={paymentOptions}
              value={vacationFilters.is_paid}
            />
            <FilterInput
              label={text("Дата начала", "Start date")}
              onChange={(value) =>
                setVacationFilters((current) => ({
                  ...current,
                  starts_at: value,
                }))
              }
              type="date"
              value={vacationFilters.starts_at}
            />
            <FilterInput
              label={text("Дата окончания", "End date")}
              onChange={(value) =>
                setVacationFilters((current) => ({
                  ...current,
                  ends_at: value,
                }))
              }
              type="date"
              value={vacationFilters.ends_at}
            />
          </div>

          <div className="app-border-soft mt-7 flex flex-col gap-3 border-t pt-5 sm:flex-row sm:justify-end">
            <ActionButton action="reset" onClick={clearFilters} type="button">
              {text("Очистить", "Clear")}
            </ActionButton>
            <ActionButton action="search" type="submit">
              {text("Показать реестр", "Show registry")}
            </ActionButton>
          </div>
        </form>
      </section>

      <HrEntityTable
        key={registry}
        entity={registry}
        externalFilters={appliedFilters}
      />
    </div>
  );
}

function FilterInput({
  label,
  onChange,
  value,
  type = "text",
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
  type?: string;
}): JSX.Element {
  return (
    <label className="grid gap-2">
      <span className="app-text text-sm font-bold">{label}</span>
      <Input
        aria-label={label}
        onChange={(event) => onChange(event.target.value)}
        placeholder={label}
        type={type}
        value={value}
      />
    </label>
  );
}

function FilterSelect({
  disabled = false,
  label,
  onValueChange,
  options,
  value,
}: {
  disabled?: boolean;
  label: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  value: string;
}): JSX.Element {
  const text = useAppText();
  return (
    <label className="grid gap-2">
      <span className="app-text text-sm font-bold">{label}</span>
      <Select
        allowEmpty
        ariaLabel={label}
        disabled={disabled}
        emptyOptionLabel={text("Все", "All")}
        onValueChange={onValueChange}
        options={options}
        placeholder={text("Все", "All")}
        value={value}
      />
    </label>
  );
}

function withEmployee<T extends { employee_id: string }>(
  values: T,
  employeeId: string,
): T {
  return employeeId ? ({ ...values, employee_id: employeeId } as T) : values;
}

async function loadAllEmployees(): Promise<SelectOption[]> {
  const records: HrRecord[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const result = await hrApiClient.list({
      entity: "employees",
      page,
      pageSize: 100,
      orderBy: "last_name",
      orderDirection: "asc",
    });

    records.push(...result.items);
    totalPages = Math.max(result.totalPages, 1);
    page += 1;
  } while (page <= totalPages);

  return records.map((employee) => ({
    value: String(employee.id ?? ""),
    label:
      [employee.last_name, employee.first_name, employee.middle_name]
        .map((part) => String(part ?? "").trim())
        .filter(Boolean)
        .join(" ") || `Employee #${String(employee.id ?? "")}`,
  }));
}
