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
      'employee_code',
      'department_id',
      'position_id',
      'last_name',
      'first_name',
      'middle_name',
      'birth_date',
      'gender',
      'address',
      'phone',
      'email',
      'hire_date',
      'status',
      'note',
    ],
    ['employee_code', 'last_name', 'first_name', 'middle_name', 'phone', 'email', 'address'],
    { defaultOrderBy: 'last_name' },
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