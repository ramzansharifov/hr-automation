import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
import {
  useForm,
  type FieldErrors,
  type Resolver,
} from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";

import type {
  EmployeeDuplicateCheckParams,
  EmployeeDuplicateCheckResult,
  HrRecord,
} from "../../shared/types/hr";
import { ActionButton, LoadingState } from "../../shared/ui";
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
  const { candidateId: candidateIdParam } = useParams<{ candidateId?: string }>();
  const candidateId = Number(candidateIdParam);
  const isCandidateHire = candidateIdParam !== undefined;
  const [candidateRecord, setCandidateRecord] = useState<HrRecord | null>(null);
  const [isCandidateLoading, setIsCandidateLoading] = useState(isCandidateHire);
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
  } = useEmployeeFormOptions(!isCandidateHire);
  const {
    clearErrors,
    control,
    formState: { errors },
    getValues,
    handleSubmit,
    register,
    reset,
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

  const formEnterprises = useMemo(() => {
    if (!isCandidateHire || !candidateRecord) return enterprises;
    const value = idValue(candidateRecord.enterprise_id);
    if (!value || enterprises.some((item) => item.value === value)) return enterprises;
    return [
      ...enterprises,
      {
        value,
        label: textValue(candidateRecord.enterprise_name) || `Предприятие #${value}`,
      },
    ];
  }, [candidateRecord, enterprises, isCandidateHire]);

  const formDepartments = useMemo(() => {
    if (!isCandidateHire || !candidateRecord) return departments;
    const value = idValue(candidateRecord.department_id);
    if (!value || departments.some((item) => item.value === value)) return departments;
    return [
      ...departments,
      {
        value,
        label: textValue(candidateRecord.department_name) || `Отдел #${value}`,
        enterpriseId: idValue(candidateRecord.enterprise_id),
      },
    ];
  }, [candidateRecord, departments, isCandidateHire]);

  const formPositions = useMemo(() => {
    if (!isCandidateHire || !candidateRecord) return positions;
    const value = idValue(candidateRecord.position_id);
    if (!value || positions.some((item) => item.value === value)) return positions;
    return [
      ...positions,
      {
        value,
        label: textValue(candidateRecord.position_name) || `Должность #${value}`,
        departmentId: idValue(candidateRecord.department_id),
      },
    ];
  }, [candidateRecord, isCandidateHire, positions]);

  const availableDepartments = useMemo(
    () =>
      formDepartments.filter(
        (department) => department.enterpriseId === enterpriseId,
      ),
    [enterpriseId, formDepartments],
  );
  const availablePositions = useMemo(
    () => formPositions.filter((position) => position.departmentId === departmentId),
    [departmentId, formPositions],
  );

  useEffect(() => {
    if (!isCandidateHire) {
      setCandidateRecord(null);
      setIsCandidateLoading(false);
      return;
    }

    if (!Number.isInteger(candidateId) || candidateId <= 0) {
      toast.error("Некорректный идентификатор кандидата");
      setIsCandidateLoading(false);
      navigate("/candidates", { replace: true });
      return;
    }

    let active = true;
    setIsCandidateLoading(true);
    void hrApiClient
      .getCandidate(candidateId)
      .then((profile) => {
        if (!active) return;
        if (!profile) throw new Error("Кандидат не найден");

        const candidate = profile.candidate;
        if (candidate.employee_id || candidate.status === "hired") {
          throw new Error("Кандидат уже принят на работу");
        }
        if (candidate.status !== "offer") {
          throw new Error("Оформить сотрудника можно только для кандидата на этапе «Оффер»");
        }
        if (
          candidate.vacancy_status !== "open" ||
          Number(candidate.vacancy_is_archived ?? 0) === 1
        ) {
          throw new Error("Вакансия кандидата должна быть открыта");
        }

        setCandidateRecord(candidate);
        reset(employeeDefaultsFromCandidate(candidate));
      })
      .catch((error) => {
        if (!active) return;
        toast.error(
          getUserFacingErrorMessage(
            error,
            "Не удалось подготовить оформление кандидата",
          ),
        );
        navigate(`/candidates/${candidateId}`, { replace: true });
      })
      .finally(() => {
        if (active) setIsCandidateLoading(false);
      });

    return () => {
      active = false;
    };
  }, [candidateId, isCandidateHire, navigate, reset]);

  useEffect(() => {
    if (
      isRelationsLoading ||
      isCandidateHire ||
      getValues("enterprise_id") ||
      formEnterprises.length !== 1
    ) {
      return;
    }
    setValue("enterprise_id", formEnterprises[0].value, { shouldValidate: true });
  }, [
    formEnterprises,
    getValues,
    isCandidateHire,
    isRelationsLoading,
    setValue,
  ]);

  useEffect(() => {
    if (isRelationsLoading || isCandidateHire) return;
    const currentDepartmentId = getValues("department_id");
    if (
      currentDepartmentId &&
      !availableDepartments.some((department) => department.value === currentDepartmentId)
    ) {
      setValue("department_id", "", { shouldValidate: true });
      setValue("position_id", "", { shouldValidate: true });
    }
  }, [
    availableDepartments,
    getValues,
    isCandidateHire,
    isRelationsLoading,
    setValue,
  ]);

  useEffect(() => {
    if (isRelationsLoading || isCandidateHire) return;
    const currentPositionId = getValues("position_id");
    if (
      currentPositionId &&
      !availablePositions.some((position) => position.value === currentPositionId)
    ) {
      setValue("position_id", "", { shouldValidate: true });
    }
  }, [
    availablePositions,
    getValues,
    isCandidateHire,
    isRelationsLoading,
    setValue,
  ]);

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
      navigate(isCandidateHire ? `/candidates/${candidateId}` : "/employees");
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
      const created = isCandidateHire
        ? await hrApiClient.hireCandidate({
            candidateId,
            hireDate: normalizedValues.hire_date,
            salary: Number(normalizedValues.salary || 0),
            employeeNumber: optionalValue(normalizedValues.employee_number),
            lastName: normalizedValues.last_name,
            firstName: normalizedValues.first_name,
            middleName: normalizedValues.middle_name,
            birthDate: normalizedValues.birth_date,
            gender: normalizedValues.gender,
            phone: normalizedValues.phone,
            email: normalizedValues.email,
            addressCountry: normalizedValues.address_country,
            addressCity: normalizedValues.address_city,
            addressStreet: normalizedValues.address_street,
            addressHouse: normalizedValues.address_house,
            addressApartment: normalizedValues.address_apartment,
            address: normalizedValues.address,
            contractNumber: normalizedValues.contract_number,
            contractDate: normalizedValues.contract_date,
            contractEndDate: normalizedValues.contract_end_date,
            probationEndDate: normalizedValues.probation_end_date,
            workplace: normalizedValues.workplace,
          })
        : await hrApiClient.create({
            entity: "employees",
            data: mapEmployeeFormValuesToRecord(normalizedValues),
          });
      const id = Number(created.id);
      toast.success(
        isCandidateHire
          ? "Кандидат принят на работу и зарегистрирован как сотрудник"
          : t("employeesCreate.toasts.created"),
      );
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

  useEffect(() => {
    if (
      !duplicateState ||
      duplicateState.signature === currentDuplicateSignature
    ) {
      return;
    }

    clearErrors([
      "employee_number",
      "last_name",
      "first_name",
      "middle_name",
      "birth_date",
    ]);
    setDuplicateState(null);
  }, [clearErrors, currentDuplicateSignature, duplicateState]);

  const enterpriseName =
    formEnterprises.find(
      (item) => item.value === normalizedReviewValues.enterprise_id,
    )?.label ?? "";
  const departmentName =
    formDepartments.find(
      (item) => item.value === normalizedReviewValues.department_id,
    )?.label ?? "";
  const positionName =
    formPositions.find(
      (item) => item.value === normalizedReviewValues.position_id,
    )?.label ?? "";

  if (isCandidateLoading) {
    return <LoadingState label="Подготовка стандартной формы сотрудника..." />;
  }

  return (
    <div className="app-surface app-border mx-auto max-w-6xl overflow-hidden rounded-[28px] border">
      {isCandidateHire && candidateRecord && (
        <section className="app-accent-soft app-border-soft border-b px-5 py-4 sm:px-7">
          <p className="app-text font-black">Оформление кандидата как сотрудника</p>
          <p className="app-muted mt-1 text-sm">
            Известные данные кандидата и назначение из вакансии уже заполнены.
            Проверьте их, дополните кадровые сведения и завершите стандартную форму.
          </p>
        </section>
      )}
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
            assignmentLocked={isCandidateHire}
            control={control}
            departments={availableDepartments}
            enterpriseId={enterpriseId}
            enterprises={formEnterprises}
            employmentTypeLocked={isCandidateHire}
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
          onClick={() =>
            navigate(isCandidateHire ? `/candidates/${candidateId}` : "/employees")
          }
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

function employeeDefaultsFromCandidate(candidate: HrRecord): EmployeeFormValues {
  return {
    ...employeeDefaultValues,
    enterprise_id: idValue(candidate.enterprise_id),
    last_name: textValue(candidate.last_name),
    first_name: textValue(candidate.first_name),
    middle_name: textValue(candidate.middle_name),
    birth_date: textValue(candidate.birth_date),
    gender: textValue(candidate.gender),
    phone: textValue(candidate.phone),
    email: textValue(candidate.email),
    address_country: textValue(candidate.address_country),
    address_city: textValue(candidate.address_city),
    address_street: textValue(candidate.address_street),
    address_house: textValue(candidate.address_house),
    address_apartment: textValue(candidate.address_apartment),
    address: textValue(candidate.address),
    department_id: idValue(candidate.department_id),
    position_id: idValue(candidate.position_id),
    employment_type:
      textValue(candidate.vacancy_employment_type) ||
      textValue(candidate.employment_type) ||
      employeeDefaultValues.employment_type,
  };
}

function idValue(value: unknown): string {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? String(id) : "";
}

function textValue(value: unknown): string {
  return String(value ?? "").trim();
}

function optionalValue(value: string): string | undefined {
  const normalized = value.trim();
  return normalized || undefined;
}
