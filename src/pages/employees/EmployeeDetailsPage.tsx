import { useEffect, useState, type ReactNode } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import { motion } from "framer-motion";
import type { TFunction } from "i18next";
import {
  FiCalendar,
  FiEdit2,
  FiMail,
  FiMapPin,
  FiPhone,
  FiUser,
} from "react-icons/fi";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { Button, EmptyState, LoadingState } from "../../shared/ui";
import { getAppLocale } from "../../shared/i18n";
import {
  formatCurrency,
  formatDate,
  humanizeStatus,
} from "../../shared/lib/format";
import { hrApiClient } from "../../shared/lib/hrApiClient";
import type { HrRecord } from "../../shared/types/hr";
import { getRecordLabel } from "../../features/employees/lib/employeeRelations";
import { HRLogo } from "../../app/brand/HRLogo";
import { EmployeeSectionEditDialog } from "../../features/employees/forms/EmployeeSectionEditDialog";
import type { EmployeeFormSectionKey } from "../../features/employees/forms/employeeFormValidation";
import {
  EmployeeEducationPanel,
  EmployeeExperiencePanel,
} from "../../features/employees/forms/EmployeeRelatedRecords";

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
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingSection, setEditingSection] =
    useState<EmployeeFormSectionKey | null>(null);

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

        if (!isActive) return;

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

        if (!isActive) return;

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

  async function refreshEmployeeRelationLabels(
    record: HrRecord,
  ): Promise<void> {
    const departmentId = toNumber(record.department_id);
    const positionId = toNumber(record.position_id);

    const [department, position] = await Promise.all([
      departmentId
        ? hrApiClient.getById({ entity: "departments", id: departmentId })
        : Promise.resolve(null),
      positionId
        ? hrApiClient.getById({ entity: "positions", id: positionId })
        : Promise.resolve(null),
    ]);

    setDepartmentName(getRecordLabel(department));
    setPositionName(getRecordLabel(position));
  }

  async function handleEmployeeSaved(updatedEmployee: HrRecord): Promise<void> {
    setEmployee(updatedEmployee);
    await refreshEmployeeRelationLabels(updatedEmployee);
  }

  function openSectionEditor(section: EmployeeFormSectionKey): void {
    setEditingSection(section);
    setIsEditOpen(true);
  }

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
    <motion.section
      key={employeeId}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.38, ease: "easeOut" }}
      className="app-surface app-shadow overflow-hidden rounded-[32px] border"
    >
      <Tabs.Root defaultValue="card">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, delay: 0.08, ease: "easeOut" }}
          className="app-border-soft border-b px-6 pt-5 sm:px-8"
        >
          <Tabs.List
            className="flex flex-wrap gap-2"
            aria-label={t("employeesDetails.title")}
          >
            <Tabs.Trigger className={detailsTabTriggerClass} value="card">
              {t("employeesDetails.card.title")}
            </Tabs.Trigger>

            <Tabs.Trigger className={detailsTabTriggerClass} value="company">
              {t("employeesDetails.sections.company")}
            </Tabs.Trigger>

            <Tabs.Trigger className={detailsTabTriggerClass} value="education">
              {t("employeesDetails.sections.education")}
            </Tabs.Trigger>

            <Tabs.Trigger className={detailsTabTriggerClass} value="experience">
              {t("employeesDetails.sections.experience")}
            </Tabs.Trigger>

            <Tabs.Trigger className={detailsTabTriggerClass} value="notes">
              {t("employeesDetails.sections.notes")}
            </Tabs.Trigger>
          </Tabs.List>
        </motion.div>

        <div className="p-5 sm:p-8">
          <Tabs.Content value="card" className="outline-none">
            <div className="mb-4 flex flex-wrap justify-end gap-3">
              <Button
                type="button"
                variant="secondary"
                leftIcon={<FiEdit2 className="h-4 w-4" />}
                onClick={() => openSectionEditor("personal")}
              >
                Личные данные
              </Button>
              <Button
                type="button"
                variant="secondary"
                leftIcon={<FiEdit2 className="h-4 w-4" />}
                onClick={() => openSectionEditor("address")}
              >
                Адресные данные
              </Button>
            </div>

            <EmployeePassportCard
              employee={employee}
              fullName={fullName}
              locale={locale}
              t={t}
            />
          </Tabs.Content>

          <Tabs.Content value="company" className="outline-none">
            <div className="mb-4 flex justify-end">
              <Button
                type="button"
                variant="secondary"
                leftIcon={<FiEdit2 className="h-4 w-4" />}
                onClick={() => openSectionEditor("company")}
              >
                Данные по компании
              </Button>
            </div>

            <InfoPanel
              eyebrow={t("employeesDetails.sections.company")}
              title={fullName || t("employeesDetails.title")}
            >
              <InfoField
                label={t("forms.fields.departmentId")}
                value={valueOrEmpty(departmentName, t)}
              />
              <InfoField
                label={t("forms.fields.positionId")}
                value={valueOrEmpty(positionName, t)}
              />
              <InfoField
                label={t("forms.fields.status")}
                value={humanizeStatus(employee.status, t)}
              />
              <InfoField
                label={t("forms.fields.hireDate")}
                value={formatDate(employee.hire_date, locale)}
              />
              <InfoField
                label={t("forms.fields.salary")}
                value={formatCurrency(employee.salary, locale)}
              />
            </InfoPanel>
          </Tabs.Content>

          <Tabs.Content value="education" className="outline-none">
            <EmployeeEducationPanel employeeId={employeeId} locale={locale} />
          </Tabs.Content>

          <Tabs.Content value="experience" className="outline-none">
            <EmployeeExperiencePanel employeeId={employeeId} locale={locale} />
          </Tabs.Content>

          <Tabs.Content value="notes" className="outline-none">
            <div className="mb-4 flex justify-end">
              <Button
                type="button"
                variant="secondary"
                leftIcon={<FiEdit2 className="h-4 w-4" />}
                onClick={() => openSectionEditor("notes")}
              >
                Служебная информация
              </Button>
            </div>

            <InfoPanel
              eyebrow={t("employeesDetails.sections.notes")}
              title={t("forms.fields.note")}
            >
              <InfoField
                label={t("forms.fields.note")}
                value={valueOrEmpty(getString(employee.note), t)}
                wide
              />
            </InfoPanel>
          </Tabs.Content>
        </div>
      </Tabs.Root>

      <EmployeeSectionEditDialog
        employee={employee}
        employeeId={employeeId}
        onOpenChange={(open) => {
          setIsEditOpen(open);

          if (!open) {
            setEditingSection(null);
          }
        }}
        onSaved={handleEmployeeSaved}
        open={isEditOpen}
        section={editingSection}
      />
    </motion.section>
  );
}

const detailsTabTriggerClass = [
  "app-tab-trigger relative -mb-px rounded-t-2xl border border-transparent px-5 py-3 text-sm font-black transition",
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-border)]",
].join(" ");

interface EmployeePassportCardProps {
  employee: HrRecord;
  fullName: string;
  locale: string;
  t: TFunction;
}

function EmployeePassportCard({
  employee,
  fullName,
  locale,
  t,
}: EmployeePassportCardProps): JSX.Element {
  const address = composeAddress(employee, t);

  return (
    <motion.article
      initial={{ opacity: 0, scale: 0.985, y: 18 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.42, delay: 0.12, ease: "easeOut" }}
      className="app-surface app-shadow-lg mx-auto max-w-7xl overflow-hidden rounded-[36px] border"
    >
      <div className="grid xl:grid-cols-[300px_minmax(0,1fr)]">
        <motion.aside
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.42, delay: 0.18, ease: "easeOut" }}
          className="app-accent-gradient-panel relative overflow-hidden p-7 text-white"
        >
          <div className="absolute -left-20 -top-20 h-64 w-64 rounded-full bg-white/10" />
          <div className="absolute -right-28 top-16 h-72 w-72 rounded-full bg-white/10" />
          <div className="absolute -bottom-28 -right-20 h-72 w-72 rounded-full bg-white/10" />
          <div className="absolute bottom-24 left-6 h-44 w-44 rounded-full border border-white/15" />
          <div className="absolute bottom-28 left-10 h-36 w-36 rounded-full bg-white/10" />

          <div className="relative z-10 flex h-full min-h-[500px] flex-col items-center justify-center text-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.82, rotate: -6 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              transition={{ duration: 0.45, delay: 0.28, ease: "easeOut" }}
              className="relative flex h-36 w-36 items-center justify-center"
            >
              <div className="absolute inset-3 rounded-full bg-white/20 blur-2xl" />
              <HRLogo className="app-accent-drop-shadow relative h-32 w-32" />
            </motion.div>

            <div className="app-passport-soft-line mt-12 w-24" />

            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.32, delay: 0.38, ease: "easeOut" }}
              className="mt-10 text-base font-black uppercase tracking-[0.34em]"
            >
              Сотрудник
            </motion.p>

            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.32, delay: 0.44, ease: "easeOut" }}
              className="mt-5 text-xs font-black uppercase tracking-[0.38em] text-white/70"
            >
              HR Automation
            </motion.p>
          </div>
        </motion.aside>

        <div className="min-w-0 bg-[var(--color-surface-muted)] flex flex-col">
          <motion.header
            initial={{ opacity: 0, y: -18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.36, delay: 0.22, ease: "easeOut" }}
            className="app-passport-header-gradient flex min-h-[132px] items-center justify-between gap-6 px-9 py-7 text-white rounded-br-2xl"
          >
            <h2 className="min-w-0 truncate text-3xl font-black tracking-tight sm:text-4xl">
              {fullName || t("employeesDetails.title")}
            </h2>

            <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[24px] border border-white/30 bg-white/88 text-[var(--accent)]">
              <FiUser className="h-10 w-10" />
            </span>
          </motion.header>

          <div className="flex-1 px-6 py-6 sm:px-8 xl:px-10">
            <div className="grid gap-4 xl:grid-cols-2">
              <CardInfoBox
                icon={<FiPhone className="h-6 w-6" />}
                label={t("forms.fields.phone")}
                value={valueOrEmpty(getString(employee.phone), t)}
              />

              <CardInfoBox
                icon={<FiMail className="h-6 w-6" />}
                label={t("forms.fields.email")}
                value={valueOrEmpty(getString(employee.email), t)}
              />

              <CardInfoBox
                icon={<FiMapPin className="h-6 w-6" />}
                label={t("forms.fields.address")}
                value={address}
                wide
              />

              <CardInfoBox
                icon={<FiUser className="h-6 w-6" />}
                label={t("forms.fields.gender")}
                value={humanizeStatus(employee.gender, t)}
              />

              <CardInfoBox
                icon={<FiCalendar className="h-6 w-6" />}
                label={t("forms.fields.birthDate")}
                value={formatDate(employee.birth_date, locale)}
              />
            </div>
          </div>
        </div>
      </div>
    </motion.article>
  );
}

interface CardInfoBoxProps {
  icon: ReactNode;
  label: string;
  value: string;
  wide?: boolean;
}

function CardInfoBox({
  icon,
  value,
  wide = false,
}: CardInfoBoxProps): JSX.Element {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: "easeOut" }}
      whileHover={{ y: -2 }}
      className={[
        "app-surface flex min-h-[92px] items-center gap-4 rounded-[22px] border px-5 py-4 transition",
        wide ? "xl:col-span-2" : "",
      ].join(" ")}
    >
      <span className="app-accent-soft flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px]">
        {icon}
      </span>

      <p className="app-text min-w-0 whitespace-pre-line break-words text-lg font-black leading-snug">
        {value}
      </p>
    </motion.div>
  );
}

interface InfoPanelProps {
  children: ReactNode;
  eyebrow: string;
  title: string;
}

function InfoPanel({ children, eyebrow, title }: InfoPanelProps): JSX.Element {
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.34, ease: "easeOut" }}
      className="app-surface app-shadow rounded-[30px] border p-6 sm:p-7"
    >
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.26, delay: 0.08, ease: "easeOut" }}
      >
        <p className="app-accent-text text-xs font-black uppercase tracking-[0.24em]">
          {eyebrow}
        </p>
        <h2 className="app-text mt-3 text-2xl font-black">{title}</h2>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.14, ease: "easeOut" }}
        className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-3"
      >
        {children}
      </motion.div>
    </motion.section>
  );
}

interface InfoFieldProps {
  label: string;
  value: string;
  wide?: boolean;
}

function InfoField({
  label,
  value,
  wide = false,
}: InfoFieldProps): JSX.Element {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
      whileHover={{ y: -2 }}
      className={[
        "app-surface-muted app-border rounded-[24px] border p-5 transition hover:bg-[var(--color-surface-hover)]",
        wide ? "md:col-span-2" : "",
      ].join(" ")}
    >
      <p className="app-muted text-xs font-black uppercase tracking-wide">
        {label}
      </p>
      <p className="app-text mt-2 min-h-5 break-words text-sm font-black">
        {value}
      </p>
    </motion.div>
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

  if (parts.length > 0 && detailedAddress) {
    return `${parts.join(", ")}\n${detailedAddress}`;
  }

  if (parts.length > 0) {
    return parts.join(", ");
  }

  return valueOrEmpty(detailedAddress, t);
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
