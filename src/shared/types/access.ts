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
  departmentId: number | null;
  departmentName: string;
  enterpriseId: number | null;
  enterpriseName: string;
  username: string;
  status: AccessUserStatus;
  mustChangePassword: boolean;
  roles: AccessUserRole[];
  effectivePermissionCodes: string[];
  effectiveScopeType: AccessScopeType;
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

export interface AuthEmployeeOption {
  id: number;
  fullName: string;
  departmentName: string;
  enterpriseName: string;
}

export interface AuthSession {
  userId: number;
  employeeId: number;
  employeeName: string;
  departmentId: number | null;
  departmentName: string;
  enterpriseId: number | null;
  enterpriseName: string;
  username: string;
  roles: AccessUserRole[];
  permissionCodes: string[];
  scopeType: AccessScopeType;
  mustChangePassword: boolean;
}

export interface AuthState {
  isInitialized: boolean;
  session: AuthSession | null;
}

export interface BootstrapSuperadminParams {
  employeeId: number;
  username: string;
  password: string;
}

export interface LoginParams {
  username: string;
  password: string;
}

export interface ChangeOwnPasswordParams {
  currentPassword: string;
  newPassword: string;
}
