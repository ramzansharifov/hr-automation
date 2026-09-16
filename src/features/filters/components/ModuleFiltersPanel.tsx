import type { FormEvent, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  FiBriefcase,
  FiClipboard,
  FiLayers,
  FiUsers,
} from "react-icons/fi";
import { toast } from "react-toastify";

import { useAppText } from "../../../shared/i18n";
import { hrApiClient } from "../../../shared/lib/hrApiClient";
import {
  ActionButton,
  Input,
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

export function ModuleFiltersPanel(): JSX.Element {
  const text = useAppText();
  const moduleTabs: Array<{
    id: FilterModule;
    label: string;
    icon: typeof FiUsers;
  }> = [
    { id: "employees", label: text("Сотрудники", "Employees"), icon: FiUsers },
    { id: "enterprises", label: text("Предприятия", "Enterprises"), icon: FiLayers },
    { id: "vacancies", label: text("Вакансии", "Vacancies"), icon: FiBriefcase },
    { id: "candidates", label: text("Кандидаты", "Candidates"), icon: FiClipboard },
  ];
  const vacancyStatusOptions: SelectOption[] = [
    { value: "open", label: text("Открыта", "Open") },
    { value: "draft", label: text("Черновик", "Draft") },
    { value: "paused", label: text("Приостановлена", "Paused") },
    { value: "closed", label: text("Закрыта", "Closed") },
  ];
  const employmentTypeOptions: SelectOption[] = [
    { value: "full_time", label: text("Полная занятость", "Full-time") },
    { value: "part_time", label: text("Частичная занятость", "Part-time") },
    { value: "temporary", label: text("Временная работа", "Temporary") },
    { value: "internship", label: text("Стажировка", "Internship") },
  ];
  const candidateStatusOptions: SelectOption[] = [
    { value: "new", label: text("Новый", "New") },
    { value: "screening", label: text("Первичный отбор", "Screening") },
    { value: "interview", label: text("Собеседование", "Interview") },
    { value: "offer", label: text("Оффер", "Offer") },
    { value: "hired", label: text("Принят на работу", "Hired") },
    { value: "rejected", label: text("Отклонён", "Rejected") },
  ];
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
        if (isActive) toast.error(text("Не удалось загрузить список вакансий", "Failed to load vacancies"));
      });
    return () => {
      isActive = false;
    };
  }, [text]);

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

    toast.success(text("Фильтры применены", "Filters applied"));
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

    toast.success(text("Фильтры очищены", "Filters cleared"));
  }

  return (
    <section className="app-surface app-border overflow-hidden rounded-[28px] border">
      <div className="app-border-soft overflow-x-auto border-b p-3 sm:p-4">
        <div className="flex min-w-max gap-2">
          {moduleTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeModule === tab.id;
            const count = activeCounts[tab.id];
            return (
              <button
                className={[
                  "flex h-11 items-center gap-2 rounded-2xl border px-4 text-sm font-black transition",
                  isActive
                    ? "border-[var(--accent-border)] bg-[var(--accent)] text-white shadow-lg"
                    : "app-button-secondary",
                ].join(" ")}
                key={tab.id}
                onClick={() => setActiveModule(tab.id)}
                type="button"
              >
                <Icon className="h-4 w-4" />
                {tab.label}
                {count > 0 && (
                  <span
                    className={[
                      "rounded-full px-2 py-0.5 text-[11px]",
                      isActive ? "bg-white/20 text-white" : "app-accent-soft",
                    ].join(" ")}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <form className="p-5 sm:p-7" onSubmit={applyFilters}>
        {activeModule === "employees" && (
          <FilterGrid>
            <FilterInput
              label={text("Фамилия", "Last name")}
              onChange={(value) =>
                setEmployeeFilters((current) => ({ ...current, last_name: value }))
              }
              value={employeeFilters.last_name}
            />
            <FilterInput
              label={text("Имя", "First name")}
              onChange={(value) =>
                setEmployeeFilters((current) => ({ ...current, first_name: value }))
              }
              value={employeeFilters.first_name}
            />
            <FilterInput
              label={text("Отчество", "Middle name")}
              onChange={(value) =>
                setEmployeeFilters((current) => ({ ...current, middle_name: value }))
              }
              value={employeeFilters.middle_name}
            />
            <FilterInput
              label={text("Телефон", "Phone")}
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
              label={text("Отдел", "Department")}
              onValueChange={(value) =>
                setEmployeeFilters((current) => ({ ...current, department_id: value }))
              }
              options={departments}
              value={employeeFilters.department_id}
            />
            <FilterSelect
              disabled={isRelationsLoading}
              label={text("Должность", "Position")}
              onValueChange={(value) =>
                setEmployeeFilters((current) => ({ ...current, position_id: value }))
              }
              options={positions}
              value={employeeFilters.position_id}
            />
            <FilterSelect
              label={text("Статус", "Status")}
              onValueChange={(value) =>
                setEmployeeFilters((current) => ({ ...current, status: value }))
              }
              options={statusOptions}
              value={employeeFilters.status}
            />
            <FilterSelect
              label={text("Пол", "Gender")}
              onValueChange={(value) =>
                setEmployeeFilters((current) => ({ ...current, gender: value }))
              }
              options={genderOptions}
              value={employeeFilters.gender}
            />
          </FilterGrid>
        )}

        {activeModule === "enterprises" && (
          <FilterGrid>
            <FilterInput
              label={text("Название", "Name")}
              onChange={(value) =>
                setEnterpriseFilters((current) => ({ ...current, name: value }))
              }
              value={enterpriseFilters.name}
            />
            <FilterInput
              label={text("Юридическое наименование", "Legal name")}
              onChange={(value) =>
                setEnterpriseFilters((current) => ({ ...current, legal_name: value }))
              }
              value={enterpriseFilters.legal_name}
            />
            <FilterInput
              label={text("Телефон", "Phone")}
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
        )}

        {activeModule === "vacancies" && (
          <FilterGrid>
            <FilterSelect
              label={text("Статус", "Status")}
              onValueChange={(value) =>
                setVacancyFilters((current) => ({ ...current, status: value }))
              }
              options={vacancyStatusOptions}
              value={vacancyFilters.status}
            />
            <FilterSelect
              label={text("Формат занятости", "Employment type")}
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
              label={text("Предприятие", "Enterprise")}
              onChange={(value) =>
                setVacancyFilters((current) => ({
                  ...current,
                  enterprise_name: value,
                }))
              }
              value={vacancyFilters.enterprise_name}
            />
            <FilterInput
              label={text("Отдел", "Department")}
              onChange={(value) =>
                setVacancyFilters((current) => ({
                  ...current,
                  department_name: value,
                }))
              }
              value={vacancyFilters.department_name}
            />
            <FilterInput
              label={text("Должность", "Position")}
              onChange={(value) =>
                setVacancyFilters((current) => ({
                  ...current,
                  position_name: value,
                }))
              }
              value={vacancyFilters.position_name}
            />
          </FilterGrid>
        )}

        {activeModule === "candidates" && (
          <FilterGrid>
            <FilterSelect
              label={text("Статус", "Status")}
              onValueChange={(value) =>
                setCandidateFilters((current) => ({ ...current, status: value }))
              }
              options={candidateStatusOptions}
              value={candidateFilters.status}
            />
            <FilterSelect
              label={text("Вакансия", "Vacancy")}
              onValueChange={(value) =>
                setCandidateFilters((current) => ({ ...current, vacancy_id: value }))
              }
              options={vacancyOptions}
              value={candidateFilters.vacancy_id}
            />
            <FilterInput
              label={text("Источник", "Source")}
              onChange={(value) =>
                setCandidateFilters((current) => ({ ...current, source: value }))
              }
              value={candidateFilters.source}
            />
            <FilterInput
              label={text("Минимальное соответствие, %", "Minimum match, %")}
              max="100"
              min="0"
              onChange={(value) =>
                setCandidateFilters((current) => ({ ...current, min_match: value }))
              }
              type="number"
              value={candidateFilters.min_match}
            />
          </FilterGrid>
        )}

        <div className="app-border-soft mt-7 flex flex-col gap-3 border-t pt-5 sm:flex-row sm:justify-end">
          <ActionButton action="reset" onClick={clearFilters} type="button">
            {text("Очистить", "Clear")}
          </ActionButton>
          <ActionButton action="search" type="submit">
            {text("Применить", "Apply")}
          </ActionButton>
        </div>
      </form>
    </section>
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
  return (
    <label className="grid gap-2">
      <span className="app-text text-sm font-bold">{label}</span>
      <Input
        aria-label={label}
        max={max}
        min={min}
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

function countActive(values: Record<string, string>): number {
  return Object.values(values).filter((value) => value.trim()).length;
}
