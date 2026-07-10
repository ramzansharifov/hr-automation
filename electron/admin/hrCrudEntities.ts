import type { HrEntityKey } from '../../src/shared/types/hr'

export interface HrCrudEntityConfig {
  key: HrEntityKey
  tableName: string
  primaryKey: string
  allowedColumns: string[]
  searchableColumns: string[]
  defaultOrderBy: string
  hasUpdatedAt: boolean
}

function entity(
  key: HrEntityKey,
  allowedColumns: string[],
  searchableColumns: string[],
  options: Partial<Pick<HrCrudEntityConfig, 'defaultOrderBy' | 'hasUpdatedAt'>> = {},
): HrCrudEntityConfig {
  return {
    key,
    tableName: key,
    primaryKey: 'id',
    allowedColumns,
    searchableColumns,
    defaultOrderBy: options.defaultOrderBy ?? 'id',
    hasUpdatedAt: options.hasUpdatedAt ?? true,
  }
}

export const hrCrudEntities: Record<HrEntityKey, HrCrudEntityConfig> = {
  departments: entity(
    'departments',
    ['name', 'manager_name', 'phone', 'email', 'location', 'created_on', 'note'],
    ['name', 'manager_name', 'phone', 'email', 'location'],
    { defaultOrderBy: 'name' },
  ),

  positions: entity(
    'positions',
    ['name', 'base_salary', 'allowance', 'bonus', 'responsibilities', 'requirements', 'note'],
    ['name', 'responsibilities', 'requirements'],
    { defaultOrderBy: 'name' },
  ),

  employees: entity(
    'employees',
    [
      'department_id',
      'position_id',
      'last_name',
      'first_name',
      'middle_name',
      'birth_date',
      'gender',
      'address',
      'address_country',
      'address_city',
      'address_street',
      'address_house',
      'address_apartment',
      'phone',
      'email',
      'hire_date',
      'status',
      'salary',
      'note',
    ],
    [
      'last_name',
      'first_name',
      'middle_name',
      'phone',
      'email',
      'address',
      'address_city',
      'address_street',
    ],
    { defaultOrderBy: 'last_name' },
  ),

  employee_education: entity(
    'employee_education',
    [
      'employee_id',
      'education_type',
      'education_degree',
      'institution_name',
      'speciality',
      'started_at',
      'ended_at',
      'document_number',
      'note',
    ],
    ['institution_name', 'speciality', 'document_number', 'note'],
    { defaultOrderBy: 'started_at' },
  ),

  employee_experience: entity(
    'employee_experience',
    [
      'employee_id',
      'company_name',
      'position_name',
      'started_at',
      'ended_at',
      'is_current',
      'responsibilities',
      'note',
    ],
    ['company_name', 'position_name', 'responsibilities', 'note'],
    { defaultOrderBy: 'started_at' },
  ),

  vacations: entity(
    'vacations',
    ['employee_id', 'vacation_type', 'starts_at', 'ends_at', 'days_count', 'reason', 'status', 'note'],
    ['vacation_type', 'reason', 'status', 'note'],
    { defaultOrderBy: 'starts_at' },
  ),

  payroll: entity(
    'payroll',
    [
      'employee_id',
      'accrual_month',
      'base_salary',
      'bonus',
      'allowance',
      'deductions',
      'taxes',
      'net_amount',
      'paid_at',
      'note',
    ],
    ['accrual_month', 'note'],
    { defaultOrderBy: 'accrual_month' },
  ),
}

export function getHrCrudEntityConfig(entityKey: HrEntityKey): HrCrudEntityConfig {
  const config = hrCrudEntities[entityKey]

  if (!config) {
    throw new Error(`Неизвестная HR-сущность: ${entityKey}`)
  }

  return config
}
