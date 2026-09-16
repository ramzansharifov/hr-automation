import type { TFunction } from "i18next";

import { formatDate, humanizeStatus } from "../../../shared/lib/format";
import { EmployeeInfoSection } from "../components/EmployeeInfoSection";
import type { EmployeeFormValues } from "../types";

interface EmployeeCreateReviewProps {
  departmentName: string;
  enterpriseName: string;
  locale: string;
  positionName: string;
  t: TFunction;
  values: EmployeeFormValues;
}

export function EmployeeCreateReview({
  departmentName,
  enterpriseName,
  locale,
  positionName,
  t,
  values,
}: EmployeeCreateReviewProps): JSX.Element {
  return (
    <div className="space-y-5">
      <EmployeeInfoSection
        title={t("employeesDetails.sections.personal")}
        items={[
          {
            label: t("forms.fields.lastName"),
            value: valueOrEmpty(values.last_name, t),
          },
          {
            label: t("forms.fields.firstName"),
            value: valueOrEmpty(values.first_name, t),
          },
          {
            label: t("forms.fields.middleName"),
            value: valueOrEmpty(values.middle_name, t),
          },
          {
            label: t("forms.fields.birthDate"),
            value: formatDate(values.birth_date, locale),
          },
          {
            label: t("forms.fields.gender"),
            value: humanizeStatus(values.gender, t),
          },
          {
            label: t("forms.fields.phone"),
            value: valueOrEmpty(values.phone, t),
          },
          {
            label: t("forms.fields.email"),
            value: valueOrEmpty(values.email, t),
          },
        ]}
      />
      <EmployeeInfoSection
        title={t("employeesDetails.sections.address")}
        items={[
          {
            label: t("forms.fields.addressCountry"),
            value: valueOrEmpty(values.address_country, t),
          },
          {
            label: t("forms.fields.addressCity"),
            value: valueOrEmpty(values.address_city, t),
          },
          {
            label: t("forms.fields.addressStreet"),
            value: valueOrEmpty(values.address_street, t),
          },
          {
            label: t("forms.fields.addressHouse"),
            value: valueOrEmpty(values.address_house, t),
          },
          {
            label: t("forms.fields.addressApartment"),
            value: valueOrEmpty(values.address_apartment, t),
          },
          {
            label: t("forms.fields.address"),
            value: valueOrEmpty(values.address, t),
          },
        ]}
      />
      <EmployeeInfoSection
        title={t("employeesDetails.sections.company")}
        items={[
          { label: t("forms.fields.enterpriseId"), value: valueOrEmpty(enterpriseName, t) },
          { label: t("forms.fields.departmentId"), value: valueOrEmpty(departmentName, t) },
          { label: t("forms.fields.positionId"), value: valueOrEmpty(positionName, t) },
          {
            label: t("forms.fields.hireDate"),
            value: formatDate(values.hire_date, locale),
          },
          {
            label: t("forms.fields.salary"),
            value: new Intl.NumberFormat(locale).format(Number(values.salary || 0)),
          },
          {
            label: t("forms.fields.employeeNumber", { defaultValue: locale.startsWith("en") ? "Employee number" : "Табельный номер" }),
            value: valueOrEmpty(values.employee_number, t),
          },
          {
            label: t("forms.fields.employmentType", { defaultValue: locale.startsWith("en") ? "Employment type" : "Тип занятости" }),
            value: employmentTypeLabel(values.employment_type, locale),
          },
          {
            label: t("forms.fields.contractNumber", { defaultValue: locale.startsWith("en") ? "Employment contract number" : "Номер трудового договора" }),
            value: valueOrEmpty(values.contract_number, t),
          },
          {
            label: t("forms.fields.contractDate", { defaultValue: locale.startsWith("en") ? "Contract date" : "Дата договора" }),
            value: formatDate(values.contract_date, locale),
          },
          {
            label: t("forms.fields.contractEndDate", { defaultValue: locale.startsWith("en") ? "Contract end date" : "Срок договора до" }),
            value: formatDate(values.contract_end_date, locale),
          },
        ]}
      />
    </div>
  );
}

function valueOrEmpty(value: string, t: TFunction): string {
  return value.trim() || t("employeesDetails.emptyValue");
}

function employmentTypeLabel(value: string, locale: string): string {
  const labels: Record<string, [string, string]> = {
    full_time: ["Полная занятость", "Full-time"],
    part_time: ["Частичная занятость", "Part-time"],
    temporary: ["Временная работа", "Temporary"],
    internship: ["Стажировка", "Internship"],
  };
  const label = labels[value];
  return label ? (locale.startsWith("en") ? label[1] : label[0]) : value || "—";
}
