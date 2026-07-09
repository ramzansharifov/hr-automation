import type { HrEntityKey } from '../../../shared/types/hr'

export type HrEntityFormFieldType =
  | 'text'
  | 'email'
  | 'tel'
  | 'number'
  | 'date'
  | 'textarea'
  | 'select'

export interface HrEntityFormOption {
  labelKey: string
  value: string
}

export interface HrEntityFormField {
  name: string
  labelKey: string
  placeholderKey?: string
  required?: boolean
  type: HrEntityFormFieldType
  options?: HrEntityFormOption[]
}

export interface HrEntityFormConfig {
  createTitleKey: string
  editTitleKey: string
  fields: HrEntityFormField[]
}

const statusOptions = {
  employee: [
    { value: 'active', labelKey: 'common.status.active' },
    { value: 'inactive', labelKey: 'common.status.inactive' },
  ],
  vacation: [
    { value: 'planned', labelKey: 'common.status.planned' },
    { value: 'approved', labelKey: 'common.status.approved' },
    { value: 'rejected', labelKey: 'common.status.rejected' },
    { value: 'completed', labelKey: 'common.status.completed' },
  ],
} satisfies Record<string, HrEntityFormOption[]>

export const hrEntityFormConfigs: Record<HrEntityKey, HrEntityFormConfig> = {
  employees: {
    createTitleKey: 'forms.employees.createTitle',
    editTitleKey: 'forms.employees.editTitle',
    fields: [
      { name: 'employee_code', labelKey: 'forms.fields.employeeCode', required: true, type: 'text' },
      { name: 'last_name', labelKey: 'forms.fields.lastName', required: true, type: 'text' },
      { name: 'first_name', labelKey: 'forms.fields.firstName', required: true, type: 'text' },
      { name: 'middle_name', labelKey: 'forms.fields.middleName', type: 'text' },
      { name: 'department_id', labelKey: 'forms.fields.departmentId', type: 'number' },
      { name: 'position_id', labelKey: 'forms.fields.positionId', type: 'number' },
      { name: 'birth_date', labelKey: 'forms.fields.birthDate', type: 'date' },
      {
        name: 'gender',
        labelKey: 'forms.fields.gender',
        type: 'select',
        options: [
          { value: 'male', labelKey: 'common.status.male' },
          { value: 'female', labelKey: 'common.status.female' },
        ],
      },
      { name: 'phone', labelKey: 'forms.fields.phone', type: 'tel' },
      { name: 'email', labelKey: 'forms.fields.email', type: 'email' },
      { name: 'hire_date', labelKey: 'forms.fields.hireDate', required: true, type: 'date' },
      {
        name: 'status',
        labelKey: 'forms.fields.status',
        required: true,
        type: 'select',
        options: statusOptions.employee,
      },
      { name: 'address', labelKey: 'forms.fields.address', type: 'textarea' },
      { name: 'note', labelKey: 'forms.fields.note', type: 'textarea' },
    ],
  },

  departments: {
    createTitleKey: 'forms.departments.createTitle',
    editTitleKey: 'forms.departments.editTitle',
    fields: [
      { name: 'name', labelKey: 'forms.fields.name', required: true, type: 'text' },
      { name: 'manager_name', labelKey: 'forms.fields.managerName', type: 'text' },
      { name: 'phone', labelKey: 'forms.fields.phone', type: 'tel' },
      { name: 'email', labelKey: 'forms.fields.email', type: 'email' },
      { name: 'location', labelKey: 'forms.fields.location', type: 'text' },
      { name: 'created_on', labelKey: 'forms.fields.createdOn', type: 'date' },
      { name: 'note', labelKey: 'forms.fields.note', type: 'textarea' },
    ],
  },

  positions: {
    createTitleKey: 'forms.positions.createTitle',
    editTitleKey: 'forms.positions.editTitle',
    fields: [
      { name: 'name', labelKey: 'forms.fields.name', required: true, type: 'text' },
      { name: 'base_salary', labelKey: 'forms.fields.baseSalary', required: true, type: 'number' },
      { name: 'allowance', labelKey: 'forms.fields.allowance', type: 'number' },
      { name: 'bonus', labelKey: 'forms.fields.bonus', type: 'number' },
      { name: 'responsibilities', labelKey: 'forms.fields.responsibilities', type: 'textarea' },
      { name: 'requirements', labelKey: 'forms.fields.requirements', type: 'textarea' },
      { name: 'note', labelKey: 'forms.fields.note', type: 'textarea' },
    ],
  },

  vacations: {
    createTitleKey: 'forms.vacations.createTitle',
    editTitleKey: 'forms.vacations.editTitle',
    fields: [
      { name: 'employee_id', labelKey: 'forms.fields.employeeId', required: true, type: 'number' },
      { name: 'vacation_type', labelKey: 'forms.fields.vacationType', required: true, type: 'text' },
      { name: 'starts_at', labelKey: 'forms.fields.startsAt', required: true, type: 'date' },
      { name: 'ends_at', labelKey: 'forms.fields.endsAt', required: true, type: 'date' },
      { name: 'days_count', labelKey: 'forms.fields.daysCount', required: true, type: 'number' },
      { name: 'reason', labelKey: 'forms.fields.reason', type: 'textarea' },
      {
        name: 'status',
        labelKey: 'forms.fields.status',
        required: true,
        type: 'select',
        options: statusOptions.vacation,
      },
      { name: 'note', labelKey: 'forms.fields.note', type: 'textarea' },
    ],
  },

  payroll: {
    createTitleKey: 'forms.payroll.createTitle',
    editTitleKey: 'forms.payroll.editTitle',
    fields: [
      { name: 'employee_id', labelKey: 'forms.fields.employeeId', required: true, type: 'number' },
      { name: 'accrual_month', labelKey: 'forms.fields.accrualMonth', required: true, type: 'text' },
      { name: 'base_salary', labelKey: 'forms.fields.baseSalary', required: true, type: 'number' },
      { name: 'bonus', labelKey: 'forms.fields.bonus', type: 'number' },
      { name: 'allowance', labelKey: 'forms.fields.allowance', type: 'number' },
      { name: 'deductions', labelKey: 'forms.fields.deductions', type: 'number' },
      { name: 'taxes', labelKey: 'forms.fields.taxes', type: 'number' },
      { name: 'paid_at', labelKey: 'forms.fields.paidAt', type: 'date' },
      { name: 'note', labelKey: 'forms.fields.note', type: 'textarea' },
    ],
  },
}

export function getHrEntityFormConfig(entity: HrEntityKey): HrEntityFormConfig {
  return hrEntityFormConfigs[entity]
}
