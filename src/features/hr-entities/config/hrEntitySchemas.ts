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

const employeesSchema = z.object({
  last_name: requiredString(),
  first_name: requiredString(),
  middle_name: optionalString(),
  department_id: optionalNumberString(),
  position_id: optionalNumberString(),
  birth_date: optionalString(),
  gender: optionalString(),
  phone: optionalString(),
  email: optionalEmail(),
  hire_date: requiredString(),
  salary: optionalNumberString(),
  status: requiredString(),
  address_country: optionalString(),
  address_city: optionalString(),
  address_street: optionalString(),
  address_house: optionalString(),
  address_apartment: optionalString(),
  address: optionalString(),
  note: optionalString(),
});

const enterprisesSchema = z.object({
  name: requiredString(),
  legal_name: optionalString(),
  registration_number: optionalString(),
  general_director_employee_id: optionalNumberString(),
  phone: optionalString(),
  email: optionalEmail(),
  address: optionalString(),
  note: optionalString(),
});

const employeeEducationSchema = z.object({
  employee_id: requiredNumberString(),
  education_type: requiredString(),
  education_degree: optionalString(),
  institution_name: requiredString(),
  speciality: optionalString(),
  started_at: optionalString(),
  ended_at: optionalString(),
  document_number: optionalString(),
  note: optionalString(),
});

const employeeExperienceSchema = z.object({
  employee_id: requiredNumberString(),
  company_name: requiredString(),
  position_name: requiredString(),
  started_at: optionalString(),
  ended_at: optionalString(),
  is_current: optionalNumberString(),
  responsibilities: optionalString(),
  note: optionalString(),
});

const departmentsSchema = z.object({
  enterprise_id: requiredNumberString(),
  director_employee_id: optionalNumberString(),
  name: requiredString(),
  manager_name: optionalString(),
  phone: optionalString(),
  email: optionalEmail(),
  location: optionalString(),
  created_on: optionalString(),
  note: optionalString(),
});

const positionsSchema = z.object({
  department_id: requiredNumberString(),
  name: requiredString(),
  base_salary: requiredNumberString(),
  allowance: optionalNumberString(),
  bonus: optionalNumberString(),
  responsibilities: optionalString(),
  requirements: optionalString(),
  note: optionalString(),
});

const vacationsSchema = z
  .object({
    employee_id: requiredNumberString(),
    vacation_type: requiredString(),
    starts_at: requiredString(),
    ends_at: requiredString(),
    days_count: requiredNumberString(),
    is_paid: requiredNumberString(),
    payment_amount: optionalNumberString(),
    reason: optionalString(),
    status: requiredString(),
    approved_at: optionalString(),
    note: optionalString(),
  })
  .refine(
    (value) =>
      !value.starts_at || !value.ends_at || value.ends_at >= value.starts_at,
    {
      message: invalidDateRangeMessage,
      path: ["ends_at"],
    },
  );

const payrollSchema = z.object({
  employee_id: requiredNumberString(),
  accrual_month: requiredString(),
  base_salary: requiredNumberString(),
  bonus: optionalNumberString(),
  allowance: optionalNumberString(),
  deductions: optionalNumberString(),
  taxes: optionalNumberString(),
  paid_at: optionalString(),
  note: optionalString(),
});

const employmentHistorySchema = z.object({
  employee_id: requiredNumberString(),
  change_type: requiredString(),
  effective_at: requiredString(),
  previous_department_id: optionalNumberString(),
  new_department_id: optionalNumberString(),
  previous_position_id: optionalNumberString(),
  new_position_id: optionalNumberString(),
  previous_salary: optionalNumberString(),
  new_salary: optionalNumberString(),
  reason: optionalString(),
  note: optionalString(),
});

export const hrEntitySchemas = {
  enterprises: enterprisesSchema,
  employees: employeesSchema,
  employee_education: employeeEducationSchema,
  employee_experience: employeeExperienceSchema,
  employment_history: employmentHistorySchema,
  departments: departmentsSchema,
  positions: positionsSchema,
  vacations: vacationsSchema,
  payroll: payrollSchema,
} satisfies Record<HrEntityKey, z.ZodType<unknown>>;

export function getHrEntitySchema(
  entity: HrEntityKey,
): z.ZodType<unknown, HrEntityFormValues> {
  return hrEntitySchemas[entity] as z.ZodType<unknown, HrEntityFormValues>;
}
