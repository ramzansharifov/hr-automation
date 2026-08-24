import { randomBytes, randomUUID, scryptSync } from "node:crypto";
import { normalizePermissionDependencies } from "../../src/shared/access/permissionRules";
import type {
  AccessControlOverview,
  AccessPermission,
  AccessRoleSummary,
  AccessUserSummary,
  ResetAccessPasswordParams,
  SaveAccessRoleParams,
  SaveAccessUserParams,
  SystemAdminSummary,
  SystemRoleKey,
} from "../../src/shared/types/access";
import { AccessControlRepository } from "../repositories/accessControlRepository";

const usernamePattern = /^[a-zA-Z0-9._-]{3,64}$/;
const minimumPasswordLength = 8;

export class AccessControlService {
  constructor(private readonly repository: AccessControlRepository) {}

  listPermissions(): AccessPermission[] {
    return this.repository.listPermissions();
  }

  listRoles(): AccessRoleSummary[] {
    return this.repository.listRoles();
  }

  listUsers(): AccessUserSummary[] {
    return this.repository.listUsers();
  }

  getSystemAdmin(): SystemAdminSummary {
    return this.repository.getSystemAdmin();
  }

  getOverview(): AccessControlOverview {
    return {
      permissions: this.listPermissions(),
      roles: this.listRoles(),
      users: this.listUsers(),
      systemAdmin: this.getSystemAdmin(),
    };
  }

  saveRole(params: SaveAccessRoleParams): AccessRoleSummary {
    const name = params.name.trim();
    const description = params.description?.trim() ?? "";
    const permissionCodes = normalizePermissionDependencies(params.permissionCodes);

    if (!name) throw new Error("Укажите название роли");
    if (name.length > 100) {
      throw new Error("Название роли не должно превышать 100 символов");
    }
    if (permissionCodes.length === 0) {
      throw new Error("Выберите хотя бы одно разрешение для роли");
    }
    if (!this.repository.permissionCodesExist(permissionCodes)) {
      throw new Error("В роли указано неизвестное разрешение");
    }

    if (params.id) {
      const existingRole = this.repository.getRoleById(params.id);
      if (!existingRole) throw new Error("Роль не найдена");
      if (existingRole.isSystem) throw new Error("Системные роли нельзя изменять");
    }

    try {
      return this.repository.saveRole({
        id: params.id,
        code: params.id ? "" : createCustomRoleCode(),
        name,
        description,
        scopeType: "global",
        permissionCodes,
      });
    } catch (error) {
      throw normalizeDatabaseError(error, "Не удалось сохранить роль");
    }
  }

  deleteRole(id: number): { success: true } {
    const role = this.repository.getRoleById(id);
    if (!role) throw new Error("Роль не найдена");
    if (role.isSystem) throw new Error("Системную роль нельзя удалить");
    if (role.userCount > 0) {
      throw new Error("Сначала снимите эту роль со всех пользователей");
    }
    try {
      this.repository.deleteRole(id);
      return { success: true as const };
    } catch (error) {
      throw normalizeDatabaseError(error, "Не удалось удалить роль");
    }
  }

  saveUser(params: SaveAccessUserParams): AccessUserSummary {
    const username = params.username.trim().toLowerCase();
    const requestedRoleIds = [...new Set(params.roleIds.map(Number))].filter(
      Number.isFinite,
    );
    const roleIds = this.includeRequiredLeadershipRoles(
      params.employeeId,
      requestedRoleIds,
    );
    const existingUser = params.id
      ? this.repository.getUserById(params.id)
      : null;

    if (params.id && !existingUser) throw new Error("Пользователь не найден");
    if (!Number.isFinite(params.employeeId) || params.employeeId <= 0) {
      throw new Error("Выберите сотрудника");
    }
    if (!this.repository.employeeExists(params.employeeId)) {
      throw new Error("Выбранный сотрудник не найден");
    }
    if (!usernamePattern.test(username)) {
      throw new Error(
        "Логин должен содержать 3–64 символа: латинские буквы, цифры, точку, дефис или подчёркивание",
      );
    }
    if (username === "superadmin") {
      throw new Error(
        "Логин superadmin зарезервирован для встроенного системного администратора",
      );
    }
    if (this.repository.usernameExists(username, params.id)) {
      throw new Error("Пользователь с таким логином уже существует");
    }
    if (this.repository.employeeHasUser(params.employeeId, params.id)) {
      throw new Error("Для этого сотрудника уже создана учётная запись");
    }
    if (roleIds.length === 0) {
      throw new Error("Назначьте пользователю хотя бы одну роль");
    }
    if (!this.repository.rolesExist(roleIds)) {
      throw new Error("Одна из выбранных ролей не найдена");
    }
    if (!params.id && !params.password) {
      throw new Error("Укажите временный пароль для нового пользователя");
    }
    if (params.password) validatePassword(params.password);

    const systemRoles = this.repository.getSystemRolesByIds(roleIds);
    if (systemRoles.includes("superadmin")) {
      throw new Error(
        "Роль Superadmin принадлежит только встроенной системной учётной записи",
      );
    }
    this.validateSystemRoleAssignments(params.employeeId, systemRoles);

    const password = params.password ? hashPassword(params.password) : null;
    try {
      return this.repository.saveUser({
        id: params.id,
        employeeId: params.employeeId,
        username,
        status: params.status,
        roleIds,
        passwordHash: password?.hash,
        passwordSalt: password?.salt,
        mustChangePassword: params.mustChangePassword ?? true,
      });
    } catch (error) {
      throw normalizeDatabaseError(error, "Не удалось сохранить пользователя");
    }
  }

  resetPassword(params: ResetAccessPasswordParams): { success: true } {
    if (!this.repository.getUserById(params.userId)) {
      throw new Error("Пользователь не найден");
    }
    validatePassword(params.password);
    const password = hashPassword(params.password);
    this.repository.resetPassword(
      params.userId,
      password.hash,
      password.salt,
      params.mustChangePassword ?? true,
    );
    return { success: true as const };
  }

  deleteUser(id: number): { success: true } {
    if (!this.repository.getUserById(id)) {
      throw new Error("Пользователь не найден");
    }
    try {
      this.repository.deleteUser(id);
      return { success: true as const };
    } catch (error) {
      throw normalizeDatabaseError(error, "Не удалось удалить пользователя");
    }
  }

  private includeRequiredLeadershipRoles(
    employeeId: number,
    roleIds: number[],
  ): number[] {
    const requiredSystemKeys: SystemRoleKey[] = [];
    if (this.repository.isEnterpriseDirector(employeeId)) {
      requiredSystemKeys.push("enterprise_director");
    }
    if (this.repository.isDepartmentHead(employeeId)) {
      requiredSystemKeys.push("department_head");
    }
    const requiredIds = this.repository
      .listRoles()
      .filter(
        (role) =>
          role.systemKey && requiredSystemKeys.includes(role.systemKey),
      )
      .map((role) => role.id);
    return [...new Set([...roleIds, ...requiredIds])];
  }

  private validateSystemRoleAssignments(
    employeeId: number,
    systemRoles: SystemRoleKey[],
  ): void {
    if (
      systemRoles.includes("enterprise_director") &&
      !this.repository.isEnterpriseDirector(employeeId)
    ) {
      throw new Error(
        "Роль «Руководитель предприятия» можно назначить только фактическому руководителю предприятия",
      );
    }
    if (
      systemRoles.includes("department_head") &&
      !this.repository.isDepartmentHead(employeeId)
    ) {
      throw new Error(
        "Роль «Руководитель отдела» можно назначить только фактическому руководителю отдела",
      );
    }

    const organizationScope = this.repository.getEmployeeOrganizationScope(employeeId);
    if (
      systemRoles.includes("enterprise_admin") &&
      !organizationScope?.enterpriseId
    ) {
      throw new Error(
        "Для роли «Администратор предприятия» сотрудник должен быть назначен в отдел предприятия",
      );
    }
    if (
      systemRoles.includes("department_admin") &&
      !organizationScope?.departmentId
    ) {
      throw new Error(
        "Для роли «Администратор отдела» сотрудник должен быть назначен в отдел",
      );
    }
  }
}

function validatePassword(password: string): void {
  if (password.length < minimumPasswordLength) {
    throw new Error(
      `Пароль должен содержать минимум ${minimumPasswordLength} символов`,
    );
  }
  if (!/[A-Za-zА-Яа-я]/.test(password) || !/\d/.test(password)) {
    throw new Error("Пароль должен содержать хотя бы одну букву и одну цифру");
  }
}

function hashPassword(password: string): { hash: string; salt: string } {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return { hash, salt };
}

function createCustomRoleCode(): string {
  return `custom_${Date.now()}_${randomUUID().slice(0, 8)}`;
}

function normalizeDatabaseError(error: unknown, fallback: string): Error {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("roles.name")) {
    return new Error("Роль с таким названием уже существует");
  }
  if (message.includes("users.username")) {
    return new Error("Пользователь с таким логином уже существует");
  }
  if (message.includes("users.employee_id")) {
    return new Error("Для этого сотрудника уже создана учётная запись");
  }
  return new Error(message || fallback);
}
