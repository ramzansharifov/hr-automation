import type { ReactNode } from "react";
import { motion } from "framer-motion";
import type { TFunction } from "i18next";
import {
  FiBriefcase,
  FiFileText,
  FiMapPin,
  FiPhone,
  FiUser,
} from "react-icons/fi";

import { formatDate, humanizeStatus } from "../../../shared/lib/format";
import type { HrRecord } from "../../../shared/types/hr";
import { ActionButton, ActionIconButton } from "../../../shared/ui";

interface EmployeeProfileHeaderProps {
  department: string;
  fullName: string;
  isActive: boolean;
  onBack: () => void;
  onEdit?: () => void;
  position: string;
  status: string;
  t: TFunction;
}

export function EmployeeProfileHeader({
  department,
  fullName,
  isActive,
  onBack,
  onEdit,
  position,
  status,
  t,
}: EmployeeProfileHeaderProps): JSX.Element {
  return (
    <header className="employee-profile-header">
      <div className="employee-profile-header__identity">
        <span className="employee-profile-avatar" aria-hidden="true">
          <FiUser />
        </span>

        <div className="min-w-0">
          <div className="employee-profile-header__title-row">
            <h1 className="employee-profile-header__title">
              {fullName || t("employeesDetails.title")}
            </h1>
            <span
              className={[
                "employee-profile-status",
                isActive
                  ? "employee-profile-status--active"
                  : "employee-profile-status--inactive",
              ].join(" ")}
            >
              {status}
            </span>
          </div>

          <div className="employee-profile-header__meta">
            <span className="employee-profile-header__meta-item">
              <FiBriefcase />
              {position}
            </span>
            <span className="employee-profile-header__dot" />
            <span className="employee-profile-header__meta-item">
              <FiFileText />
              {department}
            </span>
          </div>
        </div>
      </div>

      <div className="employee-profile-header__actions">
        <ActionButton action="back" onClick={onBack} type="button">
          {t("employeesDetails.backToList")}
        </ActionButton>
        {onEdit && (
          <ActionButton action="edit" onClick={onEdit} type="button">
            {t("common.actions.edit")}
          </ActionButton>
        )}
      </div>
    </header>
  );
}

interface EmployeeOverviewCardsProps {
  employee: HrRecord;
  fullName: string;
  locale: string;
  onEditAddress?: () => void;
  onEditPersonal?: () => void;
  t: TFunction;
}

export function EmployeeOverviewCards({
  employee,
  fullName,
  locale,
  onEditAddress,
  onEditPersonal,
  t,
}: EmployeeOverviewCardsProps): JSX.Element {
  const address = composeAddress(employee, t);

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.26, ease: "easeOut" }}
      className="employee-overview-grid"
    >
      <OverviewCard
        actionLabel={t("common.actions.edit")}
        icon={<FiUser />}
        onEdit={onEditPersonal}
        title={t("employeesDetails.sections.personal")}
      >
        <ProfileRow
          label={t("employeesDetails.card.employeeLabel")}
          value={fullName || t("employeesDetails.title")}
        />
        <ProfileRow
          label={t("forms.fields.gender")}
          value={humanizeStatus(employee.gender, t)}
        />
        <ProfileRow
          label={t("forms.fields.birthDate")}
          value={formatDate(employee.birth_date, locale)}
        />
      </OverviewCard>

      <OverviewCard
        actionLabel={t("common.actions.edit")}
        icon={<FiPhone />}
        onEdit={onEditPersonal}
        title={t("employeesDetails.sections.contacts")}
      >
        <ProfileRow
          label={t("forms.fields.phone")}
          value={valueOrEmpty(getString(employee.phone), t)}
        />
        <ProfileRow
          label={t("forms.fields.email")}
          value={valueOrEmpty(getString(employee.email), t)}
        />
      </OverviewCard>

      <OverviewCard
        actionLabel={t("common.actions.edit")}
        icon={<FiMapPin />}
        onEdit={onEditAddress}
        title={t("employeesDetails.sections.address")}
      >
        <ProfileRow label={t("forms.fields.address")} value={address} />
      </OverviewCard>
    </motion.section>
  );
}

function OverviewCard({
  actionLabel,
  children,
  icon,
  onEdit,
  title,
}: {
  actionLabel: string;
  children: ReactNode;
  icon: ReactNode;
  onEdit?: () => void;
  title: string;
}): JSX.Element {
  return (
    <article className="employee-overview-card">
      <header className="employee-overview-card__header">
        <div className="employee-overview-card__heading">
          <span className="employee-card-icon">{icon}</span>
          <h2 className="employee-card-title">{title}</h2>
        </div>
        {onEdit && (
          <ActionIconButton
            action="edit"
            className="employee-card-edit"
            label={`${actionLabel}: ${title}`}
            onClick={onEdit}
            size="sm"
          />
        )}
      </header>
      <div className="employee-overview-card__body">{children}</div>
    </article>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="employee-profile-row">
      <span className="employee-profile-row__label">{label}</span>
      <span className="employee-profile-row__value">{value}</span>
    </div>
  );
}

export function EmployeeInfoPanel({
  action,
  children,
  icon,
  title,
}: {
  action?: ReactNode;
  children: ReactNode;
  eyebrow: string;
  icon?: ReactNode;
  title: string;
}): JSX.Element {
  return (
    <section className="employee-section-card">
      <header className="employee-section-card__header">
        <div className="employee-section-card__heading">
          <span className="employee-card-icon">{icon ?? <FiBriefcase />}</span>
          <h2 className="employee-card-title">{title}</h2>
        </div>
        {action}
      </header>
      <div className="employee-section-card__body">{children}</div>
    </section>
  );
}

export function EmployeeInfoField({
  label,
  value,
  wide = false,
}: {
  label: string;
  value: string;
  wide?: boolean;
}): JSX.Element {
  return (
    <div
      className={[
        "employee-info-field",
        wide ? "employee-info-field--wide" : "",
      ].join(" ")}
    >
      <span className="employee-info-field__label">{label}</span>
      <span className="employee-info-field__value">{value}</span>
    </div>
  );
}

function composeAddress(employee: HrRecord, t: TFunction): string {
  const parts = [
    getString(employee.address_country),
    getString(employee.address_city),
    getString(employee.address_street),
    getString(employee.address_house)
      ? `${t("forms.fields.addressHouse")}: ${getString(employee.address_house)}`
      : "",
    getString(employee.address_apartment)
      ? `${t("forms.fields.addressApartment")}: ${getString(employee.address_apartment)}`
      : "",
  ].filter(Boolean);
  const detailedAddress = getString(employee.address);

  if (parts.length > 0 && detailedAddress) {
    return `${parts.join(", ")}. ${detailedAddress}`;
  }
  if (parts.length > 0) return parts.join(", ");
  return valueOrEmpty(detailedAddress, t);
}

function getString(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

function valueOrEmpty(value: string, t: TFunction): string {
  return value.trim() || t("employeesDetails.emptyValue");
}
