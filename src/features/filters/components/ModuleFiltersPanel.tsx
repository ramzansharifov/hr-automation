import * as Tabs from "@radix-ui/react-tabs";
import type { FormEvent, ReactNode } from "react";
import { useEffect, useId, useMemo, useState } from "react";
import {
  FiBriefcase,
  FiClipboard,
  FiLayers,
  FiRotateCcw,
  FiSearch,
  FiUsers,
} from "react-icons/fi";
import { toast } from "react-toastify";

import { hrApiClient } from "../../../shared/lib/hrApiClient";
import {
  Button,
  Input,
  Label,
  Select,
  type SelectOption,
} from "../../../shared/ui";
import { useEmployeeFormOptions } from "../../employees/hooks/useEmployeeFormOptions";
import {
  clearStoredEmployeeFilterValues,
  emptyEmployeeFilters,
  getStoredEmployeeFilterValues,
  setStoredEmployeeFilterValues,
  type EmployeeFilterValues,
} from "../employeeFiltersStore";
import {
  clearStoredCandidateFilterValues,
  clearStoredEnterpriseFilterValues,
  clearStoredVacancyFilterValues,
  emptyCandidateFilters,
  emptyEnterpriseFilters,
  emptyVacancyFilters,
  getStoredCandidateFilterValues,
  getStoredEnterpriseFilterValues,
  getStoredVacancyFilterValues,
  setStoredCandidateFilterValues,
  setStoredEnterpriseFilterValues,
  setStoredVacancyFilterValues,
  type CandidateFilterValues,
  type EnterpriseFilterValues,
  type VacancyFilterValues,
} from "../moduleFiltersStore";

type FilterModule = "employees" | "enterprises" | "vacancies" | "candidates";

const moduleTabs: Array<{
  id: FilterModule;
  label: string;
  icon: typeof FiUsers;
}> = [
  { id: "employees", label: "Сотрудники", icon: FiUsers },
  { id: "enterprises", label: "Предприятия", icon: FiLayers },
  { id: "vacancies", label: "Вакансии", icon: FiBriefcase },
  { id: "candidates", label: "Кандидаты", icon: FiClipboard },
];

const vacancyStatusOptions: SelectOption[] = [
  { value: "open", label: "Открыта" },
  { value: "draft", label: "Черновик" },
  { value: "paused", label: "Приостановлена" },
  { value: "closed", label: "Закрыта" },
];

const employmentTypeOptions: SelectOption[] = [
  { value: "full_time", label: "Полная занятость" },
  { value: "part_time", label: "Частичная занятость" },
  { value: "temporary", label: "Временная работа" },
  { value: "internship", label: "Стажировка" },
];

const candidateStatusOptions: SelectOption[] = [
  { value: "new", label: "Новый" },
  { value: "screening", label: "Первичный отбор" },
  { value: "interview", label: "Собеседование" },
  { value: "offer", label: "Оффер" },
  { value: "hired", label: "Принят" },
  { value: "rejected", label: "Отклонён" },
];

export function ModuleFiltersPanel(): JSX.Element {
  const [activeModule, setActiveModule] = useState<FilterModule>("employees");
  const [employeeFilters, setEmployeeFilters] = useState<EmployeeFilterValues>(
    getStoredEmployeeFilterValues,
  );
  const [enterpriseFilters, setEnterpriseFilters] =
    useState<EnterpriseFilterValues>(getStoredEnterpriseFilterValues);
  const [vacancyFilters, setVacancyFilters] = useState<VacancyFilterValues>(
    getStoredVacancyFilterValues,
  );
  const [candidateFilters, setCandidateFilters] = useState<CandidateFilterValues>(
    getStoredCandidateFilterValues,
  );
  const [vacancyOptions, setVacancyOptions] = useState<SelectOption[]>([]);
  const {
    departments,
    genderOptions,
    isRelationsLoading,
    positions,
    statusOptions,
  } = useEmployeeFormOptions();

  useEffect(() => {
    let isActive = true;
    hrApiClient
      .listVacancies({})
      .then((rows) => {
        if (!isActive) return;
        setVacancyOptions(
          rows.map((row) => ({
            value: String(row.id),
            label: [row.position_name, row.department_name, row.enterprise_name]
              .filter(Boolean)
              .join(" · "),
          })),
        );
      })
      .catch(() => {
        if (isActive) toast.error("Не удалось загрузить список вакансий");
      });
    return () => {
      isActive = false;
    };
  }, []);

  const activeCounts = useMemo(
    () => ({
      employees: countActive(employeeFilters),
      enterprises: countActive(enterpriseFilters),
      vacancies: countActive(vacancyFilters),
      candidates: countActive(candidateFilters),
    }),
    [candidateFilters, employeeFilters, enterpriseFilters, vacancyFilters],
  );

  function applyFilters(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    if (activeModule === "employees") {
      setStoredEmployeeFilterValues(employeeFilters);
    } else if (activeModule === "enterprises") {
      setStoredEnterpriseFilterValues(enterpriseFilters);
    } else if (activeModule === "vacancies") {
      setStoredVacancyFilterValues(vacancyFilters);
    } else {
      setStoredCandidateFilterValues(candidateFilters);
    }

    toast.success("Фильтры применены");
  }

  function clearFilters(): void {
    if (activeModule === "employees") {
      setEmployeeFilters(emptyEmployeeFilters);
      clearStoredEmployeeFilterValues();
    } else if (activeModule === "enterprises") {
      setEnterpriseFilters(emptyEnterpriseFilters);
      clearStoredEnterpriseFilterValues();
    } else if (activeModule === "vacancies") {
      setVacancyFilters(emptyVacancyFilters);
      clearStoredVacancyFilterValues();
    } else {
      setCandidateFilters(emptyCandidateFilters);
      clearStoredCandidateFilterValues();
    }

    toast.success("Фильтры очищены");
  }

  return (
    <Tabs.Root
      asChild
      onValueChange={(value) => setActiveModule(value as FilterModule)}
      value={activeModule}
    >
      <section className="app-surface app-border overflow-hidden rounded-[28px] border">
        <div className="app-border-soft overflow-x-auto border-b p-3 sm:p-4">
          <Tabs.List
            aria-label="Модуль фильтрации"
            className="flex min-w-max gap-2"
          >
            {moduleTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeModule === tab.id;
              const count = activeCounts[tab.id];
              return (
                <Tabs.Trigger
                  className={[
                    "app-tab-trigger group flex h-11 items-center gap-2 rounded-xl border px-4 text-sm font-black outline-none transition",
                    "focus-visible:ring-2 focus-visible:ring-[var(--accent-border)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface)]",
                    "data-[state=active]:border-[var(--accent-border)] data-[state=active]:bg-[var(--accent)] data-[state=active]:text-white data-[state=active]:shadow-lg",
                    "data-[state=inactive]:app-button-secondary",
                  ].join(" ")}
                  key={tab.id}
                  value={tab.id}
                >
                  <Icon className="h-4 w-4 transition-transform duration-200 group-data-[state=active]:scale-110" />
                  {tab.label}
                  {count > 0 && (
                    <span
                      className={[
                        "rounded-full px-2 py-0.5 text-[11px] transition-colors",
                        isActive ? "bg-white/20 text-white" : "app-accent-soft",
                      ].join(" ")}
                    >
                      {count}
                    </span>
                  )}
                </Tabs.Trigger>
              );
            })}
          </Tabs.List>
        </div>

        <form className="p-5 sm:p-7" onSubmit={applyFilters}>
          <Tabs.Content className="radix-tabs-content outline-none" value="employees">
            <FilterGrid>
              <FilterInput
                label="Фамилия"
                onChange={(value) =>
                  setEmployeeFilters((current) => ({ ...current, last_name: value }))
                }
                value={employeeFilters.last_name}
              />
              <FilterInput
                label="Имя"
                onChange={(value) =>
                  setEmployeeFilters((current) => ({ ...current, first_name: value }))
                }
                value={employeeFilters.first_name}
              />
              <FilterInput
                label="Отчество"
                onChange={(value) =>
                  setEmployeeFilters((current) => ({ ...current, middle_name: value }))
                }
                value={employeeFilters.middle_name}
              />
              <FilterInput
                label="Телефон"
                onChange={(value) =>
                  setEmployeeFilters((current) => ({ ...current, phone: value }))
                }
                value={employeeFilters.phone}
              />
              <FilterInput
                label="Email"
                onChange={(value) =>
                  setEmployeeFilters((current) => ({ ...current, email: value }))
                }
                value={employeeFilters.email}
              />
              <FilterSelect
                disabled={isRelationsLoading}
                label="Отдел"
                onValueChange={(value) =>
                  setEmployeeFilters((current) => ({ ...current, department_id: value }))
                }
                options={departments}
                value={employeeFilters.department_id}
              />
              <FilterSelect
                disabled={isRelationsLoading}
                label="Должность"
                onValueChange={(value) =>
                  setEmployeeFilters((current) => ({ ...current, position_id: value }))
                }
                options={positions}
                value={employeeFilters.position_id}
              />
              <FilterSelect
                label="Статус"
                onValueChange={(value) =>
                  setEmployeeFilters((current) => ({ ...current, status: value }))
                }
                options={statusOptions}
                value={employeeFilters.status}
              />
              <FilterSelect
                label="Пол"
                onValueChange={(value) =>
                  setEmployeeFilters((current) => ({ ...current, gender: value }))
                }
                options={genderOptions}
                value={employeeFilters.gender}
              />
            </FilterGrid>
          </Tabs.Content>

          <Tabs.Content className="radix-tabs-content outline-none" value="enterprises">
            <FilterGrid>
              <FilterInput
                label="Название"
                onChange={(value) =>
                  setEnterpriseFilters((current) => ({ ...current, name: value }))
                }
                value={enterpriseFilters.name}
              />
              <FilterInput
                label="Юридическое наименование"
                onChange={(value) =>
                  setEnterpriseFilters((current) => ({ ...current, legal_name: value }))
                }
                value={enterpriseFilters.legal_name}
              />
              <FilterInput
                label="Телефон"
                onChange={(value) =>
                  setEnterpriseFilters((current) => ({ ...current, phone: value }))
                }
                value={enterpriseFilters.phone}
              />
              <FilterInput
                label="Email"
                onChange={(value) =>
                  setEnterpriseFilters((current) => ({ ...current, email: value }))
                }
                value={enterpriseFilters.email}
              />
            </FilterGrid>
          </Tabs.Content>

          <Tabs.Content className="radix-tabs-content outline-none" value="vacancies">
            <FilterGrid>
              <FilterSelect
                label="Статус"
                onValueChange={(value) =>
                  setVacancyFilters((current) => ({ ...current, status: value }))
                }
                options={vacancyStatusOptions}
                value={vacancyFilters.status}
              />
              <FilterSelect
                label="Формат занятости"
                onValueChange={(value) =>
                  setVacancyFilters((current) => ({
                    ...current,
                    employment_type: value,
                  }))
                }
                options={employmentTypeOptions}
                value={vacancyFilters.employment_type}
              />
              <FilterInput
                label="Предприятие"
                onChange={(value) =>
                  setVacancyFilters((current) => ({
                    ...current,
                    enterprise_name: value,
                  }))
                }
                value={vacancyFilters.enterprise_name}
              />
              <FilterInput
                label="Отдел"
                onChange={(value) =>
                  setVacancyFilters((current) => ({
                    ...current,
                    department_name: value,
                  }))
                }
                value={vacancyFilters.department_name}
              />
              <FilterInput
                label="Должность"
                onChange={(value) =>
                  setVacancyFilters((current) => ({
                    ...current,
                    position_name: value,
                  }))
                }
                value={vacancyFilters.position_name}
              />
            </FilterGrid>
          </Tabs.Content>

          <Tabs.Content className="radix-tabs-content outline-none" value="candidates">
            <FilterGrid>
              <FilterSelect
                label="Статус"
                onValueChange={(value) =>
                  setCandidateFilters((current) => ({ ...current, status: value }))
                }
                options={candidateStatusOptions}
                value={candidateFilters.status}
              />
              <FilterSelect
                label="Вакансия"
                onValueChange={(value) =>
                  setCandidateFilters((current) => ({ ...current, vacancy_id: value }))
                }
                options={vacancyOptions}
                value={candidateFilters.vacancy_id}
              />
              <FilterInput
                label="Источник"
                onChange={(value) =>
                  setCandidateFilters((current) => ({ ...current, source: value }))
                }
                value={candidateFilters.source}
              />
              <FilterInput
                label="Минимальное соответствие, %"
                max="100"
                min="0"
                onChange={(value) =>
                  setCandidateFilters((current) => ({ ...current, min_match: value }))
                }
                type="number"
                value={candidateFilters.min_match}
              />
            </FilterGrid>
          </Tabs.Content>

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
              Применить
            </Button>
          </div>
        </form>
      </section>
    </Tabs.Root>
  );
}

function FilterGrid({ children }: { children: ReactNode }): JSX.Element {
  return <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{children}</div>;
}

function FilterInput({
  label,
  onChange,
  value,
  type = "text",
  min,
  max,
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
  type?: string;
  min?: string;
  max?: string;
}): JSX.Element {
  const id = useId();

  return (
    <div className="grid gap-2">
      <Label className="app-text text-sm font-bold" htmlFor={id}>
        {label}
      </Label>
      <Input
        aria-label={label}
        id={id}
        max={max}
        min={min}
        onChange={(event) => onChange(event.target.value)}
        placeholder={label}
        type={type}
        value={value}
      />
    </div>
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
  const id = useId();

  return (
    <div className="grid gap-2">
      <Label className="app-text text-sm font-bold" htmlFor={id}>
        {label}
      </Label>
      <Select
        allowEmpty
        ariaLabel={label}
        disabled={disabled}
        emptyOptionLabel="Все"
        id={id}
        onValueChange={onValueChange}
        options={options}
        placeholder="Все"
        value={value}
      />
    </div>
  );
}

function countActive(values: Record<string, string>): number {
  return Object.values(values).filter((value) => value.trim()).length;
}
