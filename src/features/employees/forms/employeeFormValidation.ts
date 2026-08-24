import { z } from 'zod'

export const requiredMessage = 'forms.validation.required'
export const invalidEmailMessage = 'forms.validation.email'
export const nonNegativeMessage = 'forms.validation.nonNegative'

export function requiredString(): z.ZodString {
  return z.string().trim().min(1, requiredMessage)
}

export function optionalString(): z.ZodOptional<z.ZodString> {
  return z.string().optional()
}

export function optionalEmail(): z.ZodString {
  return z
    .string()
    .trim()
    .refine((value) => value === '' || z.email().safeParse(value).success, invalidEmailMessage)
}

export function requiredNumberString(): z.ZodString {
  return z
    .string()
    .trim()
    .min(1, requiredMessage)
    .refine((value) => Number.isFinite(Number(value)), requiredMessage)
    .refine((value) => Number(value) >= 0, nonNegativeMessage)
}

export const employeePersonalSchema = z.object({
  last_name: requiredString(),
  first_name: requiredString(),
  middle_name: optionalString(),
  birth_date: optionalString(),
  gender: optionalString(),
  phone: optionalString(),
  email: optionalEmail(),
})

export const employeeAddressSchema = z.object({
  address_country: optionalString(),
  address_city: optionalString(),
  address_street: optionalString(),
  address_house: optionalString(),
  address_apartment: optionalString(),
  address: optionalString(),
})

export const employeeCompanySchema = z.object({
  employee_number: optionalString(),
  employment_type: requiredString(),
  contract_number: optionalString(),
  contract_date: optionalString(),
  contract_end_date: optionalString(),
  probation_end_date: optionalString(),
  workplace: optionalString(),
})

export const employeeAssignmentSchema = z.object({
  department_id: optionalString(),
  position_id: optionalString(),
  hire_date: optionalString(),
  status: requiredString(),
  salary: requiredNumberString(),
})

export const employeeCreateSchema = employeePersonalSchema
  .merge(employeeAddressSchema)
  .merge(employeeCompanySchema)
  .merge(employeeAssignmentSchema)

export const employeeSectionSchemas = {
  personal: employeePersonalSchema,
  address: employeeAddressSchema,
  company: employeeCompanySchema,
} as const

export type EmployeeFormSectionKey = keyof typeof employeeSectionSchemas

export const employeeSectionFields = {
  personal: ['last_name', 'first_name', 'middle_name', 'birth_date', 'gender', 'phone', 'email'],
  address: [
    'address_country',
    'address_city',
    'address_street',
    'address_house',
    'address_apartment',
    'address',
  ],
  company: [
    'employee_number',
    'employment_type',
    'contract_number',
    'contract_date',
    'contract_end_date',
    'probation_end_date',
    'workplace',
  ],
} as const
