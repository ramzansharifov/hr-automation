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
  SaveAccessRoleParams,
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

type AccessDatabase = ReturnType<typeof getDatabase>;

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
    return accessService.listPermissions().filter(
      (permission) =>
        !legacyPermissionCodes.has(permission.code) &&
        (isSuperadminSession(session) || Boolean(session.permissionScopes[permission.code])),
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
      managementScopeForPermission(session, "users.view"),
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
    const permissionCode = params.id ? "roles.edit" : "roles.create";
    const session = authorizationService.requirePermission(permissionCode);
    const actorScope = managementScopeForPermission(session, permissionCode);

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

    const targetScope = before
      ? writeScopeFromRole(before)
      : resolveCreateRoleScope(database, session, actorScope, params);
    if (before) assertRequestedScopeMatchesExistingRole(params, before);

    assertCanDelegatePermissionCodes(
      database,
      session,
      params.permissionCodes,
      targetScope,
    );
    if (before && !isSuperadminSession(session)) {
      assertCanDelegatePermissionCodes(
        database,
        session,
        before.permissionCodes,
        targetScope,
      );
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
    const actorScope = managementScopeForPermission(session, "roles.delete");
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
      null,
      {
        enterpriseId: before.enterpriseId,
        departmentId: before.departmentId,
      },
    );
    return result;
  });

  ipcMain.handle("access:saveUser", (event, raw: unknown) => {
    assertTrustedSender(event);
    const params = ipcValidation.saveUser(raw);
    const permissionCode = params.id ? "users.edit" : "users.create";
    const session = authorizationService.requirePermission(permissionCode);
    const actorScope = managementScopeForPermission(session, permissionCode);
    const allRoles = accessService.listRoles();
    const allUsers = accessService.listUsers();
    const before = params.id
      ? allUsers.find((user) => user.id === params.id) ?? null
      : null;

    if (params.id && !before) throw new Error("Пользователь не найден");
    if (before) {
      assertUserInManagementScope(before, actorScope);
      if (!isSuperadminSession(session)) {
        assertCanControlTargetCredentials(database, session, before, allRoles);
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
      database,
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
    const actorScope = managementScopeForPermission(
      session,
      "users.reset_password",
    );
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
      assertCanControlTargetCredentials(database, session, targetUser, allRoles);
    }

    const result = accessService.resetPassword(params);
    auditService.record(
      authenticationService.requireSession(),
      "access.password.reset",
      "users",
      params.userId,
      null,
      null,
      {
        enterpriseId: targetUser.enterpriseId ?? null,
        departmentId: targetUser.departmentId ?? null,
      },
    );
    return result;
  });

  ipcMain.handle("access:deleteUser", (event, raw: unknown) => {
    assertTrustedSender(event);
    const session = authorizationService.requirePermission("users.delete");
    const actorScope = managementScopeForPermission(session, "users.delete");
    const id = ipcValidation.id(raw);
    const allRoles = accessService.listRoles();
    const before = accessService.listUsers().find((user) => user.id === id);
    if (!before) throw new Error("Пользователь не найден");
    assertUserInManagementScope(before, actorScope);
    if (session.employeeId > 0 && before.id === session.userId) {
      throw new Error("Нельзя удалить собственную учётную запись");
    }
    if (!isSuperadminSession(session)) {
      assertCanControlTargetCredentials(database, session, before, allRoles);
    }

    const result = accessService.deleteUser(id);
    auditService.record(
      authenticationService.requireSession(),
      "access.user.delete",
      "users",
      id,
      before as unknown as HrRecord,
      null,
      {
        enterpriseId: before.enterpriseId ?? null,
        departmentId: before.departmentId ?? null,
      },
    );
    return result;
  });
}

function managementScopeForPermission(
  session: AuthSession,
  permissionCode: string,
): AccessRoleWriteScope {
  const scopeType = session.permissionScopes[permissionCode];
  if (!scopeType) {
    throw new Error("Недостаточно прав для выполнения действия");
  }
  return managementScopeFromSession({ ...session, scopeType });
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

function resolveCreateRoleScope(
  database: AccessDatabase,
  session: AuthSession,
  actorScope: AccessRoleWriteScope,
  params: SaveAccessRoleParams,
): AccessRoleWriteScope {
  const requestedScopeType = params.scopeType ?? actorScope.scopeType;
  if (
    accessScopeRank[requestedScopeType] > accessScopeRank[actorScope.scopeType]
  ) {
    throw new Error("Нельзя создать роль шире доступной области администрирования");
  }

  if (requestedScopeType === "global") {
    if (actorScope.scopeType !== "global") {
      throw new Error("Глобальную роль может создавать только глобальный администратор");
    }
    if (params.enterpriseId || params.departmentId) {
      throw new Error("Глобальная роль не должна быть привязана к оргструктуре");
    }
    return { scopeType: "global", enterpriseId: null, departmentId: null };
  }

  if (requestedScopeType === "enterprise") {
    const enterpriseId =
      params.enterpriseId ??
      (actorScope.scopeType === "enterprise" ? actorScope.enterpriseId : null);
    if (!enterpriseId) throw new Error("Выберите предприятие для роли");
    if (params.departmentId) {
      throw new Error("Роль предприятия не должна быть привязана к отделу");
    }
    const enterprise = database
      .prepare("SELECT id, is_archived FROM enterprises WHERE id = ? LIMIT 1")
      .get(enterpriseId) as { id: number; is_archived: number } | undefined;
    if (!enterprise || enterprise.is_archived === 1) {
      throw new Error("Выбранное предприятие не найдено или находится в архиве");
    }
    if (
      actorScope.scopeType === "enterprise" &&
      enterpriseId !== actorScope.enterpriseId
    ) {
      throw new Error("Нельзя создать роль для другого предприятия");
    }
    return { scopeType: "enterprise", enterpriseId, departmentId: null };
  }

  const departmentId =
    params.departmentId ??
    (actorScope.scopeType === "department" ? actorScope.departmentId : null);
  if (!departmentId) throw new Error("Выберите отдел для роли");
  const department = database
    .prepare(
      `SELECT id, enterprise_id AS enterpriseId, is_archived
       FROM departments WHERE id = ? LIMIT 1`,
    )
    .get(departmentId) as
    | { id: number; enterpriseId: number; is_archived: number }
    | undefined;
  if (!department || department.is_archived === 1) {
    throw new Error("Выбранный отдел не найден или находится в архиве");
  }
  if (params.enterpriseId && params.enterpriseId !== department.enterpriseId) {
    throw new Error("Выбранный отдел не принадлежит указанному предприятию");
  }
  if (
    actorScope.scopeType === "enterprise" &&
    department.enterpriseId !== actorScope.enterpriseId
  ) {
    throw new Error("Нельзя создать роль для отдела другого предприятия");
  }
  if (
    actorScope.scopeType === "department" &&
    departmentId !== actorScope.departmentId
  ) {
    throw new Error("Нельзя создать роль для другого отдела");
  }
  return { scopeType: "department", enterpriseId: null, departmentId };
}

function assertRequestedScopeMatchesExistingRole(
  params: SaveAccessRoleParams,
  role: AccessRoleSummary,
): void {
  if (params.scopeType && params.scopeType !== role.scopeType) {
    throw new Error("Область действия существующей роли нельзя изменить");
  }
  if (
    params.enterpriseId !== undefined &&
    params.enterpriseId !== role.enterpriseId
  ) {
    throw new Error("Предприятие существующей роли нельзя изменить");
  }
  if (
    params.departmentId !== undefined &&
    params.departmentId !== role.departmentId
  ) {
    throw new Error("Отдел существующей роли нельзя изменить");
  }
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
  database: AccessDatabase,
  session: AuthSession,
  permissionCodes: string[],
  targetScope: AccessRoleWriteScope,
): void {
  const normalized = normalizePermissionDependencies(permissionCodes).filter(
    (code) => !legacyPermissionCodes.has(code),
  );

  if (isSuperadminSession(session)) {
    const incompatible = normalized.find(
      (code) => !canScopePermissionTo(code, targetScope.scopeType),
    );
    if (incompatible) {
      throw new Error(
        "Выбранное разрешение нельзя включить в роль этой области данных",
      );
    }
    return;
  }

  const forbidden = normalized.filter((code) => {
    const actorPermissionScope = session.permissionScopes[code];
    if (!actorPermissionScope) return true;
    if (!canScopePermissionTo(code, targetScope.scopeType)) return true;
    if (accessScopeRank[actorPermissionScope] < accessScopeRank[targetScope.scopeType]) {
      return true;
    }
    return !permissionScopeContainsTarget(
      database,
      session,
      actorPermissionScope,
      targetScope,
    );
  });

  if (forbidden.length > 0) {
    throw new Error(
      "Нельзя выдать роли разрешения шире текущей области администрирования",
    );
  }
}

function permissionScopeContainsTarget(
  database: AccessDatabase,
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
    if (targetScope.scopeType === "department" && targetScope.departmentId) {
      const row = database
        .prepare("SELECT enterprise_id AS enterpriseId FROM departments WHERE id = ?")
        .get(targetScope.departmentId) as { enterpriseId: number } | undefined;
      return row?.enterpriseId === session.enterpriseId;
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
  database: AccessDatabase,
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
    assertRoleCanBeAssigned(database, session, role, employeeScope);
  }
}

function assertCanControlTargetCredentials(
  database: AccessDatabase,
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
      assertCanDelegatePermissionCodes(
        database,
        session,
        role.permissionCodes,
        targetScope,
      );
    } catch {
      throw new Error(
        "Нельзя управлять более привилегированной учётной записью",
      );
    }
  }
}

function assertRoleCanBeAssigned(
  database: AccessDatabase,
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
    database,
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
