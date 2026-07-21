import type Database from "better-sqlite3";
import type {
  AccessScopeType,
  AccessUserRole,
  AuthEmployeeOption,
  AuthSession,
  SystemRoleKey,
} from "../../src/shared/types/access";

export interface AuthenticationCredentialRow {
  userId: number;
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

interface RoleRow {
  id: number;
  code: string;
  name: string;
  scope_type: AccessScopeType;
  is_system: number;
  system_key: SystemRoleKey | null;
}

const scopeRank: Record<AccessScopeType, number> = {
  self: 0,
  department: 1,
  enterprise: 2,
  global: 3,
};

export class AuthenticationRepository {
  constructor(private readonly database: Database.Database) {}

  countUsers(): number {
    const row = this.database
      .prepare("SELECT COUNT(*) AS count FROM users")
      .get() as { count: number };
    return Number(row.count);
  }

  listBootstrapEmployees(): AuthEmployeeOption[] {
    return this.database
      .prepare(
        `SELECT
           employee.id,
           TRIM(
             COALESCE(employee.last_name, '') || ' ' ||
             COALESCE(employee.first_name, '') || ' ' ||
             COALESCE(employee.middle_name, '')
           ) AS fullName,
           COALESCE(department.name, '') AS departmentName,
           COALESCE(enterprise.name, '') AS enterpriseName
         FROM employees AS employee
         LEFT JOIN departments AS department ON department.id = employee.department_id
         LEFT JOIN enterprises AS enterprise ON enterprise.id = department.enterprise_id
         WHERE employee.status = 'active'
           AND NOT EXISTS (
             SELECT 1 FROM users WHERE users.employee_id = employee.id
           )
         ORDER BY employee.last_name, employee.first_name, employee.middle_name`,
      )
      .all() as AuthEmployeeOption[];
  }

  getSystemRoleId(systemKey: SystemRoleKey): number | null {
    const row = this.database
      .prepare("SELECT id FROM roles WHERE system_key = ? LIMIT 1")
      .get(systemKey) as { id: number } | undefined;
    return row ? Number(row.id) : null;
  }

  findCredentialsByUsername(
    username: string,
  ): AuthenticationCredentialRow | null {
    const row = this.database
      .prepare(
        `SELECT
           id AS userId,
           password_hash AS passwordHash,
           password_salt AS passwordSalt,
           status
         FROM users
         WHERE username = ? COLLATE NOCASE
         LIMIT 1`,
      )
      .get(username) as AuthenticationCredentialRow | undefined;
    return row ?? null;
  }

  findCredentialsByUserId(userId: number): AuthenticationCredentialRow | null {
    const row = this.database
      .prepare(
        `SELECT
           id AS userId,
           password_hash AS passwordHash,
           password_salt AS passwordSalt,
           status
         FROM users
         WHERE id = ?
         LIMIT 1`,
      )
      .get(userId) as AuthenticationCredentialRow | undefined;
    return row ?? null;
  }

  getSession(userId: number): AuthSession | null {
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
    ).map<AccessUserRole>((role) => ({
      id: role.id,
      code: role.code,
      name: role.name,
      scopeType: role.scope_type,
      isSystem: role.is_system === 1,
      systemKey: role.system_key,
    }));

    if (roles.length === 0) return null;

    const permissionCodes = (
      this.database
        .prepare(
          `SELECT DISTINCT permission.code
           FROM user_roles AS user_role
           JOIN role_permissions AS role_permission ON role_permission.role_id = user_role.role_id
           JOIN permissions AS permission ON permission.id = role_permission.permission_id
           WHERE user_role.user_id = ?
           ORDER BY permission.code`,
        )
        .all(userId) as Array<{ code: string }>
    ).map((item) => item.code);

    const scopeType = roles.reduce<AccessScopeType>(
      (current, role) =>
        scopeRank[role.scopeType] > scopeRank[current]
          ? role.scopeType
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
      scopeType,
      mustChangePassword: user.must_change_password === 1,
    };
  }

  updateLastLogin(userId: number): void {
    this.database
      .prepare(
        `UPDATE users
         SET last_login_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
      )
      .run(userId);
  }

  updateOwnPassword(
    userId: number,
    passwordHash: string,
    passwordSalt: string,
  ): void {
    this.database
      .prepare(
        `UPDATE users
         SET password_hash = ?,
             password_salt = ?,
             must_change_password = 0
         WHERE id = ?`,
      )
      .run(passwordHash, passwordSalt, userId);
  }
}
