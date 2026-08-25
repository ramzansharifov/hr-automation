import type { IconType } from "react-icons";
import {
  FiActivity,
  FiBarChart2,
  FiBookOpen,
  FiBriefcase,
  FiCalendar,
  FiClipboard,
  FiDatabase,
  FiFileText,
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
import type { ScopedAdminRoleKey } from "../shared/access/scopedAdmin";
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

const settingsNavigationItem: AppNavigationItem = {
  titleKey: "navigation.settings",
  path: "/settings",
  icon: FiSettings,
  permissionCode: "settings.view",
};

const dashboardNavigationItem: AppNavigationItem = {
  titleKey: "navigation.dashboard",
  path: "/dashboard",
  icon: FiHome,
  permissionCode: "dashboard.view",
};

const analyticsNavigationItem: AppNavigationItem = {
  titleKey: "Аналитика",
  path: "/analytics",
  icon: FiBarChart2,
  permissionCode: "analytics.view",
};

const documentsNavigationItem: AppNavigationItem = {
  titleKey: "Документы",
  path: "/documents",
  icon: FiFileText,
  permissionCode: "documents.view",
};

const leaveManagementNavigationItem: AppNavigationItem = {
  titleKey: "Управление отпусками",
  path: "/leave-management",
  icon: FiCalendar,
  permissionCode: "leave.view",
};

const dataExchangeNavigationItem: AppNavigationItem = {
  titleKey: "Импорт и экспорт",
  path: "/data-exchange",
  icon: FiDatabase,
  permissionCode: "data_exchange.export",
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

const departmentsManagementNavigationItem: AppNavigationItem = {
  titleKey: "Отделы",
  path: "/management/departments",
  icon: FiGrid,
  permissionCode: "organization.view",
};

export const mainNavigationItems: AppNavigationItem[] = [
  profileNavigationItem,
  dashboardNavigationItem,
  myEnterpriseNavigationItem,
  myDepartmentNavigationItem,
  colleaguesNavigationItem,
  employeesNavigationItem,
  documentsNavigationItem,
  enterprisesNavigationItem,
  vacationsNavigationItem,
  leaveManagementNavigationItem,
  vacanciesNavigationItem,
  candidatesNavigationItem,
  analyticsNavigationItem,
  filtersNavigationItem,
];

const enterpriseDirectorNavigationItems: AppNavigationItem[] = [
  profileNavigationItem,
  {
    ...dashboardNavigationItem,
    titleKey: "Обзор предприятия",
  },
  myEnterpriseNavigationItem,
  departmentsManagementNavigationItem,
  {
    ...employeesNavigationItem,
    titleKey: "Сотрудники предприятия",
  },
  {
    ...vacationsNavigationItem,
    titleKey: "Отпуска предприятия",
  },
  leaveManagementNavigationItem,
  vacanciesNavigationItem,
  candidatesNavigationItem,
  analyticsNavigationItem,
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
  leaveManagementNavigationItem,
  vacanciesNavigationItem,
  candidatesNavigationItem,
  analyticsNavigationItem,
];

const enterpriseAdminNavigationItems: AppNavigationItem[] = [
  {
    ...dashboardNavigationItem,
    titleKey: "Обзор предприятия",
  },
  myEnterpriseNavigationItem,
  departmentsManagementNavigationItem,
  {
    ...employeesNavigationItem,
    titleKey: "Сотрудники предприятия",
  },
  documentsNavigationItem,
  {
    ...vacationsNavigationItem,
    titleKey: "Отпуска предприятия",
  },
  leaveManagementNavigationItem,
  vacanciesNavigationItem,
  candidatesNavigationItem,
  analyticsNavigationItem,
  dataExchangeNavigationItem,
  filtersNavigationItem,
];

const departmentAdminNavigationItems: AppNavigationItem[] = [
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
  documentsNavigationItem,
  {
    ...vacationsNavigationItem,
    titleKey: "Отпуска отдела",
  },
  leaveManagementNavigationItem,
  vacanciesNavigationItem,
  candidatesNavigationItem,
  analyticsNavigationItem,
  dataExchangeNavigationItem,
  filtersNavigationItem,
];

export function getMainNavigationItems(
  leadershipRole: LeadershipRoleKey | null,
  scopedAdminRole: ScopedAdminRoleKey | null = null,
): AppNavigationItem[] {
  if (scopedAdminRole === "enterprise_admin") {
    return enterpriseAdminNavigationItems;
  }
  if (scopedAdminRole === "department_admin") {
    return departmentAdminNavigationItems;
  }
  if (leadershipRole === "enterprise_director") {
    return enterpriseDirectorNavigationItems;
  }
  if (leadershipRole === "department_head") {
    return departmentHeadNavigationItems;
  }
  return mainNavigationItems;
}

export const administrationNavigationItems: AppNavigationItem[] = [
  dataExchangeNavigationItem,
  {
    titleKey: "Виды отпусков",
    path: "/vacation-types",
    icon: FiBookOpen,
    permissionCode: "vacation_types.view",
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
  },
];

export function getBottomNavigationItems(
  scopedAdminRole: ScopedAdminRoleKey | null = null,
): AppNavigationItem[] {
  return scopedAdminRole
    ? [profileNavigationItem, settingsNavigationItem]
    : [settingsNavigationItem];
}

export const bottomNavigationItems: AppNavigationItem[] = [settingsNavigationItem];
