import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import type { HrRecord } from "../../../shared/types/hr";
import { Button, Dialog } from "../../../shared/ui";
import { hrApiClient } from "../../../shared/lib/hrApiClient";
import {
  normalizeEmail,
  normalizePersonName,
  normalizePhone,
} from "../lib/employeeFormatters";
import { useEmployeeFormOptions } from "../hooks/useEmployeeFormOptions";
import type { EmployeeFormValues } from "../types";
import {
  EmployeeAddressFormSection,
  EmployeeCompanyFormSection,
  EmployeePersonalFormSection,
} from "./EmployeeFormSections";
import {
  employeeSectionSchemas,
  type EmployeeFormSectionKey,
} from "./employeeFormValidation";
import {
  mapEmployeeFormSectionToRecord,
  mapEmployeeRecordToFormValues,
} from "./employeeFormRecordMapper";

interface EmployeeSectionEditDialogProps {
  employee: HrRecord;
  employeeId: number;
  onOpenChange: (open: boolean) => void;
  onSaved: (employee: HrRecord) => void | Promise<void>;
  open: boolean;
  section: EmployeeFormSectionKey | null;
}

export function EmployeeSectionEditDialog({
  employee,
  employeeId,
  onOpenChange,
  onSaved,
  open,
  section,
}: EmployeeSectionEditDialogProps): JSX.Element {
  const { t } = useTranslation();
  const activeSection = section ?? "personal";
  const formId = `employee-section-edit-${activeSection}`;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { departments, genderOptions, isRelationsLoading, positions } =
    useEmployeeFormOptions();

  const defaultValues = useMemo(
    () => mapEmployeeRecordToFormValues(employee),
    [employee],
  );
  const {
    control,
    formState: { errors },
    getValues,
    handleSubmit,
    register,
    reset,
    setValue,
  } = useForm<EmployeeFormValues>({
    defaultValues,
    resolver: zodResolver(
      employeeSectionSchemas[activeSection],
    ) as unknown as Resolver<EmployeeFormValues>,
  });

  useEffect(() => {
    reset(defaultValues);
  }, [defaultValues, reset, activeSection, open]);

  function normalizeField(name: keyof EmployeeFormValues): void {
    const value = getValues(name);
    if (
      name === "last_name" ||
      name === "first_name" ||
      name === "middle_name"
    ) {
      setValue(name, normalizePersonName(value), { shouldValidate: true });
      return;
    }
    if (name === "email") {
      setValue(name, normalizeEmail(value), { shouldValidate: true });
      return;
    }
    if (name === "phone") {
      setValue(name, normalizePhone(value), { shouldValidate: true });
    }
  }

  async function handleSave(): Promise<void> {
    if (!Number.isFinite(employeeId) || !section) return;
    setIsSubmitting(true);

    try {
      const updatedEmployee = await hrApiClient.update({
        entity: "employees",
        id: employeeId,
        data: mapEmployeeFormSectionToRecord(section, getValues()),
      });
      await onSaved(updatedEmployee);
      toast.success(t("forms.toasts.updated"));
      onOpenChange(false);
    } catch (error) {
      toast.error(getErrorMessage(error, t("forms.toasts.updateError")));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog
      description={
        activeSection === "company"
          ? "Здесь редактируются кадровые реквизиты. Отдел, должность, оклад, дата приёма и увольнение изменяются только через кадровые действия."
          : t("employeesDetails.edit.description")
      }
      footer={
        <div className="flex flex-wrap justify-end gap-3">
          <Button
            disabled={isSubmitting}
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
          >
            {t("common.actions.cancel")}
          </Button>
          <Button disabled={isSubmitting} form={formId} type="submit" variant="primary">
            {t("common.actions.save")}
          </Button>
        </div>
      }
      onOpenChange={onOpenChange}
      open={open}
      title={getSectionDialogTitle(activeSection, t)}
    >
      <form
        id={formId}
        className="space-y-6"
        onSubmit={handleSubmit(() => void handleSave())}
      >
        {activeSection === "personal" && (
          <EmployeePersonalFormSection
            control={control}
            errors={errors}
            genderOptions={genderOptions}
            normalizeField={normalizeField}
            register={register}
            t={t}
          />
        )}

        {activeSection === "address" && (
          <EmployeeAddressFormSection
            control={control}
            errors={errors}
            register={register}
            t={t}
          />
        )}

        {activeSection === "company" && (
          <EmployeeCompanyFormSection
            control={control}
            departments={departments}
            errors={errors}
            includeAssignmentFields={false}
            isRelationsLoading={isRelationsLoading}
            positions={positions}
            register={register}
            t={t}
          />
        )}
      </form>
    </Dialog>
  );
}

function getSectionDialogTitle(
  section: EmployeeFormSectionKey,
  t: TFunction,
): string {
  const titleKeys: Record<EmployeeFormSectionKey, string> = {
    personal: "employeesDetails.edit.personal",
    address: "employeesDetails.edit.address",
    company: "employeesDetails.edit.company",
  };
  return t(titleKeys[section]);
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback;
  const parts = error.message.split("Error: ");
  return parts[parts.length - 1] || fallback;
}
