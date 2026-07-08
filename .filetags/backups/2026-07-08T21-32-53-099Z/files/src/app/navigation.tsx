import type { IconType } from 'react-icons'
import {
  FiBriefcase,
  FiCalendar,
  FiCreditCard,
  FiGrid,
  FiHome,
  FiSettings,
  FiUser,
  FiUsers,
} from 'react-icons/fi'
import type { HrEntityKey } from '../shared/types/hr'

export interface AppNavigationItem {
  title: string
  path: string
  icon: IconType
  entity?: HrEntityKey
}

export const navigationItems: AppNavigationItem[] = [
  {
    title: 'Главная',
    path: '/',
    icon: FiHome,
  },
  {
    title: 'Сотрудники',
    path: '/employees',
    icon: FiUsers,
    entity: 'employees',
  },
  {
    title: 'Отделы',
    path: '/departments',
    icon: FiGrid,
    entity: 'departments',
  },
  {
    title: 'Должности',
    path: '/positions',
    icon: FiBriefcase,
    entity: 'positions',
  },
  {
    title: 'Отпуска',
    path: '/vacations',
    icon: FiCalendar,
    entity: 'vacations',
  },
  {
    title: 'Зарплата',
    path: '/payroll',
    icon: FiCreditCard,
    entity: 'payroll',
  },
]

export const bottomNavigationItems: AppNavigationItem[] = [
  {
    title: 'Профиль',
    path: '/profile',
    icon: FiUser,
  },
  {
    title: 'Настройки',
    path: '/settings',
    icon: FiSettings,
  },
]