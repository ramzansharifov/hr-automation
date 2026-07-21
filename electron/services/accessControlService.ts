import { randomBytes, randomUUID, scryptSync } from "node:crypto";
import type {
  AccessControlOverview,
  AccessRoleSummary,
  AccessUserSummary,
  ResetAccessPasswordParams,
  SaveAccessRoleParams,
  SaveAccessUserParams,
  SystemRoleKey,
} from "../../src/shared/types/access";
import { AccessControlRepository } from "../repositories/accessControlRepository";

const usernamePattern = /^[a-zA-Z0-9._-]{3,64}$/;
const minimumPasswordLength = 8;

export class AccessControlService {
  constructor(private readonly repository: AccessControlRepository) {}

  getOverview(): AccessControlOverview {
    return {
      permissions: this.repository.listPermissions(),
      roles: this.repository.listRoles(),
      users: this.repository.listUsers(),
    };
  }

  saveRole(params: SaveAccessRoleParams): AccessRoleSummary {
    const name = params.name.trim();
    const description = params.description?.trim() ?? "";
    const permissionCodes = [...new Set(params.permissionCodes)];

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

    const hasGlobalAdministrativePermission = permissionCodes.some((code) =>
      ["access.manage", "settings.manage"].includes(code),
    );
    if (hasGlobalAdministrativePermission && params.scopeType !== "global") {
      throw new Error(
        "Управление пользователями и системными настройками требует глобальной области данных",
      );
    }
    if (
      permissionCodes.includes("access.manage") &&
      !permissionCodes.includes("employees.view")
    ) {
      throw new Error(
        "Для управления пользователями добавьте разрешение «Просмотр сотрудников»",
      );
    }

    if (params.id) {
      const existingRole = this.repository.getRoleById(params.id);
      if (!existingRole) throw new Error("Роль не найдена");
      if (existingRole.isSystem) {
        throw new Error("Системные роли нельзя изменять");
      }
    }

    try {
      return this.repository.saveRole({
        id: params.id,
        code: params.id ? "" : createCustomRoleCode(),
        name,
        description,
        scopeType: params.scopeType,
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
      return { success: true };
    } catch (error) {
      throw normalizeDatabaseError(error, "Не удалось удалить роль");
    }
  }

  saveUser(params: SaveAccessUserParams): AccessUserSummary {
    const username = params.username.trim().toLowerCase();
    const roleIds = [...new Set(params.roleIds.map(Number))].filter(
      Number.isFinite,
    );
    const existingUser = params.id ? this.repository.getUserById(params.id) : null;
    const isFirstUser = !params.id && this.repository.listUsers().length === 0;

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
    if (
      isFirstUser &&
      (params.status !== "active" || !systemRoles.includes("superadmin"))
    ) {
      throw new Error("Первый пользователь должен быть активным superadmin");
    }

    this.validateSystemRoleAssignments(params.employeeId, systemRoles);
    this.ensureSuperadminContinuity(existingUser, params.status, systemRoles);

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
    return { success: true };
  }

  deleteUser(id: number): { success: true } {
    const user = this.repository.getUserById(id);
    if (!user) throw new Error("Пользователь не найден");

    const isActiveSuperadmin =
      user.status === "active" &&
      user.roles.some((role) => role.systemKey === "superadmin");
    if (
      isActiveSuperadmin &&
      this.repository.countActiveSuperadmins(id) === 0
    ) {
      throw new Error("Нельзя удалить последнего активного superadmin");
    }

    try {
      this.repository.deleteUser(id);
      return { success: true };
    } catch (error) {
      throw normalizeDatabaseError(error, "Не удалось удалить пользователя");
    }
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
        "Роль «Директор предприятия» можно назначить только сотруднику, указанному генеральным директором предприятия",
      );
    }

    if (
      systemRoles.includes("department_head") &&
      !this.repository.isDepartmentHead(employeeId)
    ) {
      throw new Error(
        "Роль «Начальник отдела» можно назначить только действующему директору отдела",
      );
    }
  }

  private ensureSuperadminContinuity(
    existingUser: AccessUserSummary | null,
    nextStatus: SaveAccessUserParams["status"],
    nextSystemRoles: SystemRoleKey[],
  ): void {
    if (!existingUser) return;

    const wasActiveSuperadmin =
      existingUser.status === "active" &&
      existingUser.roles.some((role) => role.systemKey === "superadmin");
    const remainsActiveSuperadmin =
      nextStatus === "active" && nextSystemRoles.includes("superadmin");

    if (
      wasActiveSuperadmin &&
      !remainsActiveSuperadmin &&
      this.repository.countActiveSuperadmins(existingUser.id) === 0
    ) {
      throw new Error("В системе должен остаться хотя бы один активный superadmin");
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
