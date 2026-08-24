import type { TFunction } from "i18next";

import { formatDate, humanizeStatus } from "../../../shared/lib/format";
import { EmployeeInfoSection } from "../components/EmployeeInfoSection";
import type { EmployeeFormValues } from "../types";

interface EmployeeCreateReviewProps {
  locale: string;
  t: TFunction;
  values: EmployeeFormValues;
}

export function EmployeeCreateReview({
  locale,
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
      <div className="app-accent-soft app-border rounded-2xl border p-4 text-sm font-semibold leading-6">
        <p className="app-text font-black">Организационное назначение оформляется отдельно</p>
        <p className="app-muted mt-1">
          После создания сотрудника можно назначить в предприятие, отдел и на должность через кадровое изменение или сразу выбрать его руководителем отдела, если у него ещё нет назначения.
        </p>
      </div>
    </div>
  );
}

function valueOrEmpty(value: string, t: TFunction): string {
  return value.trim() || t("employeesDetails.emptyValue");
}
