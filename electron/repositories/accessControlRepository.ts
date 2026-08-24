import type Database from "better-sqlite3";
import type {
  AccessPermission,
  AccessRoleSummary,
  AccessScopeType,
  AccessUserRole,
  AccessUserStatus,
  AccessUserSummary,
  SystemAdminSummary,
  SystemRoleKey,
} from "../../src/shared/types/access";

interface RoleRow {
  id: number;
  code: string;
  name: string;
  description: string;
  scope_type: AccessScopeType;
  is_system: number;
  system_key: SystemRoleKey | null;
  enterprise_id: number | null;
  enterprise_name: string | null;
  department_id: number | null;
  department_name: string | null;
  user_count: number;
}

interface UserRow {
  id: number;
  employee_id: number;
  employee_name: string;
  department_id: number | null;
  department_name: string | null;
  enterprise_id: number | null;
  enterprise_name: string | null;
  username: string;
  status: AccessUserStatus;
  must_change_password: number;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
}

interface SystemAdminRow {
  id: number;
  username: string;
  must_change_password: number;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PersistAccessRoleInput {
  id?: number;
  code: string;
  name: string;
  description: string;
  scopeType: AccessScopeType;
  enterpriseId: number | null;
  departmentId: number | null;
  permissionCodes: string[];
}

export interface PersistAccessUserInput {
  id?: number;
  employeeId: number;
  username: string;
  status: AccessUserStatus;
  roleIds: number[];
  passwordHash?: string;
  passwordSalt?: string;
  mustChangePassword: boolean;
}

export interface EmployeeOrganizationScope {
  departmentId: number | null;
  enterpriseId: number | null;
}

export class AccessControlRepository {
  constructor(private readonly database: Database.Database) {}

  listPermissions(): AccessPermission[] {
    return this.database
      .prepare(
        `SELECT id, code, name, module, description
         FROM permissions
         ORDER BY module, name`,
      )
      .all() as AccessPermission[];
  }

  getSystemAdmin(): SystemAdminSummary {
    const row = this.database
      .prepare(
        `SELECT id, username, must_change_password, last_login_at, created_at, updated_at
         FROM system_admin_accounts
         WHERE id = 1
         LIMIT 1`,
      )
      .get() as SystemAdminRow | undefined;

    if (!row) throw new Error("Встроенная учётная запись superadmin не найдена");
    return {
      id: row.id,
      username: row.username,
      mustChangePassword: row.must_change_password === 1,
      lastLoginAt: row.last_login_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  listRoles(): AccessRoleSummary[] {
    const roles = this.database
      .prepare(
        `SELECT
           role.id,
           role.code,
           role.name,
           role.description,
           role.scope_type,
           role.is_system,
           role.system_key,
           COALESCE(role.enterprise_id, role_department.enterprise_id) AS enterprise_id,
           role_enterprise.name AS enterprise_name,
           role.department_id,
           role_department.name AS department_name,
           COUNT(DISTINCT user_role.user_id) AS user_count
         FROM roles AS role
         LEFT JOIN departments AS role_department ON role_department.id = role.department_id
         LEFT JOIN enterprises AS role_enterprise
           ON role_enterprise.id = COALESCE(role.enterprise_id, role_department.enterprise_id)
         LEFT JOIN user_roles AS user_role ON user_role.role_id = role.id
         GROUP BY role.id
         ORDER BY role.is_system DESC, role.name`,
      )
      .all() as RoleRow[];

    const permissionStatement = this.database.prepare(
      `SELECT permission.code
       FROM role_permissions AS role_permission
       JOIN permissions AS permission ON permission.id = role_permission.permission_id
       WHERE role_permission.role_id = ?
       ORDER BY permission.module, permission.name`,
    );

    return roles.map((role) => ({
      id: role.id,
      code: role.code,
      name: role.name,
      description: role.description,
      scopeType: role.scope_type,
      isSystem: role.is_system === 1,
      systemKey: role.system_key,
      enterpriseId: role.enterprise_id,
      enterpriseName: role.enterprise_name ?? "",
      departmentId: role.department_id,
      departmentName: role.department_name ?? "",
      permissionCodes: (permissionStatement.all(role.id) as Array<{ code: string }>).map(
        (item) => item.code,
      ),
      userCount: Number(role.user_count) + (role.system_key === "superadmin" ? 1 : 0),
    }));
  }

  listUsers(): AccessUserSummary[] {
    const users = this.database
      .prepare(
        `SELECT
           user.id,
           user.employee_id,
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
           user.status,
           user.must_change_password,
           user.created_at,
           user.updated_at,
           user.last_login_at
         FROM users AS user
         JOIN employees AS employee ON employee.id = user.employee_id
         LEFT JOIN departments AS department ON department.id = employee.department_id
         LEFT JOIN enterprises AS enterprise ON enterprise.id = department.enterprise_id
         ORDER BY employee.last_name, employee.first_name, user.username`,
      )
      .all() as UserRow[];

    const roleStatement = this.database.prepare(
      `SELECT
         role.id,
         role.code,
         role.name,
         role.scope_type,
         role.is_system,
         role.system_key,
         COALESCE(role.enterprise_id, role_department.enterprise_id) AS enterprise_id,
         role_enterprise.name AS enterprise_name,
         role.department_id,
         role_department.name AS department_name
       FROM user_roles AS user_role
       JOIN roles AS role ON role.id = user_role.role_id
       LEFT JOIN departments AS role_department ON role_department.id = role.department_id
       LEFT JOIN enterprises AS role_enterprise
         ON role_enterprise.id = COALESCE(role.enterprise_id, role_department.enterprise_id)
       WHERE user_role.user_id = ?
       ORDER BY role.is_system DESC, role.name`,
    );
    const permissionStatement = this.database.prepare(
      `SELECT DISTINCT permission.code
       FROM user_roles AS user_role
       JOIN roles AS role ON role.id = user_role.role_id
       JOIN users AS user ON user.id = user_role.user_id
       JOIN employees AS employee ON employee.id = user.employee_id
       LEFT JOIN departments AS employee_department ON employee_department.id = employee.department_id
       JOIN role_permissions AS role_permission ON role_permission.role_id = user_role.role_id
       JOIN permissions AS permission ON permission.id = role_permission.permission_id
       WHERE user_role.user_id = ?
         AND (
           role.is_system = 1
           OR role.scope_type = 'global'
           OR (role.scope_type = 'enterprise' AND role.enterprise_id = employee_department.enterprise_id)
           OR (role.scope_type = 'department' AND role.department_id = employee.department_id)
         )
       ORDER BY permission.code`,
    );

    return users.map((user) => ({
      id: user.id,
      employeeId: user.employee_id,
      employeeName: user.employee_name,
      departmentId: user.department_id,
      departmentName: user.department_name ?? "",
      enterpriseId: user.enterprise_id,
      enterpriseName: user.enterprise_name ?? "",
      username: user.username,
      status: user.status,
      mustChangePassword: user.must_change_password === 1,
      roles: (roleStatement.all(user.id) as RoleRow[]).map<AccessUserRole>((role) => ({
        id: role.id,
        code: role.code,
        name: role.name,
        scopeType: role.scope_type,
        isSystem: role.is_system === 1,
        systemKey: role.system_key,
        enterpriseId: role.enterprise_id,
        enterpriseName: role.enterprise_name ?? "",
        departmentId: role.department_id,
        departmentName: role.department_name ?? "",
      })),
      effectivePermissionCodes: (
        permissionStatement.all(user.id) as Array<{ code: string }>
      ).map((item) => item.code),
      createdAt: user.created_at,
      updatedAt: user.updated_at,
      lastLoginAt: user.last_login_at,
    }));
  }

  getRoleById(id: number): AccessRoleSummary | null {
    return this.listRoles().find((role) => role.id === id) ?? null;
  }

  getUserById(id: number): AccessUserSummary | null {
    return this.listUsers().find((user) => user.id === id) ?? null;
  }

  getSystemRolesByIds(roleIds: number[]): SystemRoleKey[] {
    if (roleIds.length === 0) return [];
    const placeholders = roleIds.map(() => "?").join(", ");
    const rows = this.database
      .prepare(
        `SELECT system_key FROM roles WHERE id IN (${placeholders}) AND is_system = 1`,
      )
      .all(...roleIds) as Array<{ system_key: SystemRoleKey }>;
    return rows.map((row) => row.system_key);
  }

  rolesExist(roleIds: number[]): boolean {
    if (roleIds.length === 0) return false;
    const placeholders = roleIds.map(() => "?").join(", ");
    const row = this.database
      .prepare(`SELECT COUNT(*) AS count FROM roles WHERE id IN (${placeholders})`)
      .get(...roleIds) as { count: number };
    return Number(row.count) === new Set(roleIds).size;
  }

  permissionCodesExist(permissionCodes: string[]): boolean {
    if (permissionCodes.length === 0) return true;
    const uniqueCodes = [...new Set(permissionCodes)];
    const placeholders = uniqueCodes.map(() => "?").join(", ");
    const row = this.database
      .prepare(`SELECT COUNT(*) AS count FROM permissions WHERE code IN (${placeholders})`)
      .get(...uniqueCodes) as { count: number };
    return Number(row.count) === uniqueCodes.length;
  }

  usernameExists(username: string, excludeId?: number): boolean {
    const row = this.database
      .prepare(
        `SELECT id FROM users
         WHERE username = ? COLLATE NOCASE
           AND (? IS NULL OR id <> ?)
         LIMIT 1`,
      )
      .get(username, excludeId ?? null, excludeId ?? null);
    return Boolean(row);
  }

  employeeHasUser(employeeId: number, excludeId?: number): boolean {
    const row = this.database
      .prepare(
        `SELECT id FROM users
         WHERE employee_id = ? AND (? IS NULL OR id <> ?) LIMIT 1`,
      )
      .get(employeeId, excludeId ?? null, excludeId ?? null);
    return Boolean(row);
  }

  employeeExists(employeeId: number): boolean {
    return Boolean(
      this.database.prepare("SELECT id FROM employees WHERE id = ? LIMIT 1").get(employeeId),
    );
  }

  getEmployeeOrganizationScope(employeeId: number): EmployeeOrganizationScope | null {
    const row = this.database
      .prepare(
        `SELECT
           employee.department_id AS departmentId,
           department.enterprise_id AS enterpriseId
         FROM employees AS employee
         LEFT JOIN departments AS department ON department.id = employee.department_id
         WHERE employee.id = ?
         LIMIT 1`,
      )
      .get(employeeId) as EmployeeOrganizationScope | undefined;
    return row ?? null;
  }

  isEnterpriseDirector(employeeId: number): boolean {
    return Boolean(
      this.database
        .prepare(
          `SELECT id FROM enterprises WHERE general_director_employee_id = ? LIMIT 1`,
        )
        .get(employeeId),
    );
  }

  isDepartmentHead(employeeId: number): boolean {
    return Boolean(
      this.database
        .prepare(`SELECT id FROM departments WHERE director_employee_id = ? LIMIT 1`)
        .get(employeeId),
    );
  }

  countActiveSuperadmins(excludeUserId?: number): number {
    const row = this.database
      .prepare(
        `SELECT COUNT(DISTINCT user.id) AS count
         FROM users AS user
         JOIN user_roles AS user_role ON user_role.user_id = user.id
         JOIN roles AS role ON role.id = user_role.role_id
         WHERE user.status = 'active'
           AND role.system_key = 'superadmin'
           AND (? IS NULL OR user.id <> ?)`,
      )
      .get(excludeUserId ?? null, excludeUserId ?? null) as { count: number };
    return Number(row.count);
  }

  saveRole(input: PersistAccessRoleInput): AccessRoleSummary {
    const transaction = this.database.transaction(() => {
      let roleId = input.id;
      if (roleId) {
        this.database
          .prepare(
            `UPDATE roles
             SET name = ?, description = ?, scope_type = ?, enterprise_id = ?, department_id = ?
             WHERE id = ? AND is_system = 0`,
          )
          .run(
            input.name,
            input.description,
            input.scopeType,
            input.enterpriseId,
            input.departmentId,
            roleId,
          );
        this.database.prepare("DELETE FROM role_permissions WHERE role_id = ?").run(roleId);
      } else {
        const result = this.database
          .prepare(
            `INSERT INTO roles (
               code, name, description, scope_type, is_system, system_key,
               enterprise_id, department_id
             ) VALUES (?, ?, ?, ?, 0, NULL, ?, ?)`,
          )
          .run(
            input.code,
            input.name,
            input.description,
            input.scopeType,
            input.enterpriseId,
            input.departmentId,
          );
        roleId = Number(result.lastInsertRowid);
      }

      const insertPermission = this.database.prepare(
        `INSERT INTO role_permissions (role_id, permission_id)
         SELECT ?, id FROM permissions WHERE code = ?`,
      );
      for (const code of [...new Set(input.permissionCodes)]) {
        insertPermission.run(roleId, code);
      }
      return roleId;
    });

    const roleId = transaction();
    const role = this.getRoleById(roleId);
    if (!role) throw new Error("Не удалось получить сохранённую роль");
    return role;
  }

  deleteRole(id: number): void {
    this.database.prepare("DELETE FROM roles WHERE id = ? AND is_system = 0").run(id);
  }

  saveUser(input: PersistAccessUserInput): AccessUserSummary {
    const transaction = this.database.transaction(() => {
      let userId = input.id;
      if (userId) {
        if (input.passwordHash && input.passwordSalt) {
          this.database
            .prepare(
              `UPDATE users
               SET employee_id = ?, username = ?, status = ?, password_hash = ?,
                   password_salt = ?, must_change_password = ?
               WHERE id = ?`,
            )
            .run(
              input.employeeId,
              input.username,
              input.status,
              input.passwordHash,
              input.passwordSalt,
              input.mustChangePassword ? 1 : 0,
              userId,
            );
        } else {
          this.database
            .prepare(
              `UPDATE users
               SET employee_id = ?, username = ?, status = ?, must_change_password = ?
               WHERE id = ?`,
            )
            .run(
              input.employeeId,
              input.username,
              input.status,
              input.mustChangePassword ? 1 : 0,
              userId,
            );
        }
        this.database.prepare("DELETE FROM user_roles WHERE user_id = ?").run(userId);
      } else {
        if (!input.passwordHash || !input.passwordSalt) {
          throw new Error("Для нового пользователя необходим временный пароль");
        }
        const result = this.database
          .prepare(
            `INSERT INTO users (
               employee_id, username, password_hash, password_salt, status, must_change_password
             ) VALUES (?, ?, ?, ?, ?, ?)`,
          )
          .run(
            input.employeeId,
            input.username,
            input.passwordHash,
            input.passwordSalt,
            input.status,
            input.mustChangePassword ? 1 : 0,
          );
        userId = Number(result.lastInsertRowid);
      }

      const insertRole = this.database.prepare(
        "INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)",
      );
      for (const roleId of [...new Set(input.roleIds)]) {
        insertRole.run(userId, roleId);
      }
      return userId;
    });

    const userId = transaction();
    const user = this.getUserById(userId);
    if (!user) throw new Error("Не удалось получить сохранённого пользователя");
    return user;
  }

  resetPassword(
    userId: number,
    passwordHash: string,
    passwordSalt: string,
    mustChangePassword: boolean,
  ): void {
    this.database
      .prepare(
        `UPDATE users
         SET password_hash = ?, password_salt = ?, must_change_password = ?
         WHERE id = ?`,
      )
      .run(passwordHash, passwordSalt, mustChangePassword ? 1 : 0, userId);
  }

  deleteUser(id: number): void {
    this.database.prepare("DELETE FROM users WHERE id = ?").run(id);
  }
}
