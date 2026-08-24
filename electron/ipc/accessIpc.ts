import { ipcMain, type IpcMainInvokeEvent } from "electron";
import {
  legacyPermissionCodes,
  normalizePermissionDependencies,
} from "../../src/shared/access/permissionRules";
import type {
  AccessRoleSummary,
  AuthSession,
} from "../../src/shared/types/access";
import type { HrRecord } from "../../src/shared/types/hr";
import { getDatabase } from "../database/connection";
import { AccessControlRepository } from "../repositories/accessControlRepository";
import { AccessControlService } from "../services/accessControlService";
import { AuditService } from "../services/auditService";
import {
  getActiveAuthenticationService,
} from "../services/authenticationService";
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

export function registerAccessIpcHandlers(): void {
  const database = getDatabase();
  const accessService = new AccessControlService(
    new AccessControlRepository(database),
  );
  const authenticationService = getActiveAuthenticationService();
  const authorizationService = new AuthorizationService(
    database,
    authenticationService,
  );
  const auditService = new AuditService(database);

  for (const channel of legacyAccessChannels) ipcMain.removeHandler(channel);

  ipcMain.handle("access:listPermissions", (event) => {
    assertTrustedSender(event);
    authorizationService.requireGlobalPermission("roles.view");
    return accessService.listPermissions();
  });

  ipcMain.handle("access:listRoles", (event) => {
    assertTrustedSender(event);
    authorizationService.requireAnyGlobalPermission(["roles.view", "users.view"]);
    return accessService.listRoles();
  });

  ipcMain.handle("access:listUsers", (event) => {
    assertTrustedSender(event);
    authorizationService.requireGlobalPermission("users.view");
    return accessService.listUsers();
  });

  ipcMain.handle("access:getSystemAdmin", (event) => {
    assertTrustedSender(event);
    authorizationService.requireGlobalPermission("users.view");
    return accessService.getSystemAdmin();
  });

  ipcMain.handle("access:saveRole", (event, raw: unknown) => {
    assertTrustedSender(event);
    const params = ipcValidation.saveRole(raw);
    const session = authorizationService.requireGlobalPermission(
      params.id ? "roles.edit" : "roles.create",
    );

    if (params.permissionCodes.some((code) => legacyPermissionCodes.has(code))) {
      throw new Error("Устаревшие разрешения нельзя назначать новым ролям");
    }
    assertCanDelegatePermissionCodes(session, params.permissionCodes);

    const before = params.id
      ? accessService.listRoles().find((role) => role.id === params.id)
      : null;
    if (before && !isSuperadminSession(session)) {
      assertCanDelegatePermissionCodes(session, before.permissionCodes);
    }

    const saved = accessService.saveRole(params);
    auditService.record(
      authenticationService.requireSession(),
      params.id ? "access.role.update" : "access.role.create",
      "roles",
      saved.id,
      before ? (before as unknown as HrRecord) : null,
      saved as unknown as HrRecord,
    );
    return saved;
  });

  ipcMain.handle("access:deleteRole", (event, raw: unknown) => {
    assertTrustedSender(event);
    authorizationService.requireGlobalPermission("roles.delete");
    const id = ipcValidation.id(raw);
    const before = accessService.listRoles().find((role) => role.id === id);
    const result = accessService.deleteRole(id);
    auditService.record(
      authenticationService.requireSession(),
      "access.role.delete",
      "roles",
      id,
      before ? (before as unknown as HrRecord) : null,
    );
    return result;
  });

  ipcMain.handle("access:saveUser", (event, raw: unknown) => {
    assertTrustedSender(event);
    const params = ipcValidation.saveUser(raw);
    const session = authorizationService.requireGlobalPermission(
      params.id ? "users.edit" : "users.create",
    );
    const roles = accessService.listRoles();
    assertCanAssignRequestedRoles(session, params.roleIds, roles);

    const before = params.id
      ? accessService.listUsers().find((user) => user.id === params.id)
      : null;
    const saved = accessService.saveUser(params);
    auditService.record(
      authenticationService.requireSession(),
      params.id ? "access.user.update" : "access.user.create",
      "users",
      saved.id,
      before ? (before as unknown as HrRecord) : null,
      saved as unknown as HrRecord,
    );
    return saved;
  });

  ipcMain.handle("access:resetPassword", (event, raw: unknown) => {
    assertTrustedSender(event);
    authorizationService.requireGlobalPermission("users.reset_password");
    const params = ipcValidation.resetPassword(raw);
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
    authorizationService.requireGlobalPermission("users.delete");
    const id = ipcValidation.id(raw);
    const before = accessService.listUsers().find((user) => user.id === id);
    const result = accessService.deleteUser(id);
    auditService.record(
      authenticationService.requireSession(),
      "access.user.delete",
      "users",
      id,
      before ? (before as unknown as HrRecord) : null,
    );
    return result;
  });
}

function assertCanDelegatePermissionCodes(
  session: AuthSession,
  permissionCodes: string[],
): void {
  if (isSuperadminSession(session)) return;

  const normalized = normalizePermissionDependencies(permissionCodes).filter(
    (code) => !legacyPermissionCodes.has(code),
  );
  const forbidden = normalized.filter(
    (code) => session.permissionScopes[code] !== "global",
  );

  if (forbidden.length > 0) {
    throw new Error(
      "Нельзя выдать роли разрешения, которыми текущий администратор не обладает глобально",
    );
  }
}

function assertCanAssignRequestedRoles(
  session: AuthSession,
  requestedRoleIds: number[],
  roles: AccessRoleSummary[],
): void {
  const roleMap = new Map(roles.map((role) => [role.id, role]));
  const requestedRoles = [...new Set(requestedRoleIds)].map((id) => roleMap.get(id));
  if (requestedRoles.some((role) => !role)) {
    throw new Error("Одна из выбранных ролей не найдена");
  }

  for (const role of requestedRoles as AccessRoleSummary[]) {
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
    if (role.systemKey === "employee") continue;
    assertCanDelegatePermissionCodes(session, role.permissionCodes);
  }
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
