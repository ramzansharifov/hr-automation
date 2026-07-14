import type { IconType } from "react-icons";
import {
  FiHome,
  FiLayers,
  FiFilter,
  FiSettings,
  FiUser,
  FiUsers,
} from "react-icons/fi";
import type { HrEntityKey } from "../shared/types/hr";

export interface AppNavigationItem {
  titleKey: string;
  path: string;
  icon: IconType;
  entity?: HrEntityKey;
}

export const navigationItems: AppNavigationItem[] = [
  {
    titleKey: "navigation.dashboard",
    path: "/",
    icon: FiHome,
  },
  {
    titleKey: "navigation.employees",
    path: "/employees",
    icon: FiUsers,
    entity: "employees",
  },
  {
    titleKey: "navigation.filters",
    path: "/filters",
    icon: FiFilter,
  },
  {
    titleKey: "navigation.enterprises",
    path: "/enterprises",
    icon: FiLayers,
    entity: "enterprises",
  },
];

export const bottomNavigationItems: AppNavigationItem[] = [
  {
    titleKey: "navigation.profile",
    path: "/profile",
    icon: FiUser,
  },
  {
    titleKey: "navigation.settings",
    path: "/settings",
    icon: FiSettings,
  },
];
