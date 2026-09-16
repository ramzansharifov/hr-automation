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
  permissionCodes?: string[];
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
  titleKey: "navigation.analytics",
  path: "/analytics",
  icon: FiBarChart2,
  permissionCode: "analytics.view",
};

const dataExchangeNavigationItem: AppNavigationItem = {
  titleKey: "navigation.dataExchange",
  path: "/data-exchange",
  icon: FiDatabase,
  permissionCodes: ["data_exchange.import", "data_exchange.export"],
};

const myEnterpriseNavigationItem: AppNavigationItem = {
  titleKey: "navigation.myEnterprise",
  path: "/my-enterprise",
  icon: FiLayers,
  permissionCode: "directory.view",
  employeeAccountOnly: true,
};

const myDepartmentNavigationItem: AppNavigationItem = {
  titleKey: "navigation.myDepartment",
  path: "/my-department",
  icon: FiBriefcase,
  permissionCode: "directory.view",
  employeeAccountOnly: true,
};

const colleaguesNavigationItem: AppNavigationItem = {
  titleKey: "navigation.colleagues",
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
  permissionCode: "enterprises.view",
  entity: "enterprises",
};

const vacationsNavigationItem: AppNavigationItem = {
  titleKey: "navigation.vacations",
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
  titleKey: "navigation.departments",
  path: "/management/departments",
  icon: FiGrid,
  permissionCode: "departments.view",
};

export const mainNavigationItems: AppNavigationItem[] = [
  dashboardNavigationItem,
  myEnterpriseNavigationItem,
  myDepartmentNavigationItem,
  colleaguesNavigationItem,
  employeesNavigationItem,
  enterprisesNavigationItem,
  vacationsNavigationItem,
  vacanciesNavigationItem,
  candidatesNavigationItem,
  analyticsNavigationItem,
  filtersNavigationItem,
];

const enterpriseDirectorNavigationItems: AppNavigationItem[] = [
  {
    ...dashboardNavigationItem,
    titleKey: "navigation.enterpriseOverview",
  },
  myEnterpriseNavigationItem,
  departmentsManagementNavigationItem,
  {
    ...employeesNavigationItem,
    titleKey: "navigation.enterpriseEmployees",
  },
  {
    ...vacationsNavigationItem,
    titleKey: "navigation.enterpriseVacations",
  },
  vacanciesNavigationItem,
  candidatesNavigationItem,
  analyticsNavigationItem,
  filtersNavigationItem,
];

const departmentHeadNavigationItems: AppNavigationItem[] = [
  {
    ...dashboardNavigationItem,
    titleKey: "navigation.departmentOverview",
  },
  myDepartmentNavigationItem,
  myEnterpriseNavigationItem,
  {
    ...employeesNavigationItem,
    titleKey: "navigation.departmentEmployees",
  },
  {
    ...vacationsNavigationItem,
    titleKey: "navigation.departmentVacations",
  },
  vacanciesNavigationItem,
  candidatesNavigationItem,
  analyticsNavigationItem,
  filtersNavigationItem,
];

const enterpriseAdminNavigationItems: AppNavigationItem[] = [
  {
    ...dashboardNavigationItem,
    titleKey: "navigation.enterpriseOverview",
  },
  myEnterpriseNavigationItem,
  departmentsManagementNavigationItem,
  {
    ...employeesNavigationItem,
    titleKey: "navigation.enterpriseEmployees",
  },
  {
    ...vacationsNavigationItem,
    titleKey: "navigation.enterpriseVacations",
  },
  vacanciesNavigationItem,
  candidatesNavigationItem,
  analyticsNavigationItem,
  filtersNavigationItem,
];

const departmentAdminNavigationItems: AppNavigationItem[] = [
  {
    ...dashboardNavigationItem,
    titleKey: "navigation.departmentOverview",
  },
  myDepartmentNavigationItem,
  myEnterpriseNavigationItem,
  {
    ...employeesNavigationItem,
    titleKey: "navigation.departmentEmployees",
  },
  {
    ...vacationsNavigationItem,
    titleKey: "navigation.departmentVacations",
  },
  vacanciesNavigationItem,
  candidatesNavigationItem,
  analyticsNavigationItem,
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
    titleKey: "navigation.vacationTypes",
    path: "/vacation-types",
    icon: FiBookOpen,
    permissionCode: "vacation_types.view",
    entity: "vacation_types",
  },
  {
    titleKey: "navigation.documentTypes",
    path: "/document-types",
    icon: FiFileText,
    permissionCode: "document_types.view",
  },
  {
    titleKey: "navigation.users",
    path: "/users",
    icon: FiUserCheck,
    permissionCode: "users.view",
  },
  {
    titleKey: "navigation.roles",
    path: "/roles",
    icon: FiShield,
    permissionCode: "roles.view",
  },
  {
    titleKey: "navigation.audit",
    path: "/audit",
    icon: FiActivity,
    permissionCode: "audit.view",
  },
];

export function getBottomNavigationItems(
  scopedAdminRole: ScopedAdminRoleKey | null = null,
): AppNavigationItem[] {
  void scopedAdminRole;
  return [profileNavigationItem, settingsNavigationItem];
}

export const bottomNavigationItems: AppNavigationItem[] = [
  profileNavigationItem,
  settingsNavigationItem,
];
