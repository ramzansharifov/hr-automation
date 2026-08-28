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
          { label: "Предприятие", value: valueOrEmpty(enterpriseName, t) },
          { label: "Отдел", value: valueOrEmpty(departmentName, t) },
          { label: "Должность", value: valueOrEmpty(positionName, t) },
          {
            label: "Дата приёма",
            value: formatDate(values.hire_date, locale),
          },
          {
            label: "Оклад",
            value: new Intl.NumberFormat(locale).format(Number(values.salary || 0)),
          },
          {
            label: "Табельный номер",
            value: valueOrEmpty(values.employee_number, t),
          },
          {
            label: "Тип занятости",
            value: employmentTypeLabel(values.employment_type),
          },
          {
            label: "Номер трудового договора",
            value: valueOrEmpty(values.contract_number, t),
          },
          {
            label: "Дата договора",
            value: formatDate(values.contract_date, locale),
          },
          {
            label: "Срок договора до",
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

function employmentTypeLabel(value: string): string {
  const labels: Record<string, string> = {
    full_time: "Полная занятость",
    part_time: "Частичная занятость",
    temporary: "Временная работа",
    internship: "Стажировка",
  };
  return labels[value] ?? value || "—";
}
