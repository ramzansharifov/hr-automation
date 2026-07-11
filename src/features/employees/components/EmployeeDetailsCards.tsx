import type { ReactNode } from "react";
import { motion } from "framer-motion";
import type { TFunction } from "i18next";
import { FiCalendar, FiMail, FiMapPin, FiPhone, FiUser } from "react-icons/fi";

import { HRLogo } from "../../../app/brand/HRLogo";
import { formatDate, humanizeStatus } from "../../../shared/lib/format";
import type { HrRecord } from "../../../shared/types/hr";

interface EmployeePassportCardProps {
  employee: HrRecord;
  fullName: string;
  locale: string;
  t: TFunction;
}

export function EmployeePassportCard({
  employee,
  fullName,
  locale,
  t,
}: EmployeePassportCardProps): JSX.Element {
  const address = composeAddress(employee, t);

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="app-surface app-border mx-auto max-w-7xl overflow-hidden rounded-[28px] border"
    >
      <div className="grid xl:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="app-accent-gradient-panel relative overflow-hidden p-7 text-white">
          <div className="absolute -left-24 -top-24 h-60 w-60 rounded-full border border-white/15" />
          <div className="absolute -bottom-28 -right-24 h-64 w-64 rounded-full bg-white/[0.08]" />
          <div className="relative z-10 flex h-full min-h-[360px] flex-col items-center justify-center text-center xl:min-h-[500px]">
            <div className="flex h-28 w-28 items-center justify-center rounded-[28px] border border-white/20 bg-white/10">
              <HRLogo className="h-24 w-24" />
            </div>
            <div className="mt-9 h-px w-20 bg-white/30" />
            <p className="mt-8 text-sm font-black uppercase tracking-[0.28em]">
              {t("employeesDetails.card.employeeLabel")}
            </p>
            <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.3em] text-white/65">
              HR Automation
            </p>
          </div>
        </aside>

        <div className="min-w-0 bg-[var(--color-surface-muted)]">
          <header className="app-passport-header-gradient flex min-h-[124px] items-center justify-between gap-5 px-6 py-6 text-white sm:px-8">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/70">
                {t("employeesDetails.card.title")}
              </p>
              <h2 className="mt-2 break-words text-2xl font-black tracking-tight sm:text-3xl">
                {fullName || t("employeesDetails.title")}
              </h2>
            </div>
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-white/30 bg-white/10">
              <FiUser className="h-8 w-8" />
            </span>
          </header>

          <div className="grid gap-3 p-5 sm:grid-cols-2 sm:p-7">
            <ContactItem
              icon={<FiPhone />}
              label={t("forms.fields.phone")}
              value={valueOrEmpty(getString(employee.phone), t)}
            />
            <ContactItem
              icon={<FiMail />}
              label={t("forms.fields.email")}
              value={valueOrEmpty(getString(employee.email), t)}
            />
            <ContactItem
              icon={<FiMapPin />}
              label={t("forms.fields.address")}
              value={address}
              wide
            />
            <ContactItem
              icon={<FiUser />}
              label={t("forms.fields.gender")}
              value={humanizeStatus(employee.gender, t)}
            />
            <ContactItem
              icon={<FiCalendar />}
              label={t("forms.fields.birthDate")}
              value={formatDate(employee.birth_date, locale)}
            />
          </div>
        </div>
      </div>
    </motion.article>
  );
}

function ContactItem({
  icon,
  label,
  value,
  wide = false,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  wide?: boolean;
}): JSX.Element {
  return (
    <div
      className={[
        "app-surface app-border flex min-h-[88px] items-center gap-4 rounded-[20px] border p-4",
        wide ? "sm:col-span-2" : "",
      ].join(" ")}
    >
      <span className="app-accent-soft flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl [&>svg]:h-5 [&>svg]:w-5">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="app-muted text-[11px] font-black uppercase tracking-[0.1em]">
          {label}
        </p>
        <p className="app-text mt-1 whitespace-pre-line break-words text-sm font-bold leading-5">
          {value}
        </p>
      </div>
    </div>
  );
}

export function EmployeeInfoPanel({
  children,
  eyebrow,
  title,
}: {
  children: ReactNode;
  eyebrow: string;
  title: string;
}): JSX.Element {
  return (
    <section className="app-surface-muted app-border rounded-[24px] border p-5 sm:p-6">
      <p className="app-accent-text text-xs font-black uppercase tracking-[0.2em]">
        {eyebrow}
      </p>
      <h2 className="app-text mt-2 text-2xl font-black tracking-tight">
        {title}
      </h2>
      <div className="app-border-soft mt-5 grid gap-3 border-t pt-5 md:grid-cols-2 xl:grid-cols-3">
        {children}
      </div>
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
        "app-surface app-border rounded-2xl border p-4",
        wide ? "md:col-span-2" : "",
      ].join(" ")}
    >
      <p className="app-muted text-[11px] font-black uppercase tracking-[0.1em]">
        {label}
      </p>
      <p className="app-text mt-2 min-h-5 break-words text-sm font-bold leading-5">
        {value}
      </p>
    </div>
  );
}

function composeAddress(employee: HrRecord, t: TFunction): string {
  const parts = [
    getString(employee.address_country),
    getString(employee.address_city),
    getString(employee.address_street),
    getString(employee.address_house)
      ? `дом ${getString(employee.address_house)}`
      : "",
    getString(employee.address_apartment)
      ? `кв. ${getString(employee.address_apartment)}`
      : "",
  ].filter(Boolean);
  const detailedAddress = getString(employee.address);

  if (parts.length > 0 && detailedAddress)
    return `${parts.join(", ")}\n${detailedAddress}`;
  if (parts.length > 0) return parts.join(", ");

  return valueOrEmpty(detailedAddress, t);
}

function getString(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

function valueOrEmpty(value: string, t: TFunction): string {
  return value.trim() || t("employeesDetails.emptyValue");
}
