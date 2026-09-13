import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
import {
  useForm,
  type FieldErrors,
  type Resolver,
} from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import type {
  EmployeeDuplicateCheckParams,
  EmployeeDuplicateCheckResult,
} from "../../shared/types/hr";
import { ActionButton } from "../../shared/ui";
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
import { EmployeeDuplicateNotice } from "../../features/employees/create/EmployeeDuplicateNotice";
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
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [acceptedDuplicateSignature, setAcceptedDuplicateSignature] =
    useState<string | null>(null);
  const [duplicateState, setDuplicateState] = useState<{
    signature: string;
    result: EmployeeDuplicateCheckResult;
  } | null>(null);
  const {
    departments,
    enterprises,
    genderOptions,
    isRelationsLoading,
    positions,
  } = useEmployeeFormOptions();
  const {
    clearErrors,
    control,
    formState: { errors },
    getValues,
    handleSubmit,
    register,
    setError,
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

  async function handleNext(allowWarnings = false): Promise<void> {
    if (
      activeStep >= employeeCreateSteps.length - 1 ||
      isSubmitting ||
      isCheckingDuplicates
    ) {
      return;
    }

    clearDuplicateFieldErrors();
    const currentStep = employeeCreateSteps[activeStep];
    const isStepValid = await trigger(currentStep.fields);
    if (!isStepValid) return;

    const canContinue = await validateEmployeeDuplicates(
      getValues(),
      allowWarnings,
    );
    if (!canContinue) return;

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

  async function handleFinalCreate(allowWarnings = false): Promise<void> {
    if (
      activeStep !== employeeCreateSteps.length - 1 ||
      isSubmitting ||
      isCheckingDuplicates
    ) {
      return;
    }

    clearDuplicateFieldErrors();
    await handleSubmit(
      (values) => handleCreate(values, allowWarnings),
      handleCreateInvalid,
    )();
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

  async function handleCreate(
    values: EmployeeFormValues,
    allowWarnings = false,
  ): Promise<void> {
    if (
      activeStep !== employeeCreateSteps.length - 1 ||
      isSubmitting ||
      isCheckingDuplicates
    ) {
      return;
    }

    const canContinue = await validateEmployeeDuplicates(
      values,
      allowWarnings,
    );
    if (!canContinue) return;

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

  async function validateEmployeeDuplicates(
    values: EmployeeFormValues,
    allowWarnings: boolean,
  ): Promise<boolean> {
    const normalizedValues = normalizeEmployeeFormValues(values);
    const params = buildEmployeeDuplicateCheckParams(normalizedValues);
    const signature = employeeDuplicateSignature(params);

    setIsCheckingDuplicates(true);
    try {
      const result = await hrApiClient.checkEmployeeDuplicates(params);
      setDuplicateState({ signature, result });

      if (result.matches.length === 0) {
        return true;
      }

      applyBlockingDuplicateErrors(result);

      if (result.hasBlockingMatches) {
        toast.error(
          "Найден дубликат сотрудника. Проверьте совпадающие поля перед продолжением.",
          { toastId: "employee-create-blocking-duplicate" },
        );
        return false;
      }

      if (allowWarnings || acceptedDuplicateSignature === signature) {
        setAcceptedDuplicateSignature(signature);
        return true;
      }

      toast.warning(
        "Найдены возможные совпадения. Проверьте их и подтвердите продолжение.",
        { toastId: "employee-create-possible-duplicate" },
      );
      return false;
    } catch (error) {
      toast.error(
        getUserFacingErrorMessage(
          error,
          "Не удалось проверить сотрудника на дубликаты",
        ),
        { toastId: "employee-create-duplicate-check-error" },
      );
      return false;
    } finally {
      setIsCheckingDuplicates(false);
    }
  }

  function applyBlockingDuplicateErrors(
    result: EmployeeDuplicateCheckResult,
  ): void {
    for (const match of result.matches) {
      for (const field of match.fields) {
        if (!field.blocking) continue;
        const message = `Совпадает с сотрудником «${match.employeeName}»`;

        if (field.field === "employee_number") {
          setError("employee_number", { type: "duplicate", message });
        }
        if (field.field === "identity") {
          setError("last_name", { type: "duplicate", message });
          setError("first_name", { type: "duplicate", message });
          if (getValues("middle_name").trim()) {
            setError("middle_name", { type: "duplicate", message });
          }
          if (getValues("birth_date").trim()) {
            setError("birth_date", { type: "duplicate", message });
          }
        }
      }
    }
  }

  function clearDuplicateFieldErrors(): void {
    clearErrors([
      "employee_number",
      "last_name",
      "first_name",
      "middle_name",
      "birth_date",
    ]);
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
  const currentDuplicateSignature = employeeDuplicateSignature(
    buildEmployeeDuplicateCheckParams(normalizedReviewValues),
  );
  const visibleDuplicateResult =
    duplicateState?.signature === currentDuplicateSignature
      ? duplicateState.result
      : null;
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
        {visibleDuplicateResult && (
          <EmployeeDuplicateNotice
            onContinue={
              visibleDuplicateResult.hasBlockingMatches
                ? undefined
                : () => {
                    if (activeStep === employeeCreateSteps.length - 1) {
                      void handleFinalCreate(true);
                    } else {
                      void handleNext(true);
                    }
                  }
            }
            result={visibleDuplicateResult}
          />
        )}
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
        <ActionButton
          action="cancel"
          onClick={() => navigate("/employees")}
          type="button"
        >
          {t("employeesCreate.actions.cancel")}
        </ActionButton>
        {activeStep > 0 && (
          <ActionButton action="back" onClick={handleBack} type="button">
            {t("employeesCreate.actions.back")}
          </ActionButton>
        )}
        {activeStep < employeeCreateSteps.length - 1 ? (
          <ActionButton
            action="next"
            loading={isCheckingDuplicates}
            onClick={() => void handleNext()}
            type="button"
          >
            {t("employeesCreate.actions.next")}
          </ActionButton>
        ) : (
          <ActionButton
            action="create"
            loading={isSubmitting || isCheckingDuplicates}
            onClick={() => void handleFinalCreate()}
            type="button"
          >
            {t("employeesCreate.actions.create")}
          </ActionButton>
        )}
      </footer>
    </div>
  );
}

function buildEmployeeDuplicateCheckParams(
  values: EmployeeFormValues,
): EmployeeDuplicateCheckParams {
  const enterpriseId = Number(values.enterprise_id);
  return {
    enterpriseId:
      Number.isInteger(enterpriseId) && enterpriseId > 0
        ? enterpriseId
        : null,
    employeeNumber: values.employee_number,
    lastName: values.last_name,
    firstName: values.first_name,
    middleName: values.middle_name,
    birthDate: values.birth_date,
    phone: values.phone,
    email: values.email,
    contractNumber: values.contract_number,
  };
}

function employeeDuplicateSignature(
  params: EmployeeDuplicateCheckParams,
): string {
  return JSON.stringify({
    enterpriseId: params.enterpriseId ?? null,
    employeeNumber: normalizeComparable(params.employeeNumber),
    lastName: normalizeComparable(params.lastName),
    firstName: normalizeComparable(params.firstName),
    middleName: normalizeComparable(params.middleName),
    birthDate: normalizeComparable(params.birthDate),
    phone: String(params.phone ?? "").replace(/\D/g, ""),
    email: normalizeComparable(params.email),
    contractNumber: normalizeComparable(params.contractNumber),
  });
}

function normalizeComparable(value: unknown): string {
  return String(value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}
