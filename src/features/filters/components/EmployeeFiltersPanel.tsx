import type { FormEvent, ReactNode } from "react";
import { useState } from "react";
import {
  FiBriefcase,
  FiFilter,
  FiRotateCcw,
  FiSearch,
  FiUser,
} from "react-icons/fi";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";

import { Button, Input, Select, type SelectOption } from "../../../shared/ui";
import { useEmployeeFormOptions } from "../../employees/hooks/useEmployeeFormOptions";
import {
  clearStoredEmployeeFilterValues,
  emptyEmployeeFilters,
  getStoredEmployeeFilterValues,
  setStoredEmployeeFilterValues,
  type EmployeeFilterValues,
} from "../employeeFiltersStore";

interface EmployeeFiltersPanelProps {
  className?: string;
}

export function EmployeeFiltersPanel({
  className = "",
}: EmployeeFiltersPanelProps): JSX.Element {
  const { t } = useTranslation();
  const [draftFilters, setDraftFilters] = useState<EmployeeFilterValues>(
    getStoredEmployeeFilterValues,
  );
  const {
    departments,
    genderOptions,
    isRelationsLoading,
    positions,
    statusOptions,
  } = useEmployeeFormOptions();
  const activeFilterCount = Object.values(draftFilters).filter((value) =>
    value.trim(),
  ).length;

  function updateFilter(name: keyof EmployeeFilterValues, value: string): void {
    setDraftFilters((current) => ({ ...current, [name]: value }));
  }

  function handleSearch(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setStoredEmployeeFilterValues(draftFilters);
    toast.success(t("filtersPage.toasts.applied"));
  }

  function handleClear(): void {
    setDraftFilters(emptyEmployeeFilters);
    clearStoredEmployeeFilterValues();
    toast.success(t("filtersPage.toasts.cleared"));
  }

  return (
    <div className={["space-y-6", className].join(" ")}>
      <section className="app-accent-gradient-panel flex flex-col gap-5 overflow-hidden rounded-[28px] border p-6 sm:p-7 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-white backdrop-blur">
            <FiFilter className="h-6 w-6" />
          </span>
          <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
            {t("filtersPage.title")}
          </h1>
        </div>
        <span className="inline-flex h-10 items-center rounded-full border border-white/15 bg-white/10 px-4 text-sm font-black text-white">
          {t("filtersPage.activeCount", { count: activeFilterCount })}
        </span>
      </section>

      <form
        className="app-surface app-border mx-auto overflow-hidden rounded-[28px] border"
        onSubmit={handleSearch}
      >
        <div className="grid gap-5 p-5 sm:p-6 xl:grid-cols-2">
          <FilterSection
            icon={<FiUser className="h-5 w-5" />}
            title={t("employeesDetails.sections.personal")}
          >
            <FilterInput
              label={t("forms.fields.lastName")}
              onChange={(value) => updateFilter("last_name", value)}
              value={draftFilters.last_name}
            />
            <FilterInput
              label={t("forms.fields.firstName")}
              onChange={(value) => updateFilter("first_name", value)}
              value={draftFilters.first_name}
            />
            <FilterInput
              label={t("forms.fields.middleName")}
              onChange={(value) => updateFilter("middle_name", value)}
              value={draftFilters.middle_name}
            />
            <FilterInput
              label={t("forms.fields.phone")}
              onChange={(value) => updateFilter("phone", value)}
              value={draftFilters.phone}
            />
            <FilterInput
              label={t("forms.fields.email")}
              onChange={(value) => updateFilter("email", value)}
              value={draftFilters.email}
            />
            <FilterSelect
              label={t("forms.fields.gender")}
              onValueChange={(value) => updateFilter("gender", value)}
              options={genderOptions}
              value={draftFilters.gender}
            />
          </FilterSection>

          <FilterSection
            icon={<FiBriefcase className="h-5 w-5" />}
            title={t("employeesDetails.sections.company")}
          >
            <FilterSelect
              disabled={isRelationsLoading}
              label={t("forms.fields.departmentId")}
              onValueChange={(value) => updateFilter("department_id", value)}
              options={departments}
              value={draftFilters.department_id}
            />
            <FilterSelect
              disabled={isRelationsLoading}
              label={t("forms.fields.positionId")}
              onValueChange={(value) => updateFilter("position_id", value)}
              options={positions}
              value={draftFilters.position_id}
            />
            <FilterSelect
              label={t("forms.fields.status")}
              onValueChange={(value) => updateFilter("status", value)}
              options={statusOptions}
              value={draftFilters.status}
            />
          </FilterSection>
        </div>

        <footer className="app-surface-muted app-border-soft flex flex-col gap-3 border-t p-5 sm:flex-row sm:justify-end sm:p-6">
          <Button
            leftIcon={<FiRotateCcw className="h-4 w-4" />}
            onClick={handleClear}
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
            Применить фильтры
          </Button>
        </footer>
      </form>
    </div>
  );
}

function FilterInput({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
}): JSX.Element {
  return (
    <label className="block">
      <span className="app-text mb-2 block text-sm font-bold">{label}</span>
      <Input
        aria-label={label}
        onChange={(event) => onChange(event.target.value)}
        placeholder={label}
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
  const { t } = useTranslation();

  return (
    <label className="block">
      <span className="app-text mb-2 block text-sm font-bold">{label}</span>
      <Select
        allowEmpty
        ariaLabel={label}
        disabled={disabled}
        emptyOptionLabel={t("forms.placeholders.emptyOption")}
        onValueChange={onValueChange}
        options={options}
        placeholder={label}
        value={value}
      />
    </label>
  );
}

function FilterSection({
  children,
  icon,
  title,
}: {
  children: ReactNode;
  icon: ReactNode;
  title: string;
}): JSX.Element {
  return (
    <section className="app-surface-muted app-border rounded-[24px] border p-5 sm:p-6">
      <header className="flex items-center gap-3.5">
        <span className="app-accent-soft flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border">
          {icon}
        </span>
        <h2 className="app-text text-lg font-black tracking-tight">{title}</h2>
      </header>
      <div className="app-border-soft mt-5 grid gap-4 border-t pt-5 md:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3">
        {children}
      </div>
    </section>
  );
}
