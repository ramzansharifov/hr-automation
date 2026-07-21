import { useEffect, useMemo, useState, type FormEvent } from "react";
import { FiRotateCcw, FiSearch } from "react-icons/fi";
import { toast } from "react-toastify";

import { hrApiClient } from "../../../shared/lib/hrApiClient";
import type { HrFilterCondition, HrRecord } from "../../../shared/types/hr";
import {
  Button,
  Input,
  Select,
  type SelectOption,
} from "../../../shared/ui";
import { HrEntityTable } from "../../hr-table/HrEntityTable";
import {
  buildPayrollHrFilters,
  buildVacationHrFilters,
  clearStoredPayrollFilterValues,
  clearStoredVacationFilterValues,
  emptyPayrollFilters,
  emptyVacationFilters,
  getStoredPayrollFilterValues,
  getStoredVacationFilterValues,
  setStoredPayrollFilterValues,
  setStoredVacationFilterValues,
  type PayrollFilterValues,
  type VacationFilterValues,
} from "../moduleFiltersStore";

export type OperationalRegistry = "vacations" | "payroll";

interface OperationalRegistryPanelProps {
  employeeId?: string;
  registry: OperationalRegistry;
}

const vacationStatusOptions: SelectOption[] = [
  { value: "planned", label: "Запланирован" },
  { value: "approved", label: "Одобрен" },
  { value: "rejected", label: "Отклонён" },
  { value: "completed", label: "Завершён" },
];

const paymentOptions: SelectOption[] = [
  { value: "1", label: "Оплачиваемый" },
  { value: "0", label: "Неоплачиваемый" },
];

export function OperationalRegistryPanel({
  employeeId = "",
  registry,
}: OperationalRegistryPanelProps): JSX.Element {
  const initialVacationFilters = useMemo(
    () => withEmployee(getStoredVacationFilterValues(), employeeId),
    [employeeId],
  );
  const initialPayrollFilters = useMemo(
    () => withEmployee(getStoredPayrollFilterValues(), employeeId),
    [employeeId],
  );

  const [vacationFilters, setVacationFilters] = useState<VacationFilterValues>(
    initialVacationFilters,
  );
  const [payrollFilters, setPayrollFilters] = useState<PayrollFilterValues>(
    initialPayrollFilters,
  );
  const [appliedFilters, setAppliedFilters] = useState<
    Record<string, HrFilterCondition> | undefined
  >(
    registry === "vacations"
      ? buildVacationHrFilters(initialVacationFilters)
      : buildPayrollHrFilters(initialPayrollFilters),
  );
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
        if (isActive) toast.error("Не удалось загрузить список сотрудников");
      })
      .finally(() => {
        if (isActive) setIsEmployeesLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, []);

  function applyFilters(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    if (registry === "vacations") {
      setStoredVacationFilterValues(vacationFilters);
      setAppliedFilters(buildVacationHrFilters(vacationFilters));
      toast.success("Реестр отпусков обновлён");
      return;
    }

    setStoredPayrollFilterValues(payrollFilters);
    setAppliedFilters(buildPayrollHrFilters(payrollFilters));
    toast.success("Реестр начислений обновлён");
  }

  function clearFilters(): void {
    if (registry === "vacations") {
      setVacationFilters(emptyVacationFilters);
      clearStoredVacationFilterValues();
    } else {
      setPayrollFilters(emptyPayrollFilters);
      clearStoredPayrollFilterValues();
    }

    setAppliedFilters(undefined);
    toast.success("Фильтры очищены");
  }

  return (
    <div className="space-y-6">
      <section className="app-surface app-border overflow-hidden rounded-[28px] border">
        <div className="app-border-soft border-b p-5 sm:p-7">
          <h2 className="app-text text-xl font-black">
            {registry === "vacations" ? "Фильтры отпусков" : "Фильтры начислений"}
          </h2>
          <p className="app-muted mt-2 text-sm font-medium">
            {registry === "vacations"
              ? "Найдите отпуск по сотруднику, типу, статусу, оплате или точным датам."
              : "Найдите начисление по сотруднику и месяцу расчёта."}
          </p>
        </div>

        <form className="p-5 sm:p-7" onSubmit={applyFilters}>
          {registry === "vacations" ? (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              <FilterSelect
                disabled={isEmployeesLoading}
                label="Сотрудник"
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
                label="Тип отпуска"
                onChange={(value) =>
                  setVacationFilters((current) => ({
                    ...current,
                    vacation_type: value,
                  }))
                }
                value={vacationFilters.vacation_type}
              />
              <FilterSelect
                label="Статус"
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
                label="Оплата"
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
                label="Дата начала"
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
                label="Дата окончания"
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
          ) : (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              <FilterSelect
                disabled={isEmployeesLoading}
                label="Сотрудник"
                onValueChange={(value) =>
                  setPayrollFilters((current) => ({
                    ...current,
                    employee_id: value,
                  }))
                }
                options={employeeOptions}
                value={payrollFilters.employee_id}
              />
              <FilterInput
                label="Месяц начисления"
                onChange={(value) =>
                  setPayrollFilters((current) => ({
                    ...current,
                    accrual_month: value,
                  }))
                }
                type="month"
                value={payrollFilters.accrual_month}
              />
            </div>
          )}

          <div className="app-border-soft mt-7 flex flex-col gap-3 border-t pt-5 sm:flex-row sm:justify-end">
            <Button
              leftIcon={<FiRotateCcw className="h-4 w-4" />}
              onClick={clearFilters}
              type="button"
              variant="secondary"
            >
              Очистить
            </Button>
            <Button
              leftIcon={<FiSearch className="h-4 w-4" />}
              type="submit"
              variant="primary"
            >
              Показать реестр
            </Button>
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
  return (
    <label className="grid gap-2">
      <span className="app-text text-sm font-bold">{label}</span>
      <Select
        allowEmpty
        ariaLabel={label}
        disabled={disabled}
        emptyOptionLabel="Все"
        onValueChange={onValueChange}
        options={options}
        placeholder="Все"
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
        .join(" ") || `Сотрудник #${String(employee.id ?? "")}`,
  }));
}
