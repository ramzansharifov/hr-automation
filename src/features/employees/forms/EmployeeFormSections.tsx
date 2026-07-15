import {
  Controller,
  type Control,
  type FieldErrors,
  type UseFormRegister,
} from "react-hook-form";
import type { TFunction } from "i18next";
import type { ReactNode } from "react";
import { useId } from "react";
import { FiBriefcase, FiFileText, FiHome, FiUser } from "react-icons/fi";
import {
  FieldError,
  Input,
  Label,
  Select,
  Textarea,
  type SelectOption,
} from "../../../shared/ui";
import type { EmployeeFormValues } from "../types";

export interface EmployeeFormSectionCommonProps {
  control: Control<EmployeeFormValues>;
  errors: FieldErrors<EmployeeFormValues>;
  register: UseFormRegister<EmployeeFormValues>;
  t: TFunction;
}

export interface EmployeePersonalFormSectionProps extends EmployeeFormSectionCommonProps {
  genderOptions: SelectOption[];
  normalizeField: (name: keyof EmployeeFormValues) => void;
}

export interface EmployeeAddressFormSectionProps extends EmployeeFormSectionCommonProps {}

export interface EmployeeCompanyFormSectionProps extends EmployeeFormSectionCommonProps {
  departments: SelectOption[];
  isRelationsLoading: boolean;
  positions: SelectOption[];
  statusOptions: SelectOption[];
}

export interface EmployeeNotesFormSectionProps extends EmployeeFormSectionCommonProps {}

export function EmployeePersonalFormSection({
  control,
  errors,
  genderOptions,
  normalizeField,
  register,
  t,
}: EmployeePersonalFormSectionProps): JSX.Element {
  return (
    <FormCard
      description={t("employeesCreate.stepDescriptions.personal")}
      icon={<FiUser className="h-5 w-5" />}
      title={t("employeesCreate.steps.personal")}
    >
      <TextField
        error={getError("last_name", errors, t)}
        label={t("forms.fields.lastName")}
        registration={register("last_name", {
          onBlur: () => normalizeField("last_name"),
        })}
        required
      />
      <TextField
        error={getError("first_name", errors, t)}
        label={t("forms.fields.firstName")}
        registration={register("first_name", {
          onBlur: () => normalizeField("first_name"),
        })}
        required
      />
      <TextField
        error={getError("middle_name", errors, t)}
        label={t("forms.fields.middleName")}
        registration={register("middle_name", {
          onBlur: () => normalizeField("middle_name"),
        })}
      />
      <TextField
        error={getError("birth_date", errors, t)}
        label={t("forms.fields.birthDate")}
        registration={register("birth_date")}
        type="date"
      />
      <SelectField
        control={control}
        error={getError("gender", errors, t)}
        label={t("forms.fields.gender")}
        name="gender"
        options={genderOptions}
        placeholder={t("forms.placeholders.select")}
      />
      <TextField
        error={getError("phone", errors, t)}
        label={t("forms.fields.phone")}
        registration={register("phone", {
          onBlur: () => normalizeField("phone"),
        })}
        type="tel"
      />
      <TextField
        error={getError("email", errors, t)}
        label={t("forms.fields.email")}
        registration={register("email", {
          onBlur: () => normalizeField("email"),
        })}
        type="email"
      />
    </FormCard>
  );
}

export function EmployeeAddressFormSection({
  errors,
  register,
  t,
}: EmployeeAddressFormSectionProps): JSX.Element {
  return (
    <FormCard
      description={t("employeesCreate.stepDescriptions.address")}
      icon={<FiHome className="h-5 w-5" />}
      title={t("employeesCreate.steps.address")}
    >
      <TextField
        error={getError("address_country", errors, t)}
        label={t("forms.fields.addressCountry")}
        registration={register("address_country")}
      />
      <TextField
        error={getError("address_city", errors, t)}
        label={t("forms.fields.addressCity")}
        registration={register("address_city")}
      />
      <TextField
        error={getError("address_street", errors, t)}
        label={t("forms.fields.addressStreet")}
        registration={register("address_street")}
      />
      <TextField
        error={getError("address_house", errors, t)}
        label={t("forms.fields.addressHouse")}
        registration={register("address_house")}
      />
      <TextField
        error={getError("address_apartment", errors, t)}
        label={t("forms.fields.addressApartment")}
        registration={register("address_apartment")}
      />
      <TextareaField
        error={getError("address", errors, t)}
        label={t("forms.fields.address")}
        registration={register("address")}
      />
    </FormCard>
  );
}

export function EmployeeCompanyFormSection({
  control,
  departments,
  errors,
  isRelationsLoading,
  positions,
  register,
  statusOptions,
  t,
}: EmployeeCompanyFormSectionProps): JSX.Element {
  return (
    <FormCard
      description={t("employeesCreate.stepDescriptions.company")}
      icon={<FiBriefcase className="h-5 w-5" />}
      title={t("employeesCreate.steps.company")}
    >
      <SelectField
        control={control}
        disabled={isRelationsLoading}
        error={getError("department_id", errors, t)}
        label={t("forms.fields.departmentId")}
        name="department_id"
        options={departments}
        placeholder={
          isRelationsLoading
            ? t("forms.placeholders.loadingOptions")
            : t("forms.placeholders.selectDepartment")
        }
        required
      />
      <SelectField
        control={control}
        disabled={isRelationsLoading}
        error={getError("position_id", errors, t)}
        label={t("forms.fields.positionId")}
        name="position_id"
        options={positions}
        placeholder={
          isRelationsLoading
            ? t("forms.placeholders.loadingOptions")
            : t("forms.placeholders.selectPosition")
        }
        required
      />
      <TextField
        error={getError("hire_date", errors, t)}
        label={t("forms.fields.hireDate")}
        registration={register("hire_date")}
        required
        type="date"
      />
      <SelectField
        control={control}
        error={getError("status", errors, t)}
        label={t("forms.fields.status")}
        name="status"
        options={statusOptions}
        placeholder={t("forms.placeholders.select")}
        required
      />
      <TextField
        error={getError("salary", errors, t)}
        label={t("forms.fields.salary")}
        min={0}
        registration={register("salary")}
        required
        type="number"
      />
    </FormCard>
  );
}

export function EmployeeNotesFormSection({
  errors,
  register,
  t,
}: EmployeeNotesFormSectionProps): JSX.Element {
  return (
    <FormCard
      description={t("employeesCreate.stepDescriptions.notes")}
      icon={<FiFileText className="h-5 w-5" />}
      title={t("forms.fields.note")}
    >
      <TextareaField
        error={getError("note", errors, t)}
        label={t("forms.fields.note")}
        registration={register("note")}
      />
    </FormCard>
  );
}

interface FormCardProps {
  children: ReactNode;
  description: string;
  icon: ReactNode;
  title: string;
}

function FormCard({
  children,
  description,
  icon,
  title,
}: FormCardProps): JSX.Element {
  return (
    <section className="app-surface-muted app-border rounded-[24px] border p-5 sm:p-6">
      <header className="flex items-start gap-3.5">
        <span className="app-accent-soft flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[var(--accent-border)]">
          {icon}
        </span>
        <div className="min-w-0">
          <h2 className="app-text text-lg font-black tracking-tight">
            {title}
          </h2>
          <p className="app-muted mt-1 text-sm leading-5">{description}</p>
        </div>
      </header>
      <div className="app-border-soft mt-5 grid gap-4 border-t pt-5 md:grid-cols-2">
        {children}
      </div>
    </section>
  );
}

interface TextFieldProps {
  error?: string;
  label: string;
  min?: number;
  registration: ReturnType<UseFormRegister<EmployeeFormValues>>;
  required?: boolean;
  type?: string;
}

function TextField({
  error,
  label,
  min,
  registration,
  required = false,
  type = "text",
}: TextFieldProps): JSX.Element {
  const id = useId();

  return (
    <div className="block">
      <Label className="app-text mb-2 block text-sm font-bold" htmlFor={id}>
        {label}
        {required && <span className="text-rose-500"> *</span>}
      </Label>
      <Input
        id={id}
        invalid={Boolean(error)}
        min={min}
        type={type}
        {...registration}
      />
      <FieldError message={error} />
    </div>
  );
}

interface TextareaFieldProps {
  error?: string;
  label: string;
  registration: ReturnType<UseFormRegister<EmployeeFormValues>>;
}

function TextareaField({
  error,
  label,
  registration,
}: TextareaFieldProps): JSX.Element {
  const id = useId();

  return (
    <div className="block md:col-span-2">
      <Label className="app-text mb-2 block text-sm font-bold" htmlFor={id}>
        {label}
      </Label>
      <Textarea id={id} {...registration} />
      <FieldError message={error} />
    </div>
  );
}

interface SelectFieldProps {
  control: Control<EmployeeFormValues>;
  disabled?: boolean;
  error?: string;
  label: string;
  name: keyof EmployeeFormValues;
  options: SelectOption[];
  placeholder: string;
  required?: boolean;
}

function SelectField({
  control,
  disabled = false,
  error,
  label,
  name,
  options,
  placeholder,
  required = false,
}: SelectFieldProps): JSX.Element {
  const allowEmpty = !required;
  const id = useId();

  return (
    <div className="block">
      <Label className="app-text mb-2 block text-sm font-bold" htmlFor={id}>
        {label}
        {required && <span className="text-rose-500"> *</span>}
      </Label>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <Select
            allowEmpty={allowEmpty}
            disabled={disabled}
            emptyOptionLabel="Не выбрано"
            id={id}
            invalid={Boolean(error)}
            name={field.name}
            onBlur={field.onBlur}
            onValueChange={field.onChange}
            options={options}
            placeholder={placeholder}
            value={field.value}
          />
        )}
      />
      <FieldError message={error} />
    </div>
  );
}

function getError(
  name: keyof EmployeeFormValues,
  errors: FieldErrors<EmployeeFormValues>,
  t: TFunction,
): string | undefined {
  const message = errors[name]?.message;

  return typeof message === "string" ? t(message) : undefined;
}
