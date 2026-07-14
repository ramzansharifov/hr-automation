import type {
  HrFilterCondition,
  HrRecord,
} from "../../shared/types/hr";

export interface EnterpriseFilterValues {
  name: string;
  legal_name: string;
  phone: string;
  email: string;
}

export interface VacancyFilterValues {
  status: string;
  employment_type: string;
  enterprise_name: string;
  department_name: string;
  position_name: string;
}

export interface CandidateFilterValues {
  status: string;
  source: string;
  vacancy_id: string;
  min_match: string;
}

export const ENTERPRISE_FILTERS_EVENT = "hr-enterprise-filters-change";
export const VACANCY_FILTERS_EVENT = "hr-vacancy-filters-change";
export const CANDIDATE_FILTERS_EVENT = "hr-candidate-filters-change";

const ENTERPRISE_STORAGE_KEY = "hr-enterprise-filters";
const VACANCY_STORAGE_KEY = "hr-vacancy-filters";
const CANDIDATE_STORAGE_KEY = "hr-candidate-filters";

export const emptyEnterpriseFilters: EnterpriseFilterValues = {
  name: "",
  legal_name: "",
  phone: "",
  email: "",
};

export const emptyVacancyFilters: VacancyFilterValues = {
  status: "",
  employment_type: "",
  enterprise_name: "",
  department_name: "",
  position_name: "",
};

export const emptyCandidateFilters: CandidateFilterValues = {
  status: "",
  source: "",
  vacancy_id: "",
  min_match: "",
};

export function getStoredEnterpriseFilterValues(): EnterpriseFilterValues {
  return readStoredValues(ENTERPRISE_STORAGE_KEY, emptyEnterpriseFilters);
}

export function setStoredEnterpriseFilterValues(
  values: EnterpriseFilterValues,
): void {
  writeStoredValues(ENTERPRISE_STORAGE_KEY, ENTERPRISE_FILTERS_EVENT, values);
}

export function clearStoredEnterpriseFilterValues(): void {
  clearStoredValues(
    ENTERPRISE_STORAGE_KEY,
    ENTERPRISE_FILTERS_EVENT,
    emptyEnterpriseFilters,
  );
}

export function getStoredEnterpriseHrFilters():
  | Record<string, HrFilterCondition>
  | undefined {
  const values = getStoredEnterpriseFilterValues();
  const filters: Record<string, HrFilterCondition> = {};

  (Object.keys(values) as Array<keyof EnterpriseFilterValues>).forEach((key) => {
    const value = values[key].trim();
    if (value) filters[key] = { operator: "contains", value };
  });

  return Object.keys(filters).length > 0 ? filters : undefined;
}

export function getStoredVacancyFilterValues(): VacancyFilterValues {
  return readStoredValues(VACANCY_STORAGE_KEY, emptyVacancyFilters);
}

export function setStoredVacancyFilterValues(values: VacancyFilterValues): void {
  writeStoredValues(VACANCY_STORAGE_KEY, VACANCY_FILTERS_EVENT, values);
}

export function clearStoredVacancyFilterValues(): void {
  clearStoredValues(VACANCY_STORAGE_KEY, VACANCY_FILTERS_EVENT, emptyVacancyFilters);
}

export function getStoredCandidateFilterValues(): CandidateFilterValues {
  return readStoredValues(CANDIDATE_STORAGE_KEY, emptyCandidateFilters);
}

export function setStoredCandidateFilterValues(
  values: CandidateFilterValues,
): void {
  writeStoredValues(CANDIDATE_STORAGE_KEY, CANDIDATE_FILTERS_EVENT, values);
}

export function clearStoredCandidateFilterValues(): void {
  clearStoredValues(
    CANDIDATE_STORAGE_KEY,
    CANDIDATE_FILTERS_EVENT,
    emptyCandidateFilters,
  );
}

export function filterVacancies(
  rows: HrRecord[],
  values: VacancyFilterValues,
): HrRecord[] {
  return rows.filter((row) => {
    if (values.status && String(row.status) !== values.status) return false;
    if (
      values.employment_type &&
      String(row.employment_type) !== values.employment_type
    ) {
      return false;
    }
    if (!contains(row.enterprise_name, values.enterprise_name)) return false;
    if (!contains(row.department_name, values.department_name)) return false;
    if (!contains(row.position_name, values.position_name)) return false;
    return true;
  });
}

export function filterCandidates(
  rows: HrRecord[],
  values: CandidateFilterValues,
): HrRecord[] {
  const minMatch = values.min_match ? Number(values.min_match) : null;

  return rows.filter((row) => {
    if (values.status && String(row.status) !== values.status) return false;
    if (!contains(row.source, values.source)) return false;
    if (values.vacancy_id && String(row.vacancy_id) !== values.vacancy_id) {
      return false;
    }
    if (
      minMatch !== null &&
      Number.isFinite(minMatch) &&
      Number(row.match_percentage ?? 0) < minMatch
    ) {
      return false;
    }
    return true;
  });
}

function contains(value: unknown, query: string): boolean {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return true;
  return String(value ?? "").toLocaleLowerCase().includes(normalizedQuery);
}

function readStoredValues<T extends Record<string, string>>(
  key: string,
  fallback: T,
): T {
  if (typeof window === "undefined") return fallback;
  const stored = window.localStorage.getItem(key);
  if (!stored) return fallback;

  try {
    const parsed = JSON.parse(stored) as Record<string, unknown>;
    const isValid = Object.keys(fallback).every(
      (field) => typeof parsed[field] === "string",
    );
    return isValid ? (parsed as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeStoredValues<T extends Record<string, string>>(
  key: string,
  eventName: string,
  values: T,
): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(values));
  window.dispatchEvent(new CustomEvent(eventName, { detail: values }));
}

function clearStoredValues<T extends Record<string, string>>(
  key: string,
  eventName: string,
  emptyValues: T,
): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(key);
  window.dispatchEvent(new CustomEvent(eventName, { detail: emptyValues }));
}
