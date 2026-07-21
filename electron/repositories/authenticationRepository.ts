import type Database from "better-sqlite3";
import type {
  AccessScopeType,
  AccessUserRole,
  AuthSession,
  SystemRoleKey,
} from "../../src/shared/types/access";

export type AuthenticationAccountType = "system_admin" | "employee_user";

export interface AuthenticationCredentialRow {
  accountId: number;
  accountType: AuthenticationAccountType;
  passwordHash: string;
  passwordSalt: string;
  status: "active" | "blocked";
}

interface SessionRow {
  user_id: number;
  employee_id: number;
  employee_name: string;
  department_id: number | null;
  department_name: string | null;
  enterprise_id: number | null;
  enterprise_name: string | null;
  username: string;
  must_change_password: number;
}

interface SystemAdminRow {
  id: number;
  username: string;
  must_change_password: number;
}

interface RoleRow {
  id: number;
  code: string;
  name: string;
  scope_type: AccessScopeType;
  is_system: number;
  system_key: SystemRoleKey | null;
}

interface PermissionScopeRow {
  code: string;
  scope_type: AccessScopeType;
}

const scopeRank: Record<AccessScopeType, number> = {
  self: 0,
  department: 1,
  enterprise: 2,
  global: 3,
};

export class AuthenticationRepository {
  constructor(private readonly database: Database.Database) {}

  hasSystemAdmin(): boolean {
    return Boolean(
      this.database
        .prepare("SELECT id FROM system_admin_accounts WHERE id = 1 LIMIT 1")
        .get(),
    );
  }

  findCredentialsByUsername(
    username: string,
  ): AuthenticationCredentialRow | null {
    const systemAdmin = this.database
      .prepare(
        `SELECT
           id AS accountId,
           password_hash AS passwordHash,
           password_salt AS passwordSalt
         FROM system_admin_accounts
         WHERE username = ? COLLATE NOCASE
         LIMIT 1`,
      )
      .get(username) as
      | { accountId: number; passwordHash: string; passwordSalt: string }
      | undefined;

    if (systemAdmin) {
      return {
        ...systemAdmin,
        accountType: "system_admin",
        status: "active",
      };
    }

    const employeeUser = this.database
      .prepare(
        `SELECT
           id AS accountId,
           password_hash AS passwordHash,
           password_salt AS passwordSalt,
           status
         FROM users
         WHERE username = ? COLLATE NOCASE
         LIMIT 1`,
      )
      .get(username) as
      | {
          accountId: number;
          passwordHash: string;
          passwordSalt: string;
          status: "active" | "blocked";
        }
      | undefined;

    return employeeUser
      ? { ...employeeUser, accountType: "employee_user" }
      : null;
  }

  findCredentialsByIdentity(
    accountType: AuthenticationAccountType,
    accountId: number,
  ): AuthenticationCredentialRow | null {
    if (accountType === "system_admin") {
      const row = this.database
        .prepare(
          `SELECT
             id AS accountId,
             password_hash AS passwordHash,
             password_salt AS passwordSalt
           FROM system_admin_accounts
           WHERE id = ?
           LIMIT 1`,
        )
        .get(accountId) as
        | { accountId: number; passwordHash: string; passwordSalt: string }
        | undefined;

      return row
        ? { ...row, accountType: "system_admin", status: "active" }
        : null;
    }

    const row = this.database
      .prepare(
        `SELECT
           id AS accountId,
           password_hash AS passwordHash,
           password_salt AS passwordSalt,
           status
         FROM users
         WHERE id = ?
         LIMIT 1`,
      )
      .get(accountId) as
      | {
          accountId: number;
          passwordHash: string;
          passwordSalt: string;
          status: "active" | "blocked";
        }
      | undefined;

    return row ? { ...row, accountType: "employee_user" } : null;
  }

  getSession(
    accountType: AuthenticationAccountType,
    accountId: number,
  ): AuthSession | null {
    return accountType === "system_admin"
      ? this.getSystemAdminSession(accountId)
      : this.getEmployeeUserSession(accountId);
  }

  updateLastLogin(
    accountType: AuthenticationAccountType,
    accountId: number,
  ): void {
    const table =
      accountType === "system_admin" ? "system_admin_accounts" : "users";
    this.database
      .prepare(`UPDATE ${table} SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?`)
      .run(accountId);
  }

  updateOwnPassword(
    accountType: AuthenticationAccountType,
    accountId: number,
    passwordHash: string,
    passwordSalt: string,
  ): void {
    const table =
      accountType === "system_admin" ? "system_admin_accounts" : "users";
    this.database
      .prepare(
        `UPDATE ${table}
         SET password_hash = ?,
             password_salt = ?,
             must_change_password = 0
         WHERE id = ?`,
      )
      .run(passwordHash, passwordSalt, accountId);
  }

  private getSystemAdminSession(accountId: number): AuthSession | null {
    const admin = this.database
      .prepare(
        `SELECT id, username, must_change_password
         FROM system_admin_accounts
         WHERE id = ?
         LIMIT 1`,
      )
      .get(accountId) as SystemAdminRow | undefined;

    if (!admin) return null;

    const role = this.database
      .prepare(
        `SELECT id, code, name, scope_type, is_system, system_key
         FROM roles
         WHERE system_key = 'superadmin'
         LIMIT 1`,
      )
      .get() as RoleRow | undefined;

    if (!role) return null;

    const permissions = this.database
      .prepare(
        `SELECT permission.code
         FROM role_permissions AS role_permission
         JOIN permissions AS permission ON permission.id = role_permission.permission_id
         WHERE role_permission.role_id = ?
           AND permission.code <> 'profile.view'
         ORDER BY permission.code`,
      )
      .all(role.id) as Array<{ code: string }>;

    const permissionCodes = permissions.map((permission) => permission.code);
    const permissionScopes = Object.fromEntries(
      permissionCodes.map((code) => [code, "global" as const]),
    );

    return {
      userId: admin.id,
      employeeId: 0,
      employeeName: "Системный администратор",
      departmentId: null,
      departmentName: "",
      enterpriseId: null,
      enterpriseName: "",
      username: admin.username,
      roles: [mapRole(role)],
      permissionCodes,
      permissionScopes,
      scopeType: "global",
      mustChangePassword: admin.must_change_password === 1,
    };
  }

  private getEmployeeUserSession(userId: number): AuthSession | null {
    const user = this.database
      .prepare(
        `SELECT
           user.id AS user_id,
           employee.id AS employee_id,
           TRIM(
             COALESCE(employee.last_name, '') || ' ' ||
             COALESCE(employee.first_name, '') || ' ' ||
             COALESCE(employee.middle_name, '')
           ) AS employee_name,
           department.id AS department_id,
           department.name AS department_name,
           enterprise.id AS enterprise_id,
           enterprise.name AS enterprise_name,
           user.username,
           user.must_change_password
         FROM users AS user
         JOIN employees AS employee ON employee.id = user.employee_id
         LEFT JOIN departments AS department ON department.id = employee.department_id
         LEFT JOIN enterprises AS enterprise ON enterprise.id = department.enterprise_id
         WHERE user.id = ?
           AND user.status = 'active'
           AND employee.status = 'active'
         LIMIT 1`,
      )
      .get(userId) as SessionRow | undefined;

    if (!user) return null;

    const roles = (
      this.database
        .prepare(
          `SELECT
             role.id,
             role.code,
             role.name,
             role.scope_type,
             role.is_system,
             role.system_key
           FROM user_roles AS user_role
           JOIN roles AS role ON role.id = user_role.role_id
           WHERE user_role.user_id = ?
           ORDER BY role.is_system DESC, role.name`,
        )
        .all(userId) as RoleRow[]
    ).map<AccessUserRole>(mapRole);

    if (roles.length === 0) return null;

    const permissionRows = this.database
      .prepare(
        `SELECT permission.code, role.scope_type
         FROM user_roles AS user_role
         JOIN roles AS role ON role.id = user_role.role_id
         JOIN role_permissions AS role_permission ON role_permission.role_id = role.id
         JOIN permissions AS permission ON permission.id = role_permission.permission_id
         WHERE user_role.user_id = ?
         ORDER BY permission.code`,
      )
      .all(userId) as PermissionScopeRow[];

    const permissionScopes: Record<string, AccessScopeType> = {};
    for (const permission of permissionRows) {
      const currentScope = permissionScopes[permission.code];
      if (
        !currentScope ||
        scopeRank[permission.scope_type] > scopeRank[currentScope]
      ) {
        permissionScopes[permission.code] = permission.scope_type;
      }
    }

    const permissionCodes = Object.keys(permissionScopes).sort();
    const scopeType = Object.values(permissionScopes).reduce<AccessScopeType>(
      (current, permissionScope) =>
        scopeRank[permissionScope] > scopeRank[current]
          ? permissionScope
          : current,
      "self",
    );

    return {
      userId: user.user_id,
      employeeId: user.employee_id,
      employeeName: user.employee_name,
      departmentId: user.department_id,
      departmentName: user.department_name ?? "",
      enterpriseId: user.enterprise_id,
      enterpriseName: user.enterprise_name ?? "",
      username: user.username,
      roles,
      permissionCodes,
      permissionScopes,
      scopeType,
      mustChangePassword: user.must_change_password === 1,
    };
  }
}

function mapRole(role: RoleRow): AccessUserRole {
  return {
    id: role.id,
    code: role.code,
    name: role.name,
    scopeType: role.scope_type,
    isSystem: role.is_system === 1,
    systemKey: role.system_key,
  };
}
