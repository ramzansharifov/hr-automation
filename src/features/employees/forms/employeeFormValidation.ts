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
  department_id: requiredNumberString(),
  position_id: requiredNumberString(),
  hire_date: requiredString(),
  status: requiredString(),
  salary: requiredNumberString(),
})

export const employeeNotesSchema = z.object({
  note: optionalString(),
})

export const employeeCreateSchema = employeePersonalSchema
  .merge(employeeAddressSchema)
  .merge(employeeCompanySchema)
  .merge(employeeNotesSchema)

export const employeeSectionSchemas = {
  personal: employeePersonalSchema,
  address: employeeAddressSchema,
  company: employeeCompanySchema,
  notes: employeeNotesSchema,
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
  company: ['department_id', 'position_id', 'hire_date', 'status', 'salary'],
  notes: ['note'],
} as const