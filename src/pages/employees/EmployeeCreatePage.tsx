import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
import { useForm, type FieldErrors, type Resolver } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import { Button } from "../../shared/ui";
import { getAppLocale } from "../../shared/i18n";
import { hrApiClient } from "../../shared/lib/hrApiClient";
import { getUserFacingErrorMessage } from "../../shared/lib/userFacingErrors";
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
import { EmployeeCreateProgress } from "../../features/employees/create/EmployeeCreateProgress";
import { EmployeeCreateReview } from "../../features/employees/create/EmployeeCreateReview";
import { employeeCreateSteps } from "../../features/employees/create/employeeCreateSteps";
import {
  EmployeeAddressFormSection,
  EmployeeCompanyFormSection,
  EmployeePersonalFormSection,
} from "../../features/employees/forms/EmployeeFormSections";
import { employeeCreateSchema } from "../../features/employees/forms/employeeFormValidation";
import { useEmployeeFormOptions } from "../../features/employees/hooks/useEmployeeFormOptions";

export function EmployeeCreatePage(): JSX.Element {
  const { i18n, t } = useTranslation();
  const locale = getAppLocale(i18n.language);
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const {
    departments,
    enterprises,
    genderOptions,
    isRelationsLoading,
    positions,
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
  const enterpriseId = watch("enterprise_id");
  const departmentId = watch("department_id");

  const availableDepartments = useMemo(
    () => departments.filter((department) => department.enterpriseId === enterpriseId),
    [departments, enterpriseId],
  );
  const availablePositions = useMemo(
    () => positions.filter((position) => position.departmentId === departmentId),
    [departmentId, positions],
  );

  useEffect(() => {
    if (isRelationsLoading || getValues("enterprise_id") || enterprises.length !== 1) {
      return;
    }
    setValue("enterprise_id", enterprises[0].value, { shouldValidate: true });
  }, [enterprises, getValues, isRelationsLoading, setValue]);

  useEffect(() => {
    const currentDepartmentId = getValues("department_id");
    if (
      currentDepartmentId &&
      !availableDepartments.some((department) => department.value === currentDepartmentId)
    ) {
      setValue("department_id", "", { shouldValidate: true });
      setValue("position_id", "", { shouldValidate: true });
    }
  }, [availableDepartments, getValues, setValue]);

  useEffect(() => {
    const currentPositionId = getValues("position_id");
    if (
      currentPositionId &&
      !availablePositions.some((position) => position.value === currentPositionId)
    ) {
      setValue("position_id", "", { shouldValidate: true });
    }
  }, [availablePositions, getValues, setValue]);

  async function handleNext(): Promise<void> {
    if (activeStep >= employeeCreateSteps.length - 1 || isSubmitting) return;
    const currentStep = employeeCreateSteps[activeStep];
    const isStepValid = await trigger(currentStep.fields);
    if (!isStepValid) return;
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
    if (activeStep !== employeeCreateSteps.length - 1 || isSubmitting) return;
    await handleSubmit(handleCreate, handleCreateInvalid)();
  }

  function handleCreateInvalid(
    formErrors: FieldErrors<EmployeeFormValues>,
  ): void {
    const invalidStepIndex = employeeCreateSteps.findIndex((step) =>
      step.fields.some((field) => Boolean(formErrors[field])),
    );
    if (invalidStepIndex >= 0) setActiveStep(invalidStepIndex);
    toast.error(t("employeesCreate.toasts.validationError"));
  }

  async function handleCreate(values: EmployeeFormValues): Promise<void> {
    if (activeStep !== employeeCreateSteps.length - 1 || isSubmitting) return;
    setIsSubmitting(true);

    try {
      const normalizedValues = normalizeEmployeeFormValues(values);
      const created = await hrApiClient.create({
        entity: "employees",
        data: mapEmployeeFormValuesToRecord(normalizedValues),
      });
      const id = Number(created.id);
      toast.success(t("employeesCreate.toasts.created"));
      navigate(Number.isFinite(id) ? `/employees/${id}` : "/employees");
    } catch (error) {
      toast.error(
        getUserFacingErrorMessage(
          error,
          "Не удалось создать сотрудника. Проверьте заполненные данные",
        ),
      );
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

  function handleEnterpriseChange(value: string): void {
    setValue("enterprise_id", value, { shouldDirty: true, shouldValidate: true });
    setValue("department_id", "", { shouldDirty: true, shouldValidate: true });
    setValue("position_id", "", { shouldDirty: true, shouldValidate: true });
  }

  const normalizedReviewValues = normalizeEmployeeFormValues(watchedValues);
  const enterpriseName =
    enterprises.find((item) => item.value === normalizedReviewValues.enterprise_id)?.label ?? "";
  const departmentName =
    departments.find((item) => item.value === normalizedReviewValues.department_id)?.label ?? "";
  const positionName =
    positions.find((item) => item.value === normalizedReviewValues.position_id)?.label ?? "";

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
          <EmployeeCompanyFormSection
            control={control}
            departments={availableDepartments}
            enterpriseId={enterpriseId}
            enterprises={enterprises}
            errors={errors}
            isRelationsLoading={isRelationsLoading}
            onEnterpriseChange={handleEnterpriseChange}
            positions={availablePositions}
            register={register}
            selectedDepartmentId={departmentId}
            t={t}
          />
        )}

        {activeStep === 3 && (
          <EmployeeCreateReview
            departmentName={departmentName}
            enterpriseName={enterpriseName}
            locale={locale}
            positionName={positionName}
            t={t}
            values={normalizedReviewValues}
          />
        )}
      </div>

      <footer className="app-surface-muted flex flex-col gap-3 p-5 sm:flex-row sm:justify-end sm:p-6">
        <Button type="button" onClick={() => navigate("/employees")} variant="ghost">
          {t("employeesCreate.actions.cancel")}
        </Button>
        <Button type="button" onClick={handleBack} variant="secondary">
          {t("employeesCreate.actions.back")}
        </Button>
        {activeStep < employeeCreateSteps.length - 1 ? (
          <Button type="button" onClick={() => void handleNext()} variant="primary">
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
