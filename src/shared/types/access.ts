export type AccessScopeType = "global" | "enterprise" | "department" | "self";
export type AccessUserStatus = "active" | "blocked";
export type SystemRoleKey =
  | "superadmin"
  | "employee"
  | "enterprise_director"
  | "department_head";

export interface AccessPermission {
  id: number;
  code: string;
  name: string;
  module: string;
  description: string;
}

export interface AccessRoleSummary {
  id: number;
  code: string;
  name: string;
  description: string;
  scopeType: AccessScopeType;
  isSystem: boolean;
  systemKey: SystemRoleKey | null;
  permissionCodes: string[];
  userCount: number;
}

export interface AccessUserRole {
  id: number;
  code: string;
  name: string;
  scopeType: AccessScopeType;
  isSystem: boolean;
  systemKey: SystemRoleKey | null;
}

export interface AccessUserSummary {
  id: number;
  employeeId: number;
  employeeName: string;
  departmentName: string;
  enterpriseName: string;
  username: string;
  status: AccessUserStatus;
  mustChangePassword: boolean;
  roles: AccessUserRole[];
  effectivePermissionCodes: string[];
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
}

export interface SaveAccessRoleParams {
  id?: number;
  name: string;
  description?: string;
  scopeType: AccessScopeType;
  permissionCodes: string[];
}

export interface SaveAccessUserParams {
  id?: number;
  employeeId: number;
  username: string;
  status: AccessUserStatus;
  roleIds: number[];
  password?: string;
  mustChangePassword?: boolean;
}

export interface ResetAccessPasswordParams {
  userId: number;
  password: string;
  mustChangePassword?: boolean;
}

export interface AccessControlOverview {
  permissions: AccessPermission[];
  roles: AccessRoleSummary[];
  users: AccessUserSummary[];
}
