import type { IconType } from "react-icons";
import {
  FiActivity,
  FiBriefcase,
  FiCalendar,
  FiClipboard,
  FiFilter,
  FiHome,
  FiLayers,
  FiSettings,
  FiShield,
  FiUser,
  FiUserCheck,
  FiUsers,
} from "react-icons/fi";
import type { HrEntityKey } from "../shared/types/hr";

export interface AppNavigationItem {
  titleKey: string;
  path: string;
  icon: IconType;
  permissionCode?: string;
  entity?: HrEntityKey;
}

export const navigationItems: AppNavigationItem[] = [
  {
    titleKey: "navigation.dashboard",
    path: "/dashboard",
    icon: FiHome,
    permissionCode: "dashboard.view",
  },
  {
    titleKey: "navigation.employees",
    path: "/employees",
    icon: FiUsers,
    permissionCode: "employees.view",
    entity: "employees",
  },
  {
    titleKey: "navigation.enterprises",
    path: "/enterprises",
    icon: FiLayers,
    permissionCode: "organization.view",
    entity: "enterprises",
  },
  {
    titleKey: "Отпуска",
    path: "/vacations",
    icon: FiCalendar,
    permissionCode: "vacations.view",
    entity: "vacations",
  },
  {
    titleKey: "navigation.vacancies",
    path: "/vacancies",
    icon: FiBriefcase,
    permissionCode: "recruitment.view",
  },
  {
    titleKey: "navigation.candidates",
    path: "/candidates",
    icon: FiClipboard,
    permissionCode: "recruitment.view",
  },
  {
    titleKey: "navigation.filters",
    path: "/filters",
    icon: FiFilter,
    permissionCode: "filters.use",
  },
  {
    titleKey: "Пользователи",
    path: "/users",
    icon: FiUserCheck,
    permissionCode: "access.manage",
  },
  {
    titleKey: "Роли",
    path: "/roles",
    icon: FiShield,
    permissionCode: "access.manage",
  },
  {
    titleKey: "Журнал действий",
    path: "/audit",
    icon: FiActivity,
    permissionCode: "audit.view",
  },
];

export const bottomNavigationItems: AppNavigationItem[] = [
  {
    titleKey: "navigation.profile",
    path: "/profile",
    icon: FiUser,
    permissionCode: "profile.view",
  },
  {
    titleKey: "navigation.settings",
    path: "/settings",
    icon: FiSettings,
  },
];
