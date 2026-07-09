import { useEffect, useState } from "react";
import type { TFunction } from "i18next";
import { FiRefreshCw } from "react-icons/fi";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { EmptyState, LoadingState } from "../../shared/ui";
import { getAppLocale } from "../../shared/i18n";
import {
  formatCurrency,
  formatDate,
  humanizeStatus,
} from "../../shared/lib/format";
import { hrApiClient } from "../../shared/lib/hrApiClient";
import type { HrRecord } from "../../shared/types/hr";
import { getRecordLabel } from "../../features/employees/lib/employeeRelations";

export function EmployeeDetailsPage(): JSX.Element {
  const { i18n, t } = useTranslation();
  const locale = getAppLocale(i18n.language);
  const params = useParams();
  const employeeId = Number(params.id);

  const [employee, setEmployee] = useState<HrRecord | null>(null);
  const [departmentName, setDepartmentName] = useState("");
  const [positionName, setPositionName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isCardFlipped, setIsCardFlipped] = useState(false);

  useEffect(() => {
    let isActive = true;

    async function loadEmployee(): Promise<void> {
      if (!Number.isFinite(employeeId)) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setHasError(false);

      try {
        const record = await hrApiClient.getById({
          entity: "employees",
          id: employeeId,
        });

        if (!isActive) {
          return;
        }

        setEmployee(record);

        const departmentId = toNumber(record?.department_id);
        const positionId = toNumber(record?.position_id);
        const [department, position] = await Promise.all([
          departmentId
            ? hrApiClient.getById({ entity: "departments", id: departmentId })
            : Promise.resolve(null),
          positionId
            ? hrApiClient.getById({ entity: "positions", id: positionId })
            : Promise.resolve(null),
        ]);

        if (!isActive) {
          return;
        }

        setDepartmentName(getRecordLabel(department));
        setPositionName(getRecordLabel(position));
      } catch {
        if (isActive) {
          setHasError(true);
          toast.error(t("employeesDetails.toasts.loadError"));
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadEmployee();

    return () => {
      isActive = false;
    };
  }, [employeeId, t]);

  if (isLoading) {
    return <LoadingState label={t("common.table.loading")} />;
  }

  if (hasError || !employee) {
    return (
      <EmptyState
        title={t("employeesDetails.notFoundTitle")}
        description={t("employeesDetails.notFoundDescription")}
      />
    );
  }

  const fullName = [
    getString(employee.last_name),
    getString(employee.first_name),
    getString(employee.middle_name),
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section className="app-surface app-shadow rounded-[32px] border p-5 sm:p-8">
      <EmployeePassportCard
        departmentName={departmentName}
        employee={employee}
        fullName={fullName}
        isFlipped={isCardFlipped}
        locale={locale}
        onFlip={() => setIsCardFlipped((current) => !current)}
        positionName={positionName}
        t={t}
      />
    </section>
  );
}

interface EmployeePassportCardProps {
  departmentName: string;
  employee: HrRecord;
  fullName: string;
  isFlipped: boolean;
  locale: string;
  onFlip: () => void;
  positionName: string;
  t: TFunction;
}

function EmployeePassportCard({
  departmentName,
  employee,
  fullName,
  isFlipped,
  locale,
  onFlip,
  positionName,
  t,
}: EmployeePassportCardProps): JSX.Element {
  const initials = getInitials(fullName);
  const flipLabel = isFlipped
    ? t("employeesDetails.card.flipToPersonal")
    : t("employeesDetails.card.flipToAddress");

  return (
    <div className="mx-auto max-w-6xl">
      <div className="relative min-h-[760px] [perspective:1600px] sm:min-h-[650px] xl:min-h-[560px]">
        <div
          className={[
            "relative min-h-[760px] transition-transform duration-500 [transform-style:preserve-3d] sm:min-h-[650px] xl:min-h-[560px]",
            isFlipped ? "[transform:rotateY(180deg)]" : "",
          ].join(" ")}
        >
          <article className="absolute inset-0 overflow-hidden rounded-[34px] border border-slate-200 bg-white shadow-sm [backface-visibility:hidden]">
            <div className="grid h-full min-h-[760px] sm:min-h-[650px] xl:min-h-[560px] xl:grid-cols-[360px_minmax(0,1fr)]">
              <aside className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700 to-slate-950 p-7 text-white">
                <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-white/10" />
                <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-white/10" />
                <div className="absolute bottom-0 right-0 h-40 w-40 bg-white/5 blur-3xl" />

                <div className="relative z-10 flex h-full flex-col justify-between gap-10">
                  <div>
                    <div className="flex h-20 w-20 items-center justify-center rounded-[28px] bg-white/15 text-2xl font-black shadow-xl shadow-blue-950/25 backdrop-blur">
                      {initials}
                    </div>

                    <p className="mt-9 text-xs font-black uppercase tracking-[0.28em] text-blue-100">
                      {t("employeesDetails.card.frontSide")}
                    </p>

                    <h2 className="mt-4 text-4xl font-black leading-tight tracking-tight">
                      {fullName || t("employeesDetails.title")}
                    </h2>
                  </div>

                  <div className="rounded-[28px] border border-white/15 bg-white/10 p-5 backdrop-blur">
                    <p className="text-xs font-black uppercase tracking-[0.24em] text-blue-100">
                      {t("forms.fields.status")}
                    </p>
                    <p className="mt-2 text-2xl font-black">
                      {humanizeStatus(employee.status, t)}
                    </p>
                  </div>
                </div>
              </aside>

              <div className="relative p-6 sm:p-8">
                <button
                  type="button"
                  aria-label={flipLabel}
                  title={flipLabel}
                  onClick={onFlip}
                  className="absolute right-5 top-5 inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-blue-600 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400"
                >
                  <FiRefreshCw className="h-5 w-5" />
                </button>

                <div className="pr-14">
                  <p className="app-accent-text text-xs font-black uppercase tracking-[0.24em]">
                    {t("employeesDetails.card.title")}
                  </p>
                  <h3 className="app-text mt-3 text-2xl font-black">
                    {t("employeesDetails.sections.personal")}
                  </h3>
                </div>

                <div className="mt-7 grid gap-4 md:grid-cols-2">
                  <PassportField
                    label={t("forms.fields.lastName")}
                    value={valueOrEmpty(getString(employee.last_name), t)}
                  />
                  <PassportField
                    label={t("forms.fields.firstName")}
                    value={valueOrEmpty(getString(employee.first_name), t)}
                  />
                  <PassportField
                    label={t("forms.fields.middleName")}
                    value={valueOrEmpty(getString(employee.middle_name), t)}
                  />
                  <PassportField
                    label={t("forms.fields.birthDate")}
                    value={formatDate(employee.birth_date, locale)}
                  />
                  <PassportField
                    label={t("forms.fields.gender")}
                    value={humanizeStatus(employee.gender, t)}
                  />
                  <PassportField
                    label={t("forms.fields.phone")}
                    value={valueOrEmpty(getString(employee.phone), t)}
                  />
                  <PassportField
                    label={t("forms.fields.email")}
                    value={valueOrEmpty(getString(employee.email), t)}
                  />
                  <PassportField
                    label={t("forms.fields.departmentId")}
                    value={valueOrEmpty(departmentName, t)}
                  />
                  <PassportField
                    label={t("forms.fields.positionId")}
                    value={valueOrEmpty(positionName, t)}
                  />
                  <PassportField
                    label={t("forms.fields.hireDate")}
                    value={formatDate(employee.hire_date, locale)}
                  />
                  <PassportField
                    label={t("forms.fields.salary")}
                    value={formatCurrency(employee.salary, locale)}
                  />
                </div>
              </div>
            </div>
          </article>

          <article className="absolute inset-0 overflow-hidden rounded-[34px] border border-slate-200 bg-white shadow-sm [backface-visibility:hidden] [transform:rotateY(180deg)]">
            <div className="grid h-full min-h-[760px] sm:min-h-[650px] xl:min-h-[560px] xl:grid-cols-[minmax(0,1fr)_360px]">
              <div className="relative p-6 sm:p-8">
                <button
                  type="button"
                  aria-label={flipLabel}
                  title={flipLabel}
                  onClick={onFlip}
                  className="absolute right-5 top-5 inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-blue-600 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400"
                >
                  <FiRefreshCw className="h-5 w-5" />
                </button>

                <div className="pr-14">
                  <p className="app-accent-text text-xs font-black uppercase tracking-[0.24em]">
                    {t("employeesDetails.card.backSide")}
                  </p>
                  <h3 className="app-text mt-3 text-2xl font-black">
                    {t("employeesDetails.sections.address")}
                  </h3>
                </div>

                <div className="mt-7 grid gap-4 md:grid-cols-2">
                  <PassportField
                    label={t("forms.fields.addressCountry")}
                    value={valueOrEmpty(getString(employee.address_country), t)}
                  />
                  <PassportField
                    label={t("forms.fields.addressCity")}
                    value={valueOrEmpty(getString(employee.address_city), t)}
                  />
                  <PassportField
                    label={t("forms.fields.addressStreet")}
                    value={valueOrEmpty(getString(employee.address_street), t)}
                  />
                  <PassportField
                    label={t("forms.fields.addressHouse")}
                    value={valueOrEmpty(getString(employee.address_house), t)}
                  />
                  <PassportField
                    label={t("forms.fields.addressApartment")}
                    value={valueOrEmpty(
                      getString(employee.address_apartment),
                      t,
                    )}
                  />
                  <PassportField
                    label={t("forms.fields.address")}
                    value={valueOrEmpty(getString(employee.address), t)}
                  />
                  <PassportField
                    label={t("forms.fields.note")}
                    value={valueOrEmpty(getString(employee.note), t)}
                  />
                </div>
              </div>

              <aside className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-blue-700 p-7 text-white">
                <div className="absolute -left-20 -top-20 h-56 w-56 rounded-full bg-white/10" />
                <div className="absolute -bottom-24 -right-24 h-64 w-64 rounded-full bg-white/10" />

                <div className="relative z-10 flex h-full flex-col justify-between gap-10">
                  <div>
                    <div className="flex h-20 w-20 items-center justify-center rounded-[28px] bg-white/15 text-2xl font-black shadow-xl shadow-slate-950/25 backdrop-blur">
                      {initials}
                    </div>

                    <p className="mt-9 text-xs font-black uppercase tracking-[0.28em] text-blue-100">
                      {t("employeesDetails.card.backSide")}
                    </p>

                    <h2 className="mt-4 text-4xl font-black leading-tight tracking-tight">
                      {fullName || t("employeesDetails.title")}
                    </h2>
                  </div>

                  <div className="rounded-[28px] border border-white/15 bg-white/10 p-5 backdrop-blur">
                    <p className="text-xs font-black uppercase tracking-[0.24em] text-blue-100">
                      {t("forms.fields.address")}
                    </p>
                    <p className="mt-2 text-lg font-black">
                      {valueOrEmpty(getString(employee.address_city), t)}
                    </p>
                  </div>
                </div>
              </aside>
            </div>
          </article>
        </div>
      </div>
    </div>
  );
}

interface PassportFieldProps {
  label: string;
  value: string;
}

function PassportField({ label, value }: PassportFieldProps): JSX.Element {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-5 transition hover:bg-white hover:shadow-sm">
      <p className="app-muted text-xs font-black uppercase tracking-wide">
        {label}
      </p>
      <p className="app-text mt-2 min-h-5 break-words text-sm font-black">
        {value}
      </p>
    </div>
  );
}

function getInitials(value: string): string {
  const parts = value
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean);

  const initials = parts
    .slice(0, 2)
    .map((part) => Array.from(part)[0])
    .join("")
    .toUpperCase();

  return initials || "HR";
}

function getString(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value);
}

function toNumber(value: unknown): number | null {
  const numberValue = typeof value === "number" ? value : Number(value);

  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : null;
}

function valueOrEmpty(value: string, t: (key: string) => string): string {
  return value.trim() || t("employeesDetails.emptyValue");
}
