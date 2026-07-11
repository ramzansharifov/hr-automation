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
    setDraftFilters((current) => ({
      ...current,
      [name]: value,
    }));
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
    <section
      className={[
        "app-surface app-border mx-auto max-w-6xl overflow-hidden rounded-[28px] border",
        className,
      ].join(" ")}
    >
      <div className="app-surface-muted app-border-soft flex flex-col gap-4 border-b px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-start gap-4">
          <span className="app-accent-soft flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[var(--accent-border)]">
            <FiFilter className="h-5 w-5" />
          </span>
          <div>
            <h1 className="app-text text-2xl font-black tracking-tight">
              {t("filtersPage.title")}
            </h1>
            <p className="app-muted mt-1 max-w-2xl text-sm leading-6">
              {t("filtersPage.formDescription")}
            </p>
          </div>
        </div>
        <span className="app-surface app-muted inline-flex h-9 items-center rounded-xl border px-3 text-xs font-black">
          {t("filtersPage.activeCount", { count: activeFilterCount })}
        </span>
      </div>

      <form className="space-y-5 p-5 sm:p-6" onSubmit={handleSearch}>
        <FilterSection
          description={t("filtersPage.sections.personalDescription")}
          icon={<FiUser className="h-5 w-5" />}
          title={t("employeesDetails.sections.personal")}
        >
          <FilterInput
            label={t("forms.fields.lastName")}
            value={draftFilters.last_name}
            onChange={(value) => updateFilter("last_name", value)}
          />
          <FilterInput
            label={t("forms.fields.firstName")}
            value={draftFilters.first_name}
            onChange={(value) => updateFilter("first_name", value)}
          />
          <FilterInput
            label={t("forms.fields.middleName")}
            value={draftFilters.middle_name}
            onChange={(value) => updateFilter("middle_name", value)}
          />
          <FilterInput
            label={t("forms.fields.phone")}
            value={draftFilters.phone}
            onChange={(value) => updateFilter("phone", value)}
          />
          <FilterInput
            label={t("forms.fields.email")}
            value={draftFilters.email}
            onChange={(value) => updateFilter("email", value)}
          />
          <FilterSelect
            label={t("forms.fields.gender")}
            options={genderOptions}
            value={draftFilters.gender}
            onValueChange={(value) => updateFilter("gender", value)}
          />
        </FilterSection>

        <FilterSection
          description={t("filtersPage.sections.companyDescription")}
          icon={<FiBriefcase className="h-5 w-5" />}
          title={t("employeesDetails.sections.company")}
        >
          <FilterSelect
            disabled={isRelationsLoading}
            label={t("forms.fields.departmentId")}
            options={departments}
            value={draftFilters.department_id}
            onValueChange={(value) => updateFilter("department_id", value)}
          />
          <FilterSelect
            disabled={isRelationsLoading}
            label={t("forms.fields.positionId")}
            options={positions}
            value={draftFilters.position_id}
            onValueChange={(value) => updateFilter("position_id", value)}
          />
          <FilterSelect
            label={t("forms.fields.status")}
            options={statusOptions}
            value={draftFilters.status}
            onValueChange={(value) => updateFilter("status", value)}
          />
        </FilterSection>

        <div className="app-border-soft flex flex-col gap-3 border-t pt-5 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="secondary"
            onClick={handleClear}
            leftIcon={<FiRotateCcw className="h-4 w-4" />}
          >
            Очистить
          </Button>
          <Button
            type="submit"
            variant="primary"
            leftIcon={<FiSearch className="h-4 w-4" />}
          >
            Применить фильтры
          </Button>
        </div>
      </form>
    </section>
  );
}

interface FilterInputProps {
  label: string;
  onChange: (value: string) => void;
  value: string;
}

function FilterInput({
  label,
  onChange,
  value,
}: FilterInputProps): JSX.Element {
  return (
    <label className="block">
      <span className="app-text mb-2 block text-sm font-bold">{label}</span>
      <Input
        aria-label={label}
        placeholder={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

interface FilterSelectProps {
  disabled?: boolean;
  label: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  value: string;
}

function FilterSelect({
  disabled = false,
  label,
  onValueChange,
  options,
  value,
}: FilterSelectProps): JSX.Element {
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
  description,
  icon,
  title,
}: {
  children: ReactNode;
  description: string;
  icon: ReactNode;
  title: string;
}): JSX.Element {
  return (
    <section className="app-surface-muted app-border rounded-[24px] border p-5 sm:p-6">
      <header className="flex items-start gap-3.5">
        <span className="app-accent-soft flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl">
          {icon}
        </span>
        <div>
          <h2 className="app-text text-lg font-black tracking-tight">
            {title}
          </h2>
          <p className="app-muted mt-1 text-sm leading-5">{description}</p>
        </div>
      </header>
      <div className="app-border-soft mt-5 grid gap-4 border-t pt-5 md:grid-cols-2 xl:grid-cols-3">
        {children}
      </div>
    </section>
  );
}
