import type { ReactNode } from 'react'
import type { TFunction } from 'i18next'
import type { HrEntityKey, HrRecord } from '../../shared/types/hr'
import { formatCellValue, formatCurrency, formatDate, humanizeStatus } from '../../shared/lib/format'

export interface HrEntityColumn {
  key: string
  label: string
  className?: string
  render?: (record: HrRecord) => ReactNode
}

export interface HrEntityPageConfig {
  entity: HrEntityKey
  title: string
  description: string
  createLabel: string
  defaultOrderBy: string
  columns: HrEntityColumn[]
}

type HrEntityColumnFormat = 'money' | 'date' | 'status' | 'fullName'

interface HrEntityColumnDefinition {
  key: string
  labelKey: string
  className?: string
  format?: HrEntityColumnFormat
}

interface HrEntityPageConfigDefinition {
  entity: HrEntityKey
  titleKey: string
  descriptionKey: string
  createLabelKey: string
  defaultOrderBy: string
  columns: HrEntityColumnDefinition[]
}

const hrEntityConfigDefinitions: Record<HrEntityKey, HrEntityPageConfigDefinition> = {
  employees: {
    entity: 'employees',
    titleKey: 'entities.employees.title',
    descriptionKey: 'entities.employees.description',
    createLabelKey: 'entities.employees.createLabel',
    defaultOrderBy: 'last_name',
    columns: [
      {
        key: 'last_name',
        labelKey: 'entities.employees.columns.fullName',
        format: 'fullName',
        className: 'min-w-[240px] font-bold',
      },
      { key: 'phone', labelKey: 'entities.employees.columns.phone' },
      { key: 'email', labelKey: 'entities.employees.columns.email' },
      { key: 'status', labelKey: 'entities.employees.columns.status', format: 'status' },
    ],
  },

  employee_education: {
    entity: 'employee_education',
    titleKey: 'entities.employeeEducation.title',
    descriptionKey: 'entities.employeeEducation.description',
    createLabelKey: 'entities.employeeEducation.createLabel',
    defaultOrderBy: 'started_at',
    columns: [
      { key: 'institution_name', labelKey: 'entities.employeeEducation.columns.institution' },
      { key: 'education_degree', labelKey: 'entities.employeeEducation.columns.degree' },
      { key: 'speciality', labelKey: 'entities.employeeEducation.columns.speciality' },
      { key: 'started_at', labelKey: 'entities.employeeEducation.columns.startedAt', format: 'date' },
      { key: 'ended_at', labelKey: 'entities.employeeEducation.columns.endedAt', format: 'date' },
    ],
  },

  employee_experience: {
    entity: 'employee_experience',
    titleKey: 'entities.employeeExperience.title',
    descriptionKey: 'entities.employeeExperience.description',
    createLabelKey: 'entities.employeeExperience.createLabel',
    defaultOrderBy: 'started_at',
    columns: [
      { key: 'company_name', labelKey: 'entities.employeeExperience.columns.company' },
      { key: 'position_name', labelKey: 'entities.employeeExperience.columns.position' },
      { key: 'started_at', labelKey: 'entities.employeeExperience.columns.startedAt', format: 'date' },
      { key: 'ended_at', labelKey: 'entities.employeeExperience.columns.endedAt', format: 'date' },
    ],
  },

  departments: {
    entity: 'departments',
    titleKey: 'entities.departments.title',
    descriptionKey: 'entities.departments.description',
    createLabelKey: 'entities.departments.createLabel',
    defaultOrderBy: 'name',
    columns: [
      { key: 'name', labelKey: 'entities.departments.columns.name' },
      { key: 'manager_name', labelKey: 'entities.departments.columns.managerName' },
      { key: 'phone', labelKey: 'entities.departments.columns.phone' },
      { key: 'email', labelKey: 'entities.departments.columns.email' },
      { key: 'location', labelKey: 'entities.departments.columns.location' },
      { key: 'created_on', labelKey: 'entities.departments.columns.createdOn', format: 'date' },
      { key: 'note', labelKey: 'entities.departments.columns.note' },
    ],
  },

  positions: {
    entity: 'positions',
    titleKey: 'entities.positions.title',
    descriptionKey: 'entities.positions.description',
    createLabelKey: 'entities.positions.createLabel',
    defaultOrderBy: 'name',
    columns: [
      { key: 'name', labelKey: 'entities.positions.columns.name' },
      { key: 'base_salary', labelKey: 'entities.positions.columns.baseSalary', format: 'money' },
      { key: 'allowance', labelKey: 'entities.positions.columns.allowance', format: 'money' },
      { key: 'bonus', labelKey: 'entities.positions.columns.bonus', format: 'money' },
      { key: 'responsibilities', labelKey: 'entities.positions.columns.responsibilities' },
      { key: 'requirements', labelKey: 'entities.positions.columns.requirements' },
    ],
  },

  vacations: {
    entity: 'vacations',
    titleKey: 'entities.vacations.title',
    descriptionKey: 'entities.vacations.description',
    createLabelKey: 'entities.vacations.createLabel',
    defaultOrderBy: 'starts_at',
    columns: [
      { key: 'employee_id', labelKey: 'entities.vacations.columns.employee' },
      { key: 'vacation_type', labelKey: 'entities.vacations.columns.vacationType' },
      { key: 'starts_at', labelKey: 'entities.vacations.columns.startsAt', format: 'date' },
      { key: 'ends_at', labelKey: 'entities.vacations.columns.endsAt', format: 'date' },
      { key: 'days_count', labelKey: 'entities.vacations.columns.daysCount' },
      { key: 'reason', labelKey: 'entities.vacations.columns.reason' },
      { key: 'status', labelKey: 'entities.vacations.columns.status', format: 'status' },
    ],
  },

  payroll: {
    entity: 'payroll',
    titleKey: 'entities.payroll.title',
    descriptionKey: 'entities.payroll.description',
    createLabelKey: 'entities.payroll.createLabel',
    defaultOrderBy: 'accrual_month',
    columns: [
      { key: 'employee_id', labelKey: 'entities.payroll.columns.employee' },
      { key: 'accrual_month', labelKey: 'entities.payroll.columns.accrualMonth' },
      { key: 'base_salary', labelKey: 'entities.payroll.columns.baseSalary', format: 'money' },
      { key: 'bonus', labelKey: 'entities.payroll.columns.bonus', format: 'money' },
      { key: 'allowance', labelKey: 'entities.payroll.columns.allowance', format: 'money' },
      { key: 'deductions', labelKey: 'entities.payroll.columns.deductions', format: 'money' },
      { key: 'taxes', labelKey: 'entities.payroll.columns.taxes', format: 'money' },
      {
        key: 'net_amount',
        labelKey: 'entities.payroll.columns.netAmount',
        format: 'money',
        className: 'font-bold',
      },
      { key: 'paid_at', labelKey: 'entities.payroll.columns.paidAt', format: 'date' },
    ],
  },
}

function createColumnRender(
  column: HrEntityColumnDefinition,
  t: TFunction,
  locale: string,
): ((record: HrRecord) => ReactNode) | undefined {
  if (column.format === 'fullName') {
    return (record) => {
      const fullName = [record.last_name, record.first_name, record.middle_name]
        .map((value) => String(value ?? '').trim())
        .filter(Boolean)
        .join(' ')

      return fullName || '—'
    }
  }
  if (column.format === 'money') {
    return (record) => formatCurrency(record[column.key], locale)
  }

  if (column.format === 'date') {
    return (record) => formatDate(record[column.key], locale)
  }

  if (column.format === 'status') {
    return (record) => humanizeStatus(record[column.key], t)
  }

  return undefined
}

export function getEntityConfig(entity: HrEntityKey, t: TFunction, locale = 'ru-RU'): HrEntityPageConfig {
  const config = hrEntityConfigDefinitions[entity]

  return {
    entity: config.entity,
    title: t(config.titleKey),
    description: t(config.descriptionKey),
    createLabel: t(config.createLabelKey),
    defaultOrderBy: config.defaultOrderBy,
    columns: config.columns.map((column) => ({
      key: column.key,
      label: t(column.labelKey),
      className: column.className,
      render: createColumnRender(column, t, locale),
    })),
  }
}

export function renderCell(record: HrRecord, column: HrEntityColumn, locale = 'ru-RU'): ReactNode {
  if (column.render) {
    return column.render(record)
  }

  return formatCellValue(record[column.key], locale)
}
