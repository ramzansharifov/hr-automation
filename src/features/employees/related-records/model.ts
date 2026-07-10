import type { TFunction } from "i18next";

import { formatDate } from "../../../shared/lib/format";
import type { HrRecord } from "../../../shared/types/hr";

export interface EducationFormValues {
  education_type: string;
  education_degree: string;
  institution_name: string;
  speciality: string;
  started_at: string;
  ended_at: string;
  document_number: string;
  note: string;
}

export interface ExperienceFormValues {
  company_name: string;
  position_name: string;
  started_at: string;
  ended_at: string;
  is_current: string;
  responsibilities: string;
  note: string;
}

export const educationDefaults: EducationFormValues = {
  education_type: "university",
  education_degree: "bachelor",
  institution_name: "",
  speciality: "",
  started_at: "",
  ended_at: "",
  document_number: "",
  note: "",
};

export const experienceDefaults: ExperienceFormValues = {
  company_name: "",
  position_name: "",
  started_at: "",
  ended_at: "",
  is_current: "0",
  responsibilities: "",
  note: "",
};

export function validateEducation(
  values: EducationFormValues,
  t: TFunction,
): string {
  if (!values.institution_name.trim()) return t("forms.validation.required");

  if (
    values.education_type === "university" &&
    !values.education_degree.trim()
  ) {
    return t("forms.validation.required");
  }

  return hasInvalidDateRange(values.started_at, values.ended_at)
    ? t("forms.validation.dateRange")
    : "";
}

export function validateExperience(
  values: ExperienceFormValues,
  t: TFunction,
): string {
  if (!values.company_name.trim() || !values.position_name.trim()) {
    return t("forms.validation.required");
  }

  return values.is_current !== "1" &&
    hasInvalidDateRange(values.started_at, values.ended_at)
    ? t("forms.validation.dateRange")
    : "";
}

export function mapEducationFormToRecord(
  employeeId: number,
  values: EducationFormValues,
): HrRecord {
  return {
    employee_id: employeeId,
    education_type: values.education_type,
    education_degree:
      values.education_type === "university"
        ? nullableString(values.education_degree)
        : null,
    institution_name: values.institution_name.trim(),
    speciality: nullableString(values.speciality),
    started_at: nullableString(values.started_at),
    ended_at: nullableString(values.ended_at),
    document_number: nullableString(values.document_number),
    note: nullableString(values.note),
  };
}

export function mapExperienceFormToRecord(
  employeeId: number,
  values: ExperienceFormValues,
): HrRecord {
  return {
    employee_id: employeeId,
    company_name: values.company_name.trim(),
    position_name: values.position_name.trim(),
    started_at: nullableString(values.started_at),
    ended_at:
      values.is_current === "1" ? null : nullableString(values.ended_at),
    is_current: Number(values.is_current),
    responsibilities: nullableString(values.responsibilities),
    note: nullableString(values.note),
  };
}

export function getEducationTypeLabel(value: string, t: TFunction): string {
  if (value === "school") return t("employeesDetails.education.types.school");
  if (value === "university")
    return t("employeesDetails.education.types.university");

  return valueOrEmpty(value, t);
}

export function getEducationDegreeLabel(value: string, t: TFunction): string {
  const translationKey = `employeesDetails.education.degrees.${value}`;
  const translated = t(translationKey);

  return translated === translationKey ? valueOrEmpty(value, t) : translated;
}

export function getRecordId(record: HrRecord | null): number | null {
  const id = Number(record?.id);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export function getString(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

export function formatRelatedDate(
  value: unknown,
  locale: string,
  t: TFunction,
): string {
  return value ? formatDate(value, locale) : t("employeesDetails.emptyValue");
}

export function valueOrEmpty(value: string, t: TFunction): string {
  return value.trim() || t("employeesDetails.emptyValue");
}

function nullableString(value: string): string | null {
  const trimmedValue = value.trim();
  return trimmedValue === "" ? null : trimmedValue;
}

function hasInvalidDateRange(startedAt: string, endedAt: string): boolean {
  if (!startedAt || !endedAt) return false;

  const startTime = new Date(`${startedAt}T00:00:00`).getTime();
  const endTime = new Date(`${endedAt}T00:00:00`).getTime();

  return (
    Number.isFinite(startTime) &&
    Number.isFinite(endTime) &&
    endTime < startTime
  );
}
