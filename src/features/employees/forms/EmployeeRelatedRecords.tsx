import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FiBookOpen, FiBriefcase } from "react-icons/fi";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";

import { hrApiClient } from "../../../shared/lib/hrApiClient";
import type { HrRecord } from "../../../shared/types/hr";
import {
  Button,
  ConfirmDialog,
  Dialog,
  FieldError,
  type SelectOption,
} from "../../../shared/ui";
import {
  EducationRecordCard,
  ExperienceRecordCard,
  RelatedRecordsHeader,
  RelatedRecordsList,
} from "../related-records/RelatedRecordCards";
import {
  RelatedSelectField,
  RelatedTextField,
  RelatedTextareaField,
  RelatedToggleField,
} from "../related-records/RelatedRecordFields";
import {
  educationDefaults,
  experienceDefaults,
  getEducationLevelFromRecord,
  getRecordId,
  getString,
  mapEducationFormToRecord,
  mapExperienceFormToRecord,
  validateEducation,
  validateExperience,
  type EducationFormValues,
  type ExperienceFormValues,
} from "../related-records/model";

interface EmployeeRelatedRecordsProps {
  canManage: boolean;
  employeeId: number;
  locale: string;
}

export function EmployeeEducationPanel({
  canManage,
  employeeId,
  locale,
}: EmployeeRelatedRecordsProps): JSX.Element {
  const { t } = useTranslation();
  const [records, setRecords] = useState<HrRecord[]>([]);
  const [formValues, setFormValues] = useState<EducationFormValues>(educationDefaults);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<HrRecord | null>(null);
  const [error, setError] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const educationLevelOptions = useMemo<SelectOption[]>(
    () => [
      { value: "basic_general", label: t("employeesDetails.education.degrees.basicGeneral") },
      { value: "secondary_general", label: t("employeesDetails.education.degrees.secondaryGeneral") },
      { value: "secondary_vocational", label: t("employeesDetails.education.degrees.secondaryVocational") },
      { value: "incomplete_higher", label: t("employeesDetails.education.degrees.incompleteHigher") },
      { value: "bachelor", label: t("employeesDetails.education.degrees.bachelor") },
      { value: "specialist", label: t("employeesDetails.education.degrees.specialist") },
      { value: "master", label: t("employeesDetails.education.degrees.master") },
      { value: "postgraduate", label: t("employeesDetails.education.degrees.postgraduate") },
      { value: "academic_degree", label: t("employeesDetails.education.degrees.academicDegree") },
    ],
    [t],
  );

  const loadRecords = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await hrApiClient.list({
        entity: "employee_education",
        page: 1,
        pageSize: 100,
        filters: { employee_id: { operator: "equals", value: employeeId } },
        orderBy: "started_at",
        orderDirection: "desc",
      });
      setRecords(result.items);
    } catch {
      toast.error(t("employeesDetails.education.toasts.loadError"));
    } finally {
      setIsLoading(false);
    }
  }, [employeeId, t]);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  function updateField(name: keyof EducationFormValues, value: string): void {
    setFormValues((current) => ({ ...current, [name]: value }));
  }

  function openCreate(): void {
    if (!canManage) return;
    setEditingId(null);
    setError("");
    setFormValues(educationDefaults);
    setIsDialogOpen(true);
  }

  function openEdit(record: HrRecord): void {
    if (!canManage) return;
    const id = getRecordId(record);
    if (!id) return;
    setEditingId(id);
    setError("");
    setFormValues({
      education_level: getEducationLevelFromRecord(record),
      institution_name: getString(record.institution_name),
      speciality: getString(record.speciality),
      started_at: getString(record.started_at),
      ended_at: getString(record.ended_at),
      document_number: getString(record.document_number),
    });
    setIsDialogOpen(true);
  }

  function closeDialog(): void {
    setIsDialogOpen(false);
    setEditingId(null);
    setError("");
    setFormValues(educationDefaults);
  }

  async function save(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const validationError = validateEducation(formValues, t);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError("");
    setIsSubmitting(true);
    try {
      const data = mapEducationFormToRecord(employeeId, formValues);
      if (editingId) {
        await hrApiClient.update({ entity: "employee_education", id: editingId, data });
      } else {
        await hrApiClient.create({ entity: "employee_education", data });
      }
      toast.success(t(editingId ? "forms.toasts.updated" : "forms.toasts.created"));
      await loadRecords();
      closeDialog();
    } catch (saveError) {
      toast.error(getErrorMessage(saveError, t("forms.toasts.updateError")));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function remove(): Promise<void> {
    const id = getRecordId(deleteTarget);
    if (!id) return;
    setIsSubmitting(true);
    try {
      await hrApiClient.delete({ entity: "employee_education", id });
      setDeleteTarget(null);
      await loadRecords();
      toast.success(t("forms.toasts.deleted"));
    } catch (deleteError) {
      toast.error(getErrorMessage(deleteError, t("forms.toasts.deleteError")));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      <RelatedRecordsHeader
        actionLabel={t("employeesDetails.education.formTitle")}
        description={t("employeesDetails.education.description")}
        icon={<FiBookOpen className="h-6 w-6" />}
        onAction={canManage ? openCreate : undefined}
        recordCount={records.length}
        title={t("employeesDetails.sections.education")}
      />
      <RelatedRecordsList
        emptyTitle={t("employeesDetails.education.emptyTitle")}
        isLoading={isLoading}
        loadingLabel={t("common.table.loading")}
        records={records}
        renderRecord={(record) => (
          <EducationRecordCard
            locale={locale}
            onDelete={canManage ? () => setDeleteTarget(record) : undefined}
            onEdit={canManage ? () => openEdit(record) : undefined}
            record={record}
            t={t}
          />
        )}
      />

      {canManage && (
        <>
          <Dialog
            description={t("employeesDetails.education.description")}
            onOpenChange={(open) => (open ? setIsDialogOpen(true) : closeDialog())}
            open={isDialogOpen}
            title={t(editingId ? "employeesDetails.education.editTitle" : "employeesDetails.education.formTitle")}
          >
            <form className="grid gap-4" onSubmit={save}>
              <RelatedSelectField
                label={t("forms.fields.educationDegree")}
                onValueChange={(value) => updateField("education_level", value)}
                options={educationLevelOptions}
                placeholder={t("forms.placeholders.select")}
                value={formValues.education_level}
              />
              <RelatedTextField
                label={t("forms.fields.institutionName")}
                onChange={(value) => updateField("institution_name", value)}
                required
                value={formValues.institution_name}
              />
              <RelatedTextField
                label={t("forms.fields.speciality")}
                onChange={(value) => updateField("speciality", value)}
                value={formValues.speciality}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <RelatedTextField label={t("forms.fields.startedAt")} onChange={(value) => updateField("started_at", value)} type="date" value={formValues.started_at} />
                <RelatedTextField label={t("forms.fields.endedAt")} onChange={(value) => updateField("ended_at", value)} type="date" value={formValues.ended_at} />
              </div>
              <RelatedTextField
                label={t("forms.fields.documentNumber")}
                onChange={(value) => updateField("document_number", value)}
                value={formValues.document_number}
              />
              <FieldError message={error} />
              <FormActions editing={Boolean(editingId)} isSubmitting={isSubmitting} onCancel={closeDialog} t={t} />
            </form>
          </Dialog>
          <DeleteDialog
            deleteTarget={deleteTarget}
            isSubmitting={isSubmitting}
            onConfirm={remove}
            onOpenChange={setDeleteTarget}
            t={t}
          />
        </>
      )}
    </div>
  );
}

export function EmployeeExperiencePanel({
  canManage,
  employeeId,
  locale,
}: EmployeeRelatedRecordsProps): JSX.Element {
  const { t } = useTranslation();
  const [records, setRecords] = useState<HrRecord[]>([]);
  const [formValues, setFormValues] = useState<ExperienceFormValues>(experienceDefaults);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<HrRecord | null>(null);
  const [error, setError] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadRecords = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await hrApiClient.list({
        entity: "employee_experience",
        page: 1,
        pageSize: 100,
        filters: { employee_id: { operator: "equals", value: employeeId } },
        orderBy: "started_at",
        orderDirection: "desc",
      });
      setRecords(result.items);
    } catch {
      toast.error(t("employeesDetails.experience.toasts.loadError"));
    } finally {
      setIsLoading(false);
    }
  }, [employeeId, t]);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  function updateField(name: keyof ExperienceFormValues, value: string): void {
    setFormValues((current) => ({
      ...current,
      [name]: value,
      ...(name === "is_current" && value === "1" ? { ended_at: "" } : {}),
    }));
  }

  function openCreate(): void {
    if (!canManage) return;
    setEditingId(null);
    setError("");
    setFormValues(experienceDefaults);
    setIsDialogOpen(true);
  }

  function openEdit(record: HrRecord): void {
    if (!canManage) return;
    const id = getRecordId(record);
    if (!id) return;
    setEditingId(id);
    setError("");
    setFormValues({
      company_name: getString(record.company_name),
      position_name: getString(record.position_name),
      started_at: getString(record.started_at),
      ended_at: getString(record.ended_at),
      is_current: String(Number(record.is_current ?? 0)),
      responsibilities: getString(record.responsibilities),
    });
    setIsDialogOpen(true);
  }

  function closeDialog(): void {
    setIsDialogOpen(false);
    setEditingId(null);
    setError("");
    setFormValues(experienceDefaults);
  }

  async function save(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const validationError = validateExperience(formValues, t);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError("");
    setIsSubmitting(true);
    try {
      const data = mapExperienceFormToRecord(employeeId, formValues);
      if (editingId) {
        await hrApiClient.update({ entity: "employee_experience", id: editingId, data });
      } else {
        await hrApiClient.create({ entity: "employee_experience", data });
      }
      toast.success(t(editingId ? "forms.toasts.updated" : "forms.toasts.created"));
      await loadRecords();
      closeDialog();
    } catch (saveError) {
      toast.error(getErrorMessage(saveError, t("forms.toasts.updateError")));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function remove(): Promise<void> {
    const id = getRecordId(deleteTarget);
    if (!id) return;
    setIsSubmitting(true);
    try {
      await hrApiClient.delete({ entity: "employee_experience", id });
      setDeleteTarget(null);
      await loadRecords();
      toast.success(t("forms.toasts.deleted"));
    } catch (deleteError) {
      toast.error(getErrorMessage(deleteError, t("forms.toasts.deleteError")));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      <RelatedRecordsHeader
        actionLabel={t("employeesDetails.experience.formTitle")}
        description={t("employeesDetails.experience.description")}
        icon={<FiBriefcase className="h-6 w-6" />}
        onAction={canManage ? openCreate : undefined}
        recordCount={records.length}
        title={t("employeesDetails.sections.experience")}
      />
      <RelatedRecordsList
        emptyTitle={t("employeesDetails.experience.emptyTitle")}
        isLoading={isLoading}
        loadingLabel={t("common.table.loading")}
        records={records}
        renderRecord={(record) => (
          <ExperienceRecordCard
            locale={locale}
            onDelete={canManage ? () => setDeleteTarget(record) : undefined}
            onEdit={canManage ? () => openEdit(record) : undefined}
            record={record}
            t={t}
          />
        )}
      />

      {canManage && (
        <>
          <Dialog
            description={t("employeesDetails.experience.description")}
            onOpenChange={(open) => (open ? setIsDialogOpen(true) : closeDialog())}
            open={isDialogOpen}
            title={t(editingId ? "employeesDetails.experience.editTitle" : "employeesDetails.experience.formTitle")}
          >
            <form className="grid gap-4" onSubmit={save}>
              <RelatedTextField label={t("forms.fields.companyName")} onChange={(value) => updateField("company_name", value)} required value={formValues.company_name} />
              <RelatedTextField label={t("forms.fields.experiencePositionName")} onChange={(value) => updateField("position_name", value)} required value={formValues.position_name} />
              <div className="grid gap-4 sm:grid-cols-2">
                <RelatedTextField label={t("forms.fields.startedAt")} onChange={(value) => updateField("started_at", value)} type="date" value={formValues.started_at} />
                <RelatedTextField disabled={formValues.is_current === "1"} label={t("forms.fields.endedAt")} onChange={(value) => updateField("ended_at", value)} type="date" value={formValues.ended_at} />
              </div>
              <RelatedToggleField
                checked={formValues.is_current === "1"}
                label={t("forms.fields.isCurrent")}
                onCheckedChange={(checked) => updateField("is_current", checked ? "1" : "0")}
              />
              <RelatedTextareaField
                label={t("forms.fields.responsibilities")}
                onChange={(value) => updateField("responsibilities", value)}
                value={formValues.responsibilities}
              />
              <FieldError message={error} />
              <FormActions editing={Boolean(editingId)} isSubmitting={isSubmitting} onCancel={closeDialog} t={t} />
            </form>
          </Dialog>
          <DeleteDialog
            deleteTarget={deleteTarget}
            isSubmitting={isSubmitting}
            onConfirm={remove}
            onOpenChange={setDeleteTarget}
            t={t}
          />
        </>
      )}
    </div>
  );
}

function FormActions({
  editing,
  isSubmitting,
  onCancel,
  t,
}: {
  editing: boolean;
  isSubmitting: boolean;
  onCancel: () => void;
  t: ReturnType<typeof useTranslation>["t"];
}): JSX.Element {
  return (
    <div className="flex justify-end gap-3 pt-2">
      <Button type="button" variant="secondary" onClick={onCancel}>
        {t("common.actions.cancel")}
      </Button>
      <Button disabled={isSubmitting} type="submit" variant="primary">
        {t(editing ? "common.actions.save" : "common.actions.create")}
      </Button>
    </div>
  );
}

function DeleteDialog({
  deleteTarget,
  isSubmitting,
  onConfirm,
  onOpenChange,
  t,
}: {
  deleteTarget: HrRecord | null;
  isSubmitting: boolean;
  onConfirm: () => Promise<void>;
  onOpenChange: (record: HrRecord | null) => void;
  t: ReturnType<typeof useTranslation>["t"];
}): JSX.Element {
  return (
    <ConfirmDialog
      cancelLabel={t("common.actions.cancel")}
      confirmLabel={t("common.actions.delete")}
      description={t("forms.delete.description")}
      isLoading={isSubmitting}
      onConfirm={() => void onConfirm()}
      onOpenChange={(open) => !open && onOpenChange(null)}
      open={Boolean(deleteTarget)}
      title={t("forms.delete.title")}
    />
  );
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback;
  const parts = error.message.split("Error: ");
  return parts[parts.length - 1] || fallback;
}
