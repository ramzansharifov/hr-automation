import type { ReactNode } from "react";
import type { TFunction } from "i18next";
import type { HrEntityKey, HrRecord } from "../../shared/types/hr";
import {
  formatCellValue,
  formatCurrency,
  formatDate,
  humanizeStatus,
} from "../../shared/lib/format";

export interface HrEntityColumn {
  key: string;
  label: string;
  className?: string;
  render?: (record: HrRecord) => ReactNode;
}

export interface HrEntityPageConfig {
  entity: HrEntityKey;
  title: string;
  description: string;
  createLabel: string;
  defaultOrderBy: string;
  columns: HrEntityColumn[];
}

type HrEntityColumnFormat = "money" | "date" | "status" | "fullName" | "yesNo";

interface HrEntityColumnDefinition {
  key: string;
  labelKey: string;
  className?: string;
  format?: HrEntityColumnFormat;
}

interface HrEntityPageConfigDefinition {
  entity: HrEntityKey;
  titleKey: string;
  descriptionKey: string;
  createLabelKey: string;
  defaultOrderBy: string;
  columns: HrEntityColumnDefinition[];
}

const hrEntityConfigDefinitions: Record<HrEntityKey, HrEntityPageConfigDefinition> = {
  enterprises: {
    entity: "enterprises",
    titleKey: "entities.enterprises.title",
    descriptionKey: "entities.enterprises.description",
    createLabelKey: "entities.enterprises.createLabel",
    defaultOrderBy: "name",
    columns: [
      { key: "legal_form", labelKey: "Категория", className: "font-bold" },
      { key: "name", labelKey: "entities.enterprises.columns.name", className: "min-w-[220px] font-bold" },
      { key: "legal_name", labelKey: "entities.enterprises.columns.legalName" },
      { key: "general_director_name", labelKey: "Руководитель" },
      { key: "phone", labelKey: "entities.enterprises.columns.phone" },
      { key: "email", labelKey: "entities.enterprises.columns.email" },
    ],
  },

  departments: {
    entity: "departments",
    titleKey: "entities.departments.title",
    descriptionKey: "entities.departments.description",
    createLabelKey: "entities.departments.createLabel",
    defaultOrderBy: "name",
    columns: [
      { key: "enterprise_name", labelKey: "entities.departments.columns.enterprise" },
      { key: "name", labelKey: "entities.departments.columns.name", className: "font-bold" },
      { key: "director_name", labelKey: "Руководитель" },
      { key: "phone", labelKey: "entities.departments.columns.phone" },
      { key: "email", labelKey: "entities.departments.columns.email" },
      { key: "location", labelKey: "entities.departments.columns.location" },
    ],
  },

  positions: {
    entity: "positions",
    titleKey: "entities.positions.title",
    descriptionKey: "entities.positions.description",
    createLabelKey: "entities.positions.createLabel",
    defaultOrderBy: "name",
    columns: [
      { key: "department_name", labelKey: "entities.positions.columns.department" },
      { key: "name", labelKey: "entities.positions.columns.name", className: "font-bold" },
      { key: "responsibilities", labelKey: "entities.positions.columns.responsibilities", className: "min-w-[320px]" },
    ],
  },

  employees: {
    entity: "employees",
    titleKey: "entities.employees.title",
    descriptionKey: "entities.employees.description",
    createLabelKey: "entities.employees.createLabel",
    defaultOrderBy: "last_name",
    columns: [
      { key: "last_name", labelKey: "entities.employees.columns.fullName", format: "fullName", className: "min-w-[240px] font-bold" },
      { key: "enterprise_name", labelKey: "Предприятие" },
      { key: "department_name", labelKey: "Отдел" },
      { key: "position_name", labelKey: "Должность" },
      { key: "hire_date", labelKey: "Дата приёма", format: "date" },
      { key: "status", labelKey: "entities.employees.columns.status", format: "status" },
    ],
  },

  employee_education: {
    entity: "employee_education",
    titleKey: "entities.employeeEducation.title",
    descriptionKey: "entities.employeeEducation.description",
    createLabelKey: "entities.employeeEducation.createLabel",
    defaultOrderBy: "started_at",
    columns: [
      { key: "institution_name", labelKey: "entities.employeeEducation.columns.institution" },
      { key: "education_degree", labelKey: "entities.employeeEducation.columns.degree" },
      { key: "speciality", labelKey: "entities.employeeEducation.columns.speciality" },
      { key: "started_at", labelKey: "entities.employeeEducation.columns.startedAt", format: "date" },
      { key: "ended_at", labelKey: "entities.employeeEducation.columns.endedAt", format: "date" },
    ],
  },

  employee_experience: {
    entity: "employee_experience",
    titleKey: "entities.employeeExperience.title",
    descriptionKey: "entities.employeeExperience.description",
    createLabelKey: "entities.employeeExperience.createLabel",
    defaultOrderBy: "started_at",
    columns: [
      { key: "company_name", labelKey: "entities.employeeExperience.columns.company" },
      { key: "position_name", labelKey: "entities.employeeExperience.columns.position" },
      { key: "started_at", labelKey: "entities.employeeExperience.columns.startedAt", format: "date" },
      { key: "ended_at", labelKey: "entities.employeeExperience.columns.endedAt", format: "date" },
    ],
  },

  employment_history: {
    entity: "employment_history",
    titleKey: "entities.employmentHistory.title",
    descriptionKey: "entities.employmentHistory.description",
    createLabelKey: "entities.employmentHistory.createLabel",
    defaultOrderBy: "effective_at",
    columns: [
      { key: "employee_name", labelKey: "entities.employmentHistory.columns.employee" },
      { key: "change_type", labelKey: "entities.employmentHistory.columns.changeType" },
      { key: "new_position_name", labelKey: "entities.employmentHistory.columns.position" },
      { key: "new_salary", labelKey: "entities.employmentHistory.columns.salary", format: "money" },
      { key: "effective_at", labelKey: "entities.employmentHistory.columns.effectiveAt", format: "date" },
      { key: "reason", labelKey: "entities.employmentHistory.columns.reason" },
    ],
  },

  vacation_types: {
    entity: "vacation_types",
    titleKey: "Виды отпусков",
    descriptionKey: "Справочник доступных видов отпусков.",
    createLabelKey: "Добавить вид отпуска",
    defaultOrderBy: "name",
    columns: [
      { key: "name", labelKey: "Название", className: "font-bold" },
      { key: "is_paid_default", labelKey: "Оплачиваемый", format: "yesNo" },
      { key: "is_active", labelKey: "Активен", format: "yesNo" },
    ],
  },

  vacations: {
    entity: "vacations",
    titleKey: "entities.vacations.title",
    descriptionKey: "entities.vacations.description",
    createLabelKey: "entities.vacations.createLabel",
    defaultOrderBy: "starts_at",
    columns: [
      { key: "employee_name", labelKey: "entities.vacations.columns.employee" },
      { key: "vacation_type_name", labelKey: "entities.vacations.columns.vacationType" },
      { key: "starts_at", labelKey: "entities.vacations.columns.startsAt", format: "date" },
      { key: "ends_at", labelKey: "entities.vacations.columns.endsAt", format: "date" },
      { key: "days_count", labelKey: "entities.vacations.columns.daysCount" },
      { key: "is_paid", labelKey: "entities.vacations.columns.isPaid", format: "yesNo" },
      { key: "status", labelKey: "entities.vacations.columns.status", format: "status" },
      { key: "approved_by_name", labelKey: "Согласовал" },
    ],
  },
};

function createColumnRender(
  column: HrEntityColumnDefinition,
  t: TFunction,
  locale: string,
): ((record: HrRecord) => ReactNode) | undefined {
  if (column.format === "fullName") {
    return (record) => {
      const fullName = [record.last_name, record.first_name, record.middle_name]
        .map((value) => String(value ?? "").trim())
        .filter(Boolean)
        .join(" ");
      return fullName || "—";
    };
  }
  if (column.format === "money") {
    return (record) => formatCurrency(record[column.key], locale);
  }
  if (column.format === "date") {
    return (record) => formatDate(record[column.key], locale);
  }
  if (column.format === "yesNo") {
    return (record) => Number(record[column.key]) === 1 ? "Да" : "Нет";
  }
  if (column.format === "status") {
    return (record) => {
      const value = String(record[column.key] ?? "");
      const custom: Record<string, string> = {
        terminated: "Уволен",
        planned: "Запланирован",
        approved: "Согласован",
        rejected: "Отклонён",
        completed: "Завершён",
      };
      return custom[value] ?? humanizeStatus(value, t);
    };
  }
  return undefined;
}

export function getEntityConfig(
  entity: HrEntityKey,
  t: TFunction,
  locale = "ru-RU",
): HrEntityPageConfig {
  const config = hrEntityConfigDefinitions[entity];
  return {
    entity: config.entity,
    title: t(config.titleKey),
    description: t(config.descriptionKey),
    createLabel: t(config.createLabelKey),
    defaultOrderBy: config.defaultOrderBy,
    columns: config.columns.map((column) => ({
      key: column.key,
      label: t(column.labelKey),
      className: column.className,
      render: createColumnRender(column, t, locale),
    })),
  };
}

export function renderCell(
  record: HrRecord,
  column: HrEntityColumn,
  locale = "ru-RU",
): ReactNode {
  if (column.render) return column.render(record);
  return formatCellValue(record[column.key], locale);
}
