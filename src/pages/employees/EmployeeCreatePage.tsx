import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm, type FieldErrors, type Resolver } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import { Button } from "../../shared/ui";
import { getAppLocale } from "../../shared/i18n";
import { hrApiClient } from "../../shared/lib/hrApiClient";
import {
  mapEmployeeFormValuesToRecord,
  normalizeEmail,
  normalizeEmployeeFormValues,
  normalizePersonName,
  normalizePhone,
} from "../../features/employees/lib/employeeFormatters";
import {
  employeeDefaultValues,
  type EmployeeFormValues,
} from "../../features/employees/types";
import { useEmployeeFormOptions } from "../../features/employees/hooks/useEmployeeFormOptions";
import { EmployeeCreateProgress } from "../../features/employees/create/EmployeeCreateProgress";
import { EmployeeCreateReview } from "../../features/employees/create/EmployeeCreateReview";
import { employeeCreateSteps } from "../../features/employees/create/employeeCreateSteps";
import {
  EmployeeAddressFormSection,
  EmployeeCompanyFormSection,
  EmployeeNotesFormSection,
  EmployeePersonalFormSection,
} from "../../features/employees/forms/EmployeeFormSections";
import { employeeCreateSchema } from "../../features/employees/forms/employeeFormValidation";

export function EmployeeCreatePage(): JSX.Element {
  const { i18n, t } = useTranslation();
  const locale = getAppLocale(i18n.language);
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const {
    departments,
    genderOptions,
    isRelationsLoading,
    positions,
    statusOptions,
  } = useEmployeeFormOptions();
  const {
    control,
    formState: { errors },
    getValues,
    handleSubmit,
    register,
    setValue,
    trigger,
    watch,
  } = useForm<EmployeeFormValues>({
    defaultValues: employeeDefaultValues,
    resolver: zodResolver(employeeCreateSchema) as Resolver<EmployeeFormValues>,
  });
  const watchedValues = watch();
  const availablePositions = positions.filter(
    (position) =>
      !watchedValues.department_id ||
      position.departmentId === watchedValues.department_id,
  );

  useEffect(() => {
    if (!watchedValues.position_id) return;

    const selectedPosition = positions.find(
      (position) => position.value === watchedValues.position_id,
    );

    if (
      !selectedPosition ||
      (watchedValues.department_id &&
        selectedPosition.departmentId !== watchedValues.department_id)
    ) {
      setValue("position_id", "");
      return;
    }

    setValue("salary", selectedPosition.baseSalary);
  }, [
    positions,
    setValue,
    watchedValues.department_id,
    watchedValues.position_id,
  ]);

  async function handleNext(): Promise<void> {
    if (activeStep >= employeeCreateSteps.length - 1 || isSubmitting) {
      return;
    }

    const currentStep = employeeCreateSteps[activeStep];
    const isStepValid = await trigger(currentStep.fields);

    if (!isStepValid) {
      return;
    }

    setActiveStep((current) =>
      Math.min(current + 1, employeeCreateSteps.length - 1),
    );
  }

  function handleBack(): void {
    if (activeStep === 0) {
      navigate("/employees");
      return;
    }

    setActiveStep((current) => Math.max(current - 1, 0));
  }

  async function handleFinalCreate(): Promise<void> {
    if (activeStep !== employeeCreateSteps.length - 1 || isSubmitting) {
      return;
    }

    await handleSubmit(handleCreate, handleCreateInvalid)();
  }

  function handleCreateInvalid(
    formErrors: FieldErrors<EmployeeFormValues>,
  ): void {
    const invalidStepIndex = employeeCreateSteps.findIndex((step) =>
      step.fields.some((field) => Boolean(formErrors[field])),
    );

    if (invalidStepIndex >= 0) {
      setActiveStep(invalidStepIndex);
    }

    toast.error(t("employeesCreate.toasts.validationError"));
  }

  async function handleCreate(values: EmployeeFormValues): Promise<void> {
    if (activeStep !== employeeCreateSteps.length - 1 || isSubmitting) {
      return;
    }

    setIsSubmitting(true);

    try {
      const normalizedValues = normalizeEmployeeFormValues(values);
      const created = await hrApiClient.create({
        entity: "employees",
        data: mapEmployeeFormValuesToRecord(normalizedValues),
      });
      const id = Number(created.id);

      toast.success(t("employeesCreate.toasts.created"));

      if (Number.isFinite(id)) {
        navigate(`/employees/${id}`);
      } else {
        navigate("/employees");
      }
    } catch (error) {
      console.error("Employee create error:", error);
      toast.error(t("employeesCreate.toasts.createError"));
    } finally {
      setIsSubmitting(false);
    }
  }

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

  const normalizedReviewValues = normalizeEmployeeFormValues(watchedValues);

  return (
    <div className="app-surface app-border mx-auto max-w-6xl overflow-hidden rounded-[28px] border">
      <section className="app-surface-muted app-border-soft border-b p-5 sm:p-7">
        <EmployeeCreateProgress activeStep={activeStep} t={t} />
      </section>

      <div className="app-border-soft min-h-[430px] border-b p-5 sm:p-8">
        {activeStep === 0 && (
          <EmployeePersonalFormSection
            control={control}
            errors={errors}
            genderOptions={genderOptions}
            normalizeField={normalizeField}
            register={register}
            t={t}
          />
        )}

        {activeStep === 1 && (
          <EmployeeAddressFormSection
            control={control}
            errors={errors}
            register={register}
            t={t}
          />
        )}

        {activeStep === 2 && (
          <div className="space-y-5">
            <EmployeeCompanyFormSection
              control={control}
              departments={departments}
              errors={errors}
              isRelationsLoading={isRelationsLoading}
              positions={availablePositions}
              register={register}
              statusOptions={statusOptions}
              t={t}
            />
            <EmployeeNotesFormSection
              control={control}
              errors={errors}
              register={register}
              t={t}
            />
          </div>
        )}

        {activeStep === 3 && (
          <EmployeeCreateReview
            departments={departments}
            locale={locale}
            positions={positions}
            t={t}
            values={normalizedReviewValues}
          />
        )}
      </div>

      <footer className="app-surface-muted flex flex-col gap-3 p-5 sm:flex-row sm:justify-end sm:p-6">
        <Button
          type="button"
          onClick={() => navigate("/employees")}
          variant="ghost"
        >
          {t("employeesCreate.actions.cancel")}
        </Button>
        <Button type="button" onClick={handleBack} variant="secondary">
          {t("employeesCreate.actions.back")}
        </Button>
        {activeStep < employeeCreateSteps.length - 1 ? (
          <Button
            type="button"
            onClick={() => void handleNext()}
            variant="primary"
          >
            {t("employeesCreate.actions.next")}
          </Button>
        ) : (
          <Button
            disabled={isSubmitting}
            type="button"
            onClick={() => void handleFinalCreate()}
            variant="primary"
          >
            {t("employeesCreate.actions.create")}
          </Button>
        )}
      </footer>
    </div>
  );
}
