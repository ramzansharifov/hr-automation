import { useEffect, useState } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import { motion } from "framer-motion";
import {
  FiBookOpen,
  FiBriefcase,
  FiEdit2,
  FiFileText,
  FiTrendingUp,
  FiUser,
} from "react-icons/fi";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
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
import {
  EmployeeInfoField,
  EmployeeInfoPanel,
  EmployeePassportCard,
  EmployeeProfileHeader,
} from "../../features/employees/components/EmployeeDetailsCards";
import { EmployeeLifecyclePanel } from "../../features/employees/components/EmployeeLifecyclePanel";
import { EmployeeSectionEditDialog } from "../../features/employees/forms/EmployeeSectionEditDialog";
import type { EmployeeFormSectionKey } from "../../features/employees/forms/employeeFormValidation";
import {
  EmployeeEducationPanel,
  EmployeeExperiencePanel,
} from "../../features/employees/forms/EmployeeRelatedRecords";

export function EmployeeDetailsPage(): JSX.Element {
  const { i18n, t } = useTranslation();
  const locale = getAppLocale(i18n.language);
  const navigate = useNavigate();
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
    <motion.div
      key={employeeId}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.38, ease: "easeOut" }}
      className="space-y-4"
    >
      <EmployeeProfileHeader
        department={valueOrEmpty(departmentName, t)}
        fullName={fullName}
        isActive={getString(employee.status) === "active"}
        onBack={() => navigate("/employees")}
        onEdit={() => openSectionEditor("personal")}
        position={valueOrEmpty(positionName, t)}
        status={humanizeStatus(employee.status, t)}
        t={t}
      />

      <Tabs.Root
        className="app-surface app-border overflow-hidden rounded-[28px] border"
        defaultValue="card"
      >
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, delay: 0.08, ease: "easeOut" }}
          className="app-surface-muted app-border-soft overflow-x-auto border-b p-3 sm:px-5"
        >
          <Tabs.List
            className="flex min-w-max gap-2"
            aria-label={t("employeesDetails.title")}
          >
            <Tabs.Trigger className={detailsTabTriggerClass} value="card">
              <FiUser className="h-4 w-4" />
              {t("employeesDetails.card.title")}
            </Tabs.Trigger>

            <Tabs.Trigger className={detailsTabTriggerClass} value="company">
              <FiBriefcase className="h-4 w-4" />
              {t("employeesDetails.sections.company")}
            </Tabs.Trigger>

            <Tabs.Trigger className={detailsTabTriggerClass} value="education">
              <FiBookOpen className="h-4 w-4" />
              {t("employeesDetails.sections.education")}
            </Tabs.Trigger>

            <Tabs.Trigger className={detailsTabTriggerClass} value="experience">
              <FiBriefcase className="h-4 w-4" />
              {t("employeesDetails.sections.experience")}
            </Tabs.Trigger>

            <Tabs.Trigger className={detailsTabTriggerClass} value="career">
              <FiTrendingUp className="h-4 w-4" />
              Карьера и отпуска
            </Tabs.Trigger>

            <Tabs.Trigger className={detailsTabTriggerClass} value="notes">
              <FiFileText className="h-4 w-4" />
              {t("employeesDetails.sections.notes")}
            </Tabs.Trigger>
          </Tabs.List>
        </motion.div>

        <div className="p-5 sm:p-7">
          <Tabs.Content value="card" className="outline-none">
            <div className="mb-4 flex flex-wrap justify-end gap-3">
              <Button
                type="button"
                variant="secondary"
                leftIcon={<FiEdit2 className="h-4 w-4" />}
                onClick={() => openSectionEditor("personal")}
              >
                {t("employeesDetails.sections.personal")}
              </Button>
              <Button
                type="button"
                variant="secondary"
                leftIcon={<FiEdit2 className="h-4 w-4" />}
                onClick={() => openSectionEditor("address")}
              >
                {t("employeesDetails.sections.address")}
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
            <EmployeeInfoPanel
              eyebrow={t("employeesDetails.sections.company")}
              title={fullName || t("employeesDetails.title")}
            >
              <EmployeeInfoField
                label={t("forms.fields.departmentId")}
                value={valueOrEmpty(departmentName, t)}
              />
              <EmployeeInfoField
                label={t("forms.fields.positionId")}
                value={valueOrEmpty(positionName, t)}
              />
              <EmployeeInfoField
                label={t("forms.fields.status")}
                value={humanizeStatus(employee.status, t)}
              />
              <EmployeeInfoField
                label={t("forms.fields.hireDate")}
                value={formatDate(employee.hire_date, locale)}
              />
              <EmployeeInfoField
                label={t("forms.fields.salary")}
                value={formatCurrency(employee.salary, locale)}
              />
            </EmployeeInfoPanel>
          </Tabs.Content>

          <Tabs.Content value="education" className="outline-none">
            <EmployeeEducationPanel employeeId={employeeId} locale={locale} />
          </Tabs.Content>

          <Tabs.Content value="experience" className="outline-none">
            <EmployeeExperiencePanel employeeId={employeeId} locale={locale} />
          </Tabs.Content>

          <Tabs.Content value="career" className="outline-none">
            <EmployeeLifecyclePanel
              employee={employee}
              employeeId={employeeId}
              locale={locale}
              onEmployeeUpdated={handleEmployeeSaved}
            />
          </Tabs.Content>

          <Tabs.Content value="notes" className="outline-none">
            <div className="mb-4 flex justify-end">
              <Button
                type="button"
                variant="secondary"
                leftIcon={<FiEdit2 className="h-4 w-4" />}
                onClick={() => openSectionEditor("notes")}
              >
                {t("employeesDetails.sections.notes")}
              </Button>
            </div>

            <EmployeeInfoPanel
              eyebrow={t("employeesDetails.sections.notes")}
              title={t("forms.fields.note")}
            >
              <EmployeeInfoField
                label={t("forms.fields.note")}
                value={valueOrEmpty(getString(employee.note), t)}
                wide
              />
            </EmployeeInfoPanel>
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
    </motion.div>
  );
}

const detailsTabTriggerClass = [
  "app-tab-trigger inline-flex items-center gap-2 rounded-xl border border-transparent px-4 py-2.5 text-sm font-black transition",
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-border)]",
].join(" ");

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
