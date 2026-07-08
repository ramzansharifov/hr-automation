import type { ReactNode } from 'react'
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

function money(key: string): (record: HrRecord) => string {
  return (record) => formatCurrency(record[key])
}

function date(key: string): (record: HrRecord) => string {
  return (record) => formatDate(record[key])
}

function status(key: string): (record: HrRecord) => string {
  return (record) => humanizeStatus(record[key])
}

export const hrEntityConfigs: Record<HrEntityKey, HrEntityPageConfig> = {
  employees: {
    entity: 'employees',
    title: 'Сотрудники',
    description: 'Кадровый состав, контакты, отделы, должности и даты приема на работу.',
    createLabel: 'Добавить сотрудника',
    defaultOrderBy: 'last_name',
    columns: [
      { key: 'employee_code', label: 'Код' },
      { key: 'last_name', label: 'Фамилия' },
      { key: 'first_name', label: 'Имя' },
      { key: 'middle_name', label: 'Отчество' },
      { key: 'department_id', label: 'Отдел' },
      { key: 'position_id', label: 'Должность' },
      { key: 'phone', label: 'Телефон' },
      { key: 'email', label: 'Email' },
      { key: 'hire_date', label: 'Дата приема', render: date('hire_date') },
      { key: 'status', label: 'Статус', render: status('status') },
    ],
  },

  departments: {
    entity: 'departments',
    title: 'Отделы',
    description: 'Организационная структура, руководители, телефоны и расположение отделов.',
    createLabel: 'Добавить отдел',
    defaultOrderBy: 'name',
    columns: [
      { key: 'name', label: 'Наименование' },
      { key: 'manager_name', label: 'Руководитель' },
      { key: 'phone', label: 'Телефон' },
      { key: 'email', label: 'Email' },
      { key: 'location', label: 'Расположение' },
      { key: 'created_on', label: 'Дата создания', render: date('created_on') },
      { key: 'note', label: 'Примечание' },
    ],
  },

  positions: {
    entity: 'positions',
    title: 'Должности',
    description: 'Оклады, надбавки, премии, обязанности и требования по должностям.',
    createLabel: 'Добавить должность',
    defaultOrderBy: 'name',
    columns: [
      { key: 'name', label: 'Должность' },
      { key: 'base_salary', label: 'Оклад', render: money('base_salary') },
      { key: 'allowance', label: 'Надбавка', render: money('allowance') },
      { key: 'bonus', label: 'Премия', render: money('bonus') },
      { key: 'responsibilities', label: 'Обязанности' },
      { key: 'requirements', label: 'Требования' },
    ],
  },

  vacations: {
    entity: 'vacations',
    title: 'Отпуска',
    description: 'Плановые, ежегодные и другие отпуска сотрудников с датами и статусами.',
    createLabel: 'Оформить отпуск',
    defaultOrderBy: 'starts_at',
    columns: [
      { key: 'employee_id', label: 'Сотрудник' },
      { key: 'vacation_type', label: 'Вид отпуска' },
      { key: 'starts_at', label: 'Начало', render: date('starts_at') },
      { key: 'ends_at', label: 'Окончание', render: date('ends_at') },
      { key: 'days_count', label: 'Дней' },
      { key: 'reason', label: 'Причина' },
      { key: 'status', label: 'Статус', render: status('status') },
    ],
  },

  payroll: {
    entity: 'payroll',
    title: 'Заработная плата',
    description: 'Начисления по месяцам: оклад, премии, надбавки, удержания, налоги и итог.',
    createLabel: 'Добавить начисление',
    defaultOrderBy: 'accrual_month',
    columns: [
      { key: 'employee_id', label: 'Сотрудник' },
      { key: 'accrual_month', label: 'Месяц' },
      { key: 'base_salary', label: 'Оклад', render: money('base_salary') },
      { key: 'bonus', label: 'Премия', render: money('bonus') },
      { key: 'allowance', label: 'Надбавка', render: money('allowance') },
      { key: 'deductions', label: 'Удержания', render: money('deductions') },
      { key: 'taxes', label: 'Налоги', render: money('taxes') },
      { key: 'net_amount', label: 'Итого', render: money('net_amount'), className: 'font-bold' },
      { key: 'paid_at', label: 'Дата выплаты', render: date('paid_at') },
    ],
  },
}

export function getEntityConfig(entity: HrEntityKey): HrEntityPageConfig {
  return hrEntityConfigs[entity]
}

export function renderCell(record: HrRecord, column: HrEntityColumn): ReactNode {
  if (column.render) {
    return column.render(record)
  }

  return formatCellValue(record[column.key])
}