import { z } from "zod";
import type { HrEntityKey } from "../../../shared/types/hr";
import type { HrEntityFormValues } from "../lib/hrEntityFormMapper";

const requiredMessage = "forms.validation.required";
const invalidEmailMessage = "forms.validation.email";
const nonNegativeMessage = "forms.validation.nonNegative";
const invalidDateRangeMessage = "forms.validation.dateRange";

function requiredString(): z.ZodString {
  return z.string().trim().min(1, requiredMessage);
}

function optionalString(): z.ZodOptional<z.ZodString> {
  return z.string().optional();
}

function optionalEmail(): z.ZodString {
  return z
    .string()
    .trim()
    .refine(
      (value) => value === "" || z.email().safeParse(value).success,
      invalidEmailMessage,
    );
}

function requiredNumberString(): z.ZodString {
  return z
    .string()
    .trim()
    .min(1, requiredMessage)
    .refine((value) => Number.isFinite(Number(value)), requiredMessage)
    .refine((value) => Number(value) >= 0, nonNegativeMessage);
}

function optionalNumberString(): z.ZodString {
  return z
    .string()
    .trim()
    .refine(
      (value) => value === "" || Number.isFinite(Number(value)),
      requiredMessage,
    )
    .refine((value) => value === "" || Number(value) >= 0, nonNegativeMessage);
}

const enterprisesSchema = z.object({
  legal_form: requiredString(),
  name: requiredString(),
  legal_name: optionalString(),
  registration_number: optionalString(),
  phone: optionalString(),
  email: optionalEmail(),
  address: optionalString(),
});

const departmentsSchema = z.object({
  enterprise_id: requiredNumberString(),
  name: requiredString(),
  phone: optionalString(),
  email: optionalEmail(),
  location: optionalString(),
  created_on: optionalString(),
});

const positionsSchema = z.object({
  department_id: requiredNumberString(),
  name: requiredString(),
  responsibilities: optionalString(),
});

const employeesSchema = z.object({
  employee_number: optionalString(),
  last_name: requiredString(),
  first_name: requiredString(),
  middle_name: optionalString(),
  birth_date: optionalString(),
  gender: optionalString(),
  phone: optionalString(),
  email: optionalEmail(),
  address_country: optionalString(),
  address_city: optionalString(),
  address_street: optionalString(),
  address_house: optionalString(),
  address_apartment: optionalString(),
  address: optionalString(),
  employment_type: optionalString(),
  contract_number: optionalString(),
  contract_date: optionalString(),
  contract_end_date: optionalString(),
  probation_end_date: optionalString(),
  workplace: optionalString(),
});

const employeeEducationSchema = z.object({
  employee_id: requiredNumberString(),
  education_degree: requiredString(),
  institution_name: requiredString(),
  speciality: optionalString(),
  started_at: optionalString(),
  ended_at: optionalString(),
  document_number: optionalString(),
});

const employeeExperienceSchema = z.object({
  employee_id: requiredNumberString(),
  company_name: requiredString(),
  position_name: requiredString(),
  started_at: optionalString(),
  ended_at: optionalString(),
  is_current: optionalNumberString(),
  responsibilities: optionalString(),
});

const employmentHistorySchema = z.object({
  employee_id: requiredNumberString(),
  change_type: requiredString(),
  effective_at: requiredString(),
  reason: optionalString(),
});

const vacationTypesSchema = z.object({
  name: requiredString(),
  is_paid_default: requiredNumberString(),
  is_active: requiredNumberString(),
});

const vacationsSchema = z
  .object({
    employee_id: requiredNumberString(),
    vacation_type_id: requiredNumberString(),
    starts_at: requiredString(),
    ends_at: requiredString(),
    is_paid: requiredNumberString(),
    reason: optionalString(),
    status: requiredString(),
  })
  .refine(
    (value) =>
      !value.starts_at || !value.ends_at || value.ends_at >= value.starts_at,
    {
      message: invalidDateRangeMessage,
      path: ["ends_at"],
    },
  );

export const hrEntitySchemas = {
  enterprises: enterprisesSchema,
  departments: departmentsSchema,
  positions: positionsSchema,
  employees: employeesSchema,
  employee_education: employeeEducationSchema,
  employee_experience: employeeExperienceSchema,
  employment_history: employmentHistorySchema,
  vacation_types: vacationTypesSchema,
  vacations: vacationsSchema,
} satisfies Record<HrEntityKey, z.ZodType<unknown>>;

export function getHrEntitySchema(
  entity: HrEntityKey,
): z.ZodType<unknown, HrEntityFormValues> {
  return hrEntitySchemas[entity] as z.ZodType<unknown, HrEntityFormValues>;
}
