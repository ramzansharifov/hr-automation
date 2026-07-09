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
  titleKey: string
  path: string
  icon: IconType
  entity?: HrEntityKey
}

export const navigationItems: AppNavigationItem[] = [
  {
    titleKey: 'navigation.dashboard',
    path: '/',
    icon: FiHome,
  },
  {
    titleKey: 'navigation.employees',
    path: '/employees',
    icon: FiUsers,
    entity: 'employees',
  },
  {
    titleKey: 'navigation.departments',
    path: '/departments',
    icon: FiGrid,
    entity: 'departments',
  },
  {
    titleKey: 'navigation.positions',
    path: '/positions',
    icon: FiBriefcase,
    entity: 'positions',
  },
  {
    titleKey: 'navigation.vacations',
    path: '/vacations',
    icon: FiCalendar,
    entity: 'vacations',
  },
  {
    titleKey: 'navigation.payroll',
    path: '/payroll',
    icon: FiCreditCard,
    entity: 'payroll',
  },
]

export const bottomNavigationItems: AppNavigationItem[] = [
  {
    titleKey: 'navigation.profile',
    path: '/profile',
    icon: FiUser,
  },
  {
    titleKey: 'navigation.settings',
    path: '/settings',
    icon: FiSettings,
  },
]