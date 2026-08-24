import type { IconType } from "react-icons";
import {
  FiActivity,
  FiBookOpen,
  FiBriefcase,
  FiCalendar,
  FiClipboard,
  FiFilter,
  FiGrid,
  FiHome,
  FiLayers,
  FiSettings,
  FiShield,
  FiUser,
  FiUserCheck,
  FiUsers,
} from "react-icons/fi";
import type { LeadershipRoleKey } from "../shared/access/leadership";
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

const profileNavigationItem: AppNavigationItem = {
  titleKey: "navigation.profile",
  path: "/profile",
  icon: FiUser,
  permissionCode: "profile.view",
  employeeAccountOnly: true,
};

const dashboardNavigationItem: AppNavigationItem = {
  titleKey: "navigation.dashboard",
  path: "/dashboard",
  icon: FiHome,
  permissionCode: "dashboard.view",
};

const myEnterpriseNavigationItem: AppNavigationItem = {
  titleKey: "Предприятие",
  path: "/my-enterprise",
  icon: FiLayers,
  permissionCode: "directory.view",
  employeeAccountOnly: true,
};

const myDepartmentNavigationItem: AppNavigationItem = {
  titleKey: "Отдел",
  path: "/my-department",
  icon: FiBriefcase,
  permissionCode: "directory.view",
  employeeAccountOnly: true,
};

const colleaguesNavigationItem: AppNavigationItem = {
  titleKey: "Коллеги",
  path: "/colleagues",
  icon: FiUsers,
  permissionCode: "directory.view",
  employeeAccountOnly: true,
};

const employeesNavigationItem: AppNavigationItem = {
  titleKey: "navigation.employees",
  path: "/employees",
  icon: FiUsers,
  permissionCode: "employees.view",
  entity: "employees",
};

const enterprisesNavigationItem: AppNavigationItem = {
  titleKey: "navigation.enterprises",
  path: "/enterprises",
  icon: FiLayers,
  permissionCode: "organization.view",
  entity: "enterprises",
};

const vacationsNavigationItem: AppNavigationItem = {
  titleKey: "Отпуска",
  path: "/vacations",
  icon: FiCalendar,
  permissionCode: "vacations.view",
  entity: "vacations",
};

const vacanciesNavigationItem: AppNavigationItem = {
  titleKey: "navigation.vacancies",
  path: "/vacancies",
  icon: FiBriefcase,
  permissionCode: "vacancies.view",
};

const candidatesNavigationItem: AppNavigationItem = {
  titleKey: "navigation.candidates",
  path: "/candidates",
  icon: FiClipboard,
  permissionCode: "candidates.view",
};

const filtersNavigationItem: AppNavigationItem = {
  titleKey: "navigation.filters",
  path: "/filters",
  icon: FiFilter,
  permissionCode: "filters.use",
};

export const mainNavigationItems: AppNavigationItem[] = [
  profileNavigationItem,
  dashboardNavigationItem,
  myEnterpriseNavigationItem,
  myDepartmentNavigationItem,
  colleaguesNavigationItem,
  employeesNavigationItem,
  enterprisesNavigationItem,
  vacationsNavigationItem,
  vacanciesNavigationItem,
  candidatesNavigationItem,
  filtersNavigationItem,
];

const enterpriseDirectorNavigationItems: AppNavigationItem[] = [
  profileNavigationItem,
  {
    ...dashboardNavigationItem,
    titleKey: "Обзор предприятия",
  },
  myEnterpriseNavigationItem,
  {
    titleKey: "Отделы",
    path: "/management/departments",
    icon: FiGrid,
    permissionCode: "organization.view",
  },
  {
    ...employeesNavigationItem,
    titleKey: "Сотрудники предприятия",
  },
  {
    ...vacationsNavigationItem,
    titleKey: "Отпуска предприятия",
  },
  vacanciesNavigationItem,
  candidatesNavigationItem,
];

const departmentHeadNavigationItems: AppNavigationItem[] = [
  profileNavigationItem,
  {
    ...dashboardNavigationItem,
    titleKey: "Обзор отдела",
  },
  myDepartmentNavigationItem,
  myEnterpriseNavigationItem,
  {
    ...employeesNavigationItem,
    titleKey: "Сотрудники отдела",
  },
  {
    ...vacationsNavigationItem,
    titleKey: "Отпуска отдела",
  },
  vacanciesNavigationItem,
  candidatesNavigationItem,
];

export function getMainNavigationItems(
  leadershipRole: LeadershipRoleKey | null,
): AppNavigationItem[] {
  if (leadershipRole === "enterprise_director") {
    return enterpriseDirectorNavigationItems;
  }
  if (leadershipRole === "department_head") {
    return departmentHeadNavigationItems;
  }
  return mainNavigationItems;
}

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
  },
  {
    titleKey: "Роли",
    path: "/roles",
    icon: FiShield,
    permissionCode: "roles.view",
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
