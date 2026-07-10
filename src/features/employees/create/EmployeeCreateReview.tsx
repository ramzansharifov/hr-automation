import type { TFunction } from "i18next";

import type { SelectOption } from "../../../shared/ui";
import {
  formatCurrency,
  formatDate,
  humanizeStatus,
} from "../../../shared/lib/format";
import { EmployeeInfoSection } from "../components/EmployeeInfoSection";
import type { EmployeeFormValues } from "../types";

interface EmployeeCreateReviewProps {
  departments: SelectOption[];
  locale: string;
  positions: SelectOption[];
  t: TFunction;
  values: EmployeeFormValues;
}

export function EmployeeCreateReview({
  departments,
  locale,
  positions,
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
          {
            label: t("forms.fields.departmentId"),
            value: optionLabel(departments, values.department_id, t),
          },
          {
            label: t("forms.fields.positionId"),
            value: optionLabel(positions, values.position_id, t),
          },
          {
            label: t("forms.fields.hireDate"),
            value: formatDate(values.hire_date, locale),
          },
          {
            label: t("forms.fields.status"),
            value: humanizeStatus(values.status, t),
          },
          {
            label: t("forms.fields.salary"),
            value: formatCurrency(values.salary, locale),
          },
          {
            label: t("forms.fields.note"),
            value: valueOrEmpty(values.note, t),
          },
        ]}
      />
    </div>
  );
}

function optionLabel(
  options: SelectOption[],
  value: string,
  t: TFunction,
): string {
  return (
    options.find((option) => option.value === value)?.label ??
    valueOrEmpty(value, t)
  );
}

function valueOrEmpty(value: string, t: TFunction): string {
  return value.trim() || t("employeesDetails.emptyValue");
}
