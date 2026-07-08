import type { IconType } from 'react-icons'
import {
  FiBriefcase,
  FiCalendar,
  FiCreditCard,
  FiGrid,
  FiHome,
  FiUsers,
} from 'react-icons/fi'
import type { HrEntityKey } from '../shared/types/hr'

export interface AppNavigationItem {
  title: string
  path: string
  description: string
  icon: IconType
  entity?: HrEntityKey
}

export const navigationItems: AppNavigationItem[] = [
  {
    title: 'Главная',
    path: '/',
    description: 'Общая статистика и быстрый обзор',
    icon: FiHome,
  },
  {
    title: 'Сотрудники',
    path: '/employees',
    description: 'Кадровый состав организации',
    icon: FiUsers,
    entity: 'employees',
  },
  {
    title: 'Отделы',
    path: '/departments',
    description: 'Структура компании и контакты отделов',
    icon: FiGrid,
    entity: 'departments',
  },
  {
    title: 'Должности',
    path: '/positions',
    description: 'Оклады, надбавки, требования и обязанности',
    icon: FiBriefcase,
    entity: 'positions',
  },
  {
    title: 'Отпуска',
    path: '/vacations',
    description: 'Планирование и учет отпусков',
    icon: FiCalendar,
    entity: 'vacations',
  },
  {
    title: 'Зарплата',
    path: '/payroll',
    description: 'Начисления, премии, удержания и налоги',
    icon: FiCreditCard,
    entity: 'payroll',
  },
]