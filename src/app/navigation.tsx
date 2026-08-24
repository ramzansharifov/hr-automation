import type { IconType } from "react-icons";
import {
  FiActivity,
  FiBookOpen,
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
  requiredGlobalScope?: boolean;
  employeeAccountOnly?: boolean;
  entity?: HrEntityKey;
}

export const mainNavigationItems: AppNavigationItem[] = [
  {
    titleKey: "navigation.profile",
    path: "/profile",
    icon: FiUser,
    permissionCode: "profile.view",
    employeeAccountOnly: true,
  },
  {
    titleKey: "navigation.dashboard",
    path: "/dashboard",
    icon: FiHome,
    permissionCode: "dashboard.view",
  },
  {
    titleKey: "Предприятие",
    path: "/my-enterprise",
    icon: FiLayers,
    permissionCode: "directory.view",
    employeeAccountOnly: true,
  },
  {
    titleKey: "Отдел",
    path: "/my-department",
    icon: FiBriefcase,
    permissionCode: "directory.view",
    employeeAccountOnly: true,
  },
  {
    titleKey: "Коллеги",
    path: "/colleagues",
    icon: FiUsers,
    permissionCode: "directory.view",
    employeeAccountOnly: true,
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
    permissionCode: "vacancies.view",
  },
  {
    titleKey: "navigation.candidates",
    path: "/candidates",
    icon: FiClipboard,
    permissionCode: "candidates.view",
  },
  {
    titleKey: "navigation.filters",
    path: "/filters",
    icon: FiFilter,
    permissionCode: "filters.use",
  },
];

export const administrationNavigationItems: AppNavigationItem[] = [
  {
    titleKey: "Виды отпусков",
    path: "/vacation-types",
    icon: FiBookOpen,
    permissionCode: "vacation_types.view",
    requiredGlobalScope: true,
    entity: "vacation_types",
  },
  {
    titleKey: "Пользователи",
    path: "/users",
    icon: FiUserCheck,
    permissionCode: "users.view",
    requiredGlobalScope: true,
  },
  {
    titleKey: "Роли",
    path: "/roles",
    icon: FiShield,
    permissionCode: "roles.view",
    requiredGlobalScope: true,
  },
  {
    titleKey: "Журнал действий",
    path: "/audit",
    icon: FiActivity,
    permissionCode: "audit.view",
    requiredGlobalScope: true,
  },
];

export const bottomNavigationItems: AppNavigationItem[] = [
  {
    titleKey: "navigation.settings",
    path: "/settings",
    icon: FiSettings,
    permissionCode: "settings.view",
  },
];
