import type { IconType } from "react-icons";
import {
  FiBriefcase,
  FiClipboard,
  FiHome,
  FiLayers,
  FiFilter,
  FiSettings,
  FiShield,
  FiUser,
  FiUsers,
} from "react-icons/fi";
import type { HrEntityKey } from "../shared/types/hr";

export interface AppNavigationItem {
  titleKey: string;
  path: string;
  icon: IconType;
  permissionCode: string;
  entity?: HrEntityKey;
}

export const navigationItems: AppNavigationItem[] = [
  {
    titleKey: "navigation.dashboard",
    path: "/",
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
    titleKey: "Роли и пользователи",
    path: "/access",
    icon: FiShield,
    permissionCode: "access.manage",
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
    permissionCode: "settings.manage",
  },
];
