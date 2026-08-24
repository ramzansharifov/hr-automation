import { ipcMain, type IpcMainInvokeEvent } from "electron";
import {
  accessScopeRank,
  canScopePermissionTo,
  legacyPermissionCodes,
  normalizePermissionDependencies,
} from "../../src/shared/access/permissionRules";
import type {
  AccessRoleSummary,
  AccessScopeType,
  AccessUserSummary,
  AuthSession,
} from "../../src/shared/types/access";
import type { HrRecord } from "../../src/shared/types/hr";
import { getDatabase } from "../database/connection";
import {
  AccessControlRepository,
  type EmployeeOrganizationScope,
} from "../repositories/accessControlRepository";
import {
  AccessControlService,
  type AccessRoleWriteScope,
} from "../services/accessControlService";
import { AuditService } from "../services/auditService";
import { getActiveAuthenticationService } from "../services/authenticationService";
import { AuthorizationService } from "../services/authorizationService";
import { ipcValidation } from "./ipcValidation";

const legacyAccessChannels = [
  "access:overview",
  "access:saveRole",
  "access:deleteRole",
  "access:saveUser",
  "access:resetPassword",
  "access:deleteUser",
];

const scopedAdminSystemKeys = new Set(["enterprise_admin", "department_admin"]);

export function registerAccessIpcHandlers(): void {
  const database = getDatabase();
  const repository = new AccessControlRepository(database);
  const accessService = new AccessControlService(repository);
  const authenticationService = getActiveAuthenticationService();
  const authorizationService = new AuthorizationService(
    database,
    authenticationService,
  );
  const auditService = new AuditService(database);

  for (const channel of legacyAccessChannels) ipcMain.removeHandler(channel);

  ipcMain.handle("access:listPermissions", (event) => {
    assertTrustedSender(event);
    const session = authorizationService.requirePermission("roles.view");
    const managementScope = managementScopeFromSession(session);
    return accessService.listPermissions().filter((permission) =>
      canDelegatePermissionCodes(session, [permission.code], managementScope),
    );
  });

  ipcMain.handle("access:listRoles", (event) => {
    assertTrustedSender(event);
    const session = authenticationService.requireSession();
    const managementScope = requireAnyAccessManagementScope(session, [
      "roles.view",
      "users.view",
    ]);
    const allUsers = accessService.listUsers();
    const visibleUsers = filterUsersForScope(allUsers, managementScope);
    return filterRolesForScope(accessService.listRoles(), managementScope).map(
      (role) => ({
        ...role,
        userCount:
          role.systemKey === "superadmin"
            ? 0
            : visibleUsers.filter((user) =>
                user.roles.some((assignedRole) => assignedRole.id === role.id),
              ).length,
      }),
    );
  });

  ipcMain.handle("access:listUsers", (event) => {
    assertTrustedSender(event);
    const session = authorizationService.requirePermission("users.view");
    return filterUsersForScope(
      accessService.listUsers(),
      managementScopeFromSession(session),
    );
  });

  ipcMain.handle("access:getSystemAdmin", (event) => {
    assertTrustedSender(event);
    authorizationService.requireGlobalPermission("users.view");
    return accessService.getSystemAdmin();
  });

  ipcMain.handle("access:saveRole", (event, raw: unknown) => {
    assertTrustedSender(event);
    const params = ipcValidation.saveRole(raw);
    const session = authorizationService.requirePermission(
      params.id ? "roles.edit" : "roles.create",
    );
    const actorScope = managementScopeFromSession(session);

    if (params.permissionCodes.some((code) => legacyPermissionCodes.has(code))) {
      throw new Error("Устаревшие разрешения нельзя назначать новым ролям");
    }

    const allRoles = accessService.listRoles();
    const before = params.id
      ? allRoles.find((role) => role.id === params.id) ?? null
      : null;
    if (params.id && !before) throw new Error("Роль не найдена");
    if (before?.isSystem) throw new Error("Системные роли нельзя изменять");
    if (before) assertRoleInManagementScope(before, actorScope);

    const targetScope = before ? writeScopeFromRole(before) : actorScope;
    assertCanDelegatePermissionCodes(session, params.permissionCodes, targetScope);
    if (before && !isSuperadminSession(session)) {
      assertCanDelegatePermissionCodes(session, before.permissionCodes, targetScope);
    }

    const saved = accessService.saveRole(params, targetScope);
    auditService.record(
      authenticationService.requireSession(),
      params.id ? "access.role.update" : "access.role.create",
      "roles",
      saved.id,
      before ? (before as unknown as HrRecord) : null,
      saved as unknown as HrRecord,
      {
        scopeType: saved.scopeType,
        enterpriseId: saved.enterpriseId,
        departmentId: saved.departmentId,
      },
    );
    return saved;
  });

  ipcMain.handle("access:deleteRole", (event, raw: unknown) => {
    assertTrustedSender(event);
    const session = authorizationService.requirePermission("roles.delete");
    const actorScope = managementScopeFromSession(session);
    const id = ipcValidation.id(raw);
    const before = accessService.listRoles().find((role) => role.id === id);
    if (!before) throw new Error("Роль не найдена");
    if (before.isSystem) throw new Error("Системную роль нельзя удалить");
    assertRoleInManagementScope(before, actorScope);

    const result = accessService.deleteRole(id);
    auditService.record(
      authenticationService.requireSession(),
      "access.role.delete",
      "roles",
      id,
      before as unknown as HrRecord,
    );
    return result;
  });

  ipcMain.handle("access:saveUser", (event, raw: unknown) => {
    assertTrustedSender(event);
    const params = ipcValidation.saveUser(raw);
    const session = authorizationService.requirePermission(
      params.id ? "users.edit" : "users.create",
    );
    const actorScope = managementScopeFromSession(session);
    const allRoles = accessService.listRoles();
    const allUsers = accessService.listUsers();
    const before = params.id
      ? allUsers.find((user) => user.id === params.id) ?? null
      : null;

    if (params.id && !before) throw new Error("Пользователь не найден");
    if (before) {
      assertUserInManagementScope(before, actorScope);
      if (!isSuperadminSession(session)) {
        assertCanControlTargetCredentials(session, before, allRoles);
      }
    }

    const employeeScope = repository.getEmployeeOrganizationScope(params.employeeId);
    assertEmployeeInManagementScope(employeeScope, actorScope);

    if (
      params.id === session.userId &&
      params.status !== "active" &&
      session.employeeId > 0
    ) {
      throw new Error("Нельзя заблокировать собственную учётную запись");
    }

    assertCanAssignRequestedRoles(
      session,
      params.roleIds,
      allRoles,
      employeeScope,
    );

    const preservedScopedAdminRoleIds =
      before && !isSuperadminSession(session)
        ? before.roles
            .filter((role) => role.systemKey && scopedAdminSystemKeys.has(role.systemKey))
            .map((role) => role.id)
        : [];
    const effectiveParams = {
      ...params,
      roleIds: [...new Set([...params.roleIds, ...preservedScopedAdminRoleIds])],
    };

    const saved = accessService.saveUser(effectiveParams);
    auditService.record(
      authenticationService.requireSession(),
      params.id ? "access.user.update" : "access.user.create",
      "users",
      saved.id,
      before ? (before as unknown as HrRecord) : null,
      saved as unknown as HrRecord,
      {
        enterpriseId: saved.enterpriseId ?? null,
        departmentId: saved.departmentId ?? null,
      },
    );
    return saved;
  });

  ipcMain.handle("access:resetPassword", (event, raw: unknown) => {
    assertTrustedSender(event);
    const session = authorizationService.requirePermission("users.reset_password");
    const actorScope = managementScopeFromSession(session);
    const params = ipcValidation.resetPassword(raw);
    const allRoles = accessService.listRoles();
    const targetUser = accessService
      .listUsers()
      .find((user) => user.id === params.userId);
    if (!targetUser) throw new Error("Пользователь не найден");
    assertUserInManagementScope(targetUser, actorScope);
    if (session.employeeId > 0 && targetUser.id === session.userId) {
      throw new Error("Собственный пароль изменяется в настройках профиля");
    }
    if (!isSuperadminSession(session)) {
      assertCanControlTargetCredentials(session, targetUser, allRoles);
    }

    const result = accessService.resetPassword(params);
    auditService.record(
      authenticationService.requireSession(),
      "access.password.reset",
      "users",
      params.userId,
    );
    return result;
  });

  ipcMain.handle("access:deleteUser", (event, raw: unknown) => {
    assertTrustedSender(event);
    const session = authorizationService.requirePermission("users.delete");
    const actorScope = managementScopeFromSession(session);
    const id = ipcValidation.id(raw);
    const allRoles = accessService.listRoles();
    const before = accessService.listUsers().find((user) => user.id === id);
    if (!before) throw new Error("Пользователь не найден");
    assertUserInManagementScope(before, actorScope);
    if (session.employeeId > 0 && before.id === session.userId) {
      throw new Error("Нельзя удалить собственную учётную запись");
    }
    if (!isSuperadminSession(session)) {
      assertCanControlTargetCredentials(session, before, allRoles);
    }

    const result = accessService.deleteUser(id);
    auditService.record(
      authenticationService.requireSession(),
      "access.user.delete",
      "users",
      id,
      before as unknown as HrRecord,
    );
    return result;
  });
}

function managementScopeFromSession(session: AuthSession): AccessRoleWriteScope {
  if (session.scopeType === "global") {
    return { scopeType: "global", enterpriseId: null, departmentId: null };
  }
  if (session.scopeType === "enterprise") {
    if (!session.enterpriseId) {
      throw new Error("Для текущей учётной записи не определено предприятие");
    }
    return {
      scopeType: "enterprise",
      enterpriseId: session.enterpriseId,
      departmentId: null,
    };
  }
  if (session.scopeType === "department") {
    if (!session.departmentId) {
      throw new Error("Для текущей учётной записи не определён отдел");
    }
    return {
      scopeType: "department",
      enterpriseId: null,
      departmentId: session.departmentId,
    };
  }
  throw new Error("Управление доступом недоступно в личной области данных");
}

function requireAnyAccessManagementScope(
  session: AuthSession,
  permissionCodes: string[],
): AccessRoleWriteScope {
  const scopes = permissionCodes
    .map((code) => session.permissionScopes[code])
    .filter((scope): scope is AccessScopeType => Boolean(scope));
  if (scopes.length === 0) {
    throw new Error("Недостаточно прав для выполнения действия");
  }
  const broadestScope = scopes.reduce((current, candidate) =>
    accessScopeRank[candidate] > accessScopeRank[current] ? candidate : current,
  );
  return managementScopeFromSession({ ...session, scopeType: broadestScope });
}

function filterUsersForScope(
  users: AccessUserSummary[],
  scope: AccessRoleWriteScope,
): AccessUserSummary[] {
  if (scope.scopeType === "global") return users;
  if (scope.scopeType === "enterprise") {
    return users.filter((user) => user.enterpriseId === scope.enterpriseId);
  }
  return users.filter((user) => user.departmentId === scope.departmentId);
}

function filterRolesForScope(
  roles: AccessRoleSummary[],
  scope: AccessRoleWriteScope,
): AccessRoleSummary[] {
  if (scope.scopeType === "global") return roles;
  return roles.filter((role) => {
    if (role.isSystem) return role.systemKey !== "superadmin";
    if (scope.scopeType === "enterprise") {
      return (
        (role.scopeType === "enterprise" && role.enterpriseId === scope.enterpriseId) ||
        (role.scopeType === "department" && role.enterpriseId === scope.enterpriseId)
      );
    }
    return role.scopeType === "department" && role.departmentId === scope.departmentId;
  });
}

function assertRoleInManagementScope(
  role: AccessRoleSummary,
  actorScope: AccessRoleWriteScope,
): void {
  if (actorScope.scopeType === "global") return;
  const visible = filterRolesForScope([role], actorScope).length === 1;
  if (!visible || role.isSystem) {
    throw new Error("Роль находится вне доступной области администрирования");
  }
}

function assertUserInManagementScope(
  user: AccessUserSummary,
  actorScope: AccessRoleWriteScope,
): void {
  if (filterUsersForScope([user], actorScope).length === 0) {
    throw new Error("Пользователь находится вне доступной области администрирования");
  }
}

function assertEmployeeInManagementScope(
  employeeScope: EmployeeOrganizationScope | null,
  actorScope: AccessRoleWriteScope,
): void {
  if (!employeeScope) throw new Error("Выбранный сотрудник не найден");
  if (actorScope.scopeType === "global") return;
  if (
    actorScope.scopeType === "enterprise" &&
    employeeScope.enterpriseId === actorScope.enterpriseId
  ) {
    return;
  }
  if (
    actorScope.scopeType === "department" &&
    employeeScope.departmentId === actorScope.departmentId
  ) {
    return;
  }
  throw new Error("Сотрудник находится вне доступной области администрирования");
}

function assertCanDelegatePermissionCodes(
  session: AuthSession,
  permissionCodes: string[],
  targetScope: AccessRoleWriteScope,
): void {
  if (isSuperadminSession(session)) {
    const incompatible = normalizePermissionDependencies(permissionCodes).find(
      (code) => !canScopePermissionTo(code, targetScope.scopeType),
    );
    if (incompatible) {
      throw new Error(
        "Глобальное разрешение нельзя включить в роль предприятия или отдела",
      );
    }
    return;
  }

  const normalized = normalizePermissionDependencies(permissionCodes).filter(
    (code) => !legacyPermissionCodes.has(code),
  );
  const forbidden = normalized.filter((code) => {
    const actorPermissionScope = session.permissionScopes[code];
    if (!actorPermissionScope) return true;
    if (!canScopePermissionTo(code, targetScope.scopeType)) return true;
    if (accessScopeRank[actorPermissionScope] < accessScopeRank[targetScope.scopeType]) {
      return true;
    }
    return !permissionScopeContainsTarget(session, actorPermissionScope, targetScope);
  });

  if (forbidden.length > 0) {
    throw new Error(
      "Нельзя выдать роли разрешения шире текущей области администрирования",
    );
  }
}

function canDelegatePermissionCodes(
  session: AuthSession,
  permissionCodes: string[],
  targetScope: AccessRoleWriteScope,
): boolean {
  try {
    assertCanDelegatePermissionCodes(session, permissionCodes, targetScope);
    return true;
  } catch {
    return false;
  }
}

function permissionScopeContainsTarget(
  session: AuthSession,
  actorPermissionScope: AccessScopeType,
  targetScope: AccessRoleWriteScope,
): boolean {
  if (actorPermissionScope === "global") return true;
  if (actorPermissionScope === "enterprise") {
    if (!session.enterpriseId) return false;
    if (targetScope.scopeType === "enterprise") {
      return targetScope.enterpriseId === session.enterpriseId;
    }
    if (targetScope.scopeType === "department") {
      return true;
    }
    return false;
  }
  if (actorPermissionScope === "department") {
    return (
      targetScope.scopeType === "department" &&
      targetScope.departmentId === session.departmentId
    );
  }
  return false;
}

function assertCanAssignRequestedRoles(
  session: AuthSession,
  requestedRoleIds: number[],
  roles: AccessRoleSummary[],
  employeeScope: EmployeeOrganizationScope | null,
): void {
  const roleMap = new Map(roles.map((role) => [role.id, role]));
  const requestedRoles = [...new Set(requestedRoleIds)].map((id) => roleMap.get(id));
  if (requestedRoles.some((role) => !role)) {
    throw new Error("Одна из выбранных ролей не найдена");
  }

  for (const role of requestedRoles as AccessRoleSummary[]) {
    assertRoleCanBeAssigned(session, role, employeeScope);
  }
}

function assertCanControlTargetCredentials(
  session: AuthSession,
  targetUser: AccessUserSummary,
  roles: AccessRoleSummary[],
): void {
  const roleMap = new Map(roles.map((role) => [role.id, role]));
  const employeeScope: EmployeeOrganizationScope = {
    enterpriseId: targetUser.enterpriseId ?? null,
    departmentId: targetUser.departmentId ?? null,
  };

  for (const assignedRole of targetUser.roles) {
    if (assignedRole.systemKey === "employee") continue;
    if (assignedRole.systemKey === "superadmin") {
      throw new Error("Нельзя управлять учётной записью Superadmin");
    }
    const role = roleMap.get(assignedRole.id);
    if (!role) continue;
    const targetScope = effectiveRoleScopeForEmployee(role, employeeScope);
    try {
      assertCanDelegatePermissionCodes(session, role.permissionCodes, targetScope);
    } catch {
      throw new Error(
        "Нельзя управлять более привилегированной учётной записью",
      );
    }
  }
}

function assertRoleCanBeAssigned(
  session: AuthSession,
  role: AccessRoleSummary,
  employeeScope: EmployeeOrganizationScope | null,
): void {
  if (role.systemKey === "superadmin") {
    throw new Error("Роль Superadmin нельзя назначать пользователям");
  }
  if (
    role.systemKey === "enterprise_director" ||
    role.systemKey === "department_head"
  ) {
    throw new Error(
      "Руководящие системные роли назначаются автоматически из оргструктуры",
    );
  }
  if (role.systemKey === "employee") return;

  if (
    role.systemKey === "enterprise_admin" ||
    role.systemKey === "department_admin"
  ) {
    if (!isSuperadminSession(session)) {
      throw new Error(
        "Системные роли администраторов назначаются только Superadmin",
      );
    }
    if (
      role.systemKey === "enterprise_admin" &&
      !employeeScope?.enterpriseId
    ) {
      throw new Error("Для администратора предприятия требуется предприятие");
    }
    if (
      role.systemKey === "department_admin" &&
      !employeeScope?.departmentId
    ) {
      throw new Error("Для администратора отдела требуется отдел");
    }
    return;
  }

  assertRoleMatchesEmployeeScope(role, employeeScope);
  assertCanDelegatePermissionCodes(
    session,
    role.permissionCodes,
    writeScopeFromRole(role),
  );
}

function assertRoleMatchesEmployeeScope(
  role: AccessRoleSummary,
  employeeScope: EmployeeOrganizationScope | null,
): void {
  if (role.scopeType === "global") return;
  if (!employeeScope) throw new Error("Не удалось определить оргструктуру сотрудника");
  if (
    role.scopeType === "enterprise" &&
    role.enterpriseId === employeeScope.enterpriseId
  ) {
    return;
  }
  if (
    role.scopeType === "department" &&
    role.departmentId === employeeScope.departmentId
  ) {
    return;
  }
  throw new Error("Выбранная роль не действует для этого сотрудника");
}

function effectiveRoleScopeForEmployee(
  role: AccessRoleSummary,
  employeeScope: EmployeeOrganizationScope,
): AccessRoleWriteScope {
  if (!role.isSystem) return writeScopeFromRole(role);
  if (role.scopeType === "enterprise") {
    return {
      scopeType: "enterprise",
      enterpriseId: employeeScope.enterpriseId,
      departmentId: null,
    };
  }
  if (role.scopeType === "department") {
    return {
      scopeType: "department",
      enterpriseId: null,
      departmentId: employeeScope.departmentId,
    };
  }
  return {
    scopeType: "global",
    enterpriseId: null,
    departmentId: null,
  };
}

function writeScopeFromRole(role: AccessRoleSummary): AccessRoleWriteScope {
  if (role.scopeType === "global") {
    return { scopeType: "global", enterpriseId: null, departmentId: null };
  }
  if (role.scopeType === "enterprise") {
    if (!role.enterpriseId) throw new Error("У роли не определено предприятие");
    return {
      scopeType: "enterprise",
      enterpriseId: role.enterpriseId,
      departmentId: null,
    };
  }
  if (role.scopeType === "department") {
    if (!role.departmentId) throw new Error("У роли не определён отдел");
    return {
      scopeType: "department",
      enterpriseId: null,
      departmentId: role.departmentId,
    };
  }
  throw new Error("Пользовательская роль не может иметь личную область данных");
}

function isSuperadminSession(session: AuthSession): boolean {
  return (
    session.employeeId === 0 ||
    session.roles.some((role) => role.systemKey === "superadmin")
  );
}

function assertTrustedSender(event: IpcMainInvokeEvent): void {
  const url = event.senderFrame?.url ?? "";
  const devServer = process.env.VITE_DEV_SERVER_URL;
  if (url.startsWith("file://")) return;
  if (devServer && url.startsWith(devServer)) return;
  throw new Error("Недоверенный источник IPC-запроса");
}
