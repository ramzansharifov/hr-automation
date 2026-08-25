import { ipcMain, type IpcMainInvokeEvent } from "electron";
import type { AuthSession } from "../../src/shared/types/access";
import type { AuditListParams, HrRecord } from "../../src/shared/types/hr";
import { getDatabase } from "../database/connection";
import { HrCrudRepository } from "../repositories/hrCrudRepository";
import { AdminDataService } from "../services/adminDataService";
import { AuditService } from "../services/auditService";
import { getActiveAuthenticationService } from "../services/authenticationService";
import { AuthorizationService } from "../services/authorizationService";
import { HrCrudService } from "../services/hrCrudService";
import { ipcValidation } from "./ipcValidation";

const vacationTypeChannels = [
  "tenant:vacationTypes:list",
  "tenant:vacationTypes:getById",
  "tenant:vacationTypes:create",
  "tenant:vacationTypes:update",
  "tenant:vacationTypes:delete",
];

export function registerEnterpriseTenantIpcHandlers(): void {
  const database = getDatabase();
  const hrService = new HrCrudService(new HrCrudRepository(database));
  const authenticationService = getActiveAuthenticationService();
  const authorizationService = new AuthorizationService(
    database,
    authenticationService,
  );
  const auditService = new AuditService(database);
  const adminDataService = new AdminDataService(database);

  for (const channel of vacationTypeChannels) ipcMain.removeHandler(channel);

  ipcMain.handle("tenant:vacationTypes:list", (event, raw: unknown) => {
    assertTrustedSender(event);
    const params = ipcValidation.list(raw);
    assertVacationTypeEntity(params.entity);
    const session = authorizationService.requirePermission("vacation_types.view");
    const enterpriseId = tenantEnterpriseId(session, "vacation_types.view");
    return hrService.list({
      ...params,
      filters:
        enterpriseId === null
          ? params.filters
          : {
              ...(params.filters ?? {}),
              enterprise_id: { operator: "equals", value: enterpriseId },
            },
    });
  });

  ipcMain.handle("tenant:vacationTypes:getById", (event, raw: unknown) => {
    assertTrustedSender(event);
    const params = ipcValidation.getById(raw);
    assertVacationTypeEntity(params.entity);
    const session = authorizationService.requirePermission("vacation_types.view");
    const record = hrService.getById(params);
    if (record) assertVacationTypeInScope(record, session, "vacation_types.view");
    return record;
  });

  ipcMain.handle("tenant:vacationTypes:create", (event, raw: unknown) => {
    assertTrustedSender(event);
    const params = ipcValidation.create(raw);
    assertVacationTypeEntity(params.entity);
    const session = authorizationService.requirePermission("vacation_types.create");
    const enterpriseId = resolveVacationTypeWriteEnterprise(
      session,
      "vacation_types.create",
      params.data,
    );
    const created = hrService.create({
      ...params,
      data: { ...params.data, enterprise_id: enterpriseId },
    });
    auditService.record(
      authenticationService.requireSession(),
      "create",
      "vacation_types",
      Number(created.id) || null,
      null,
      created,
    );
    return created;
  });

  ipcMain.handle("tenant:vacationTypes:update", (event, raw: unknown) => {
    assertTrustedSender(event);
    const params = ipcValidation.update(raw);
    assertVacationTypeEntity(params.entity);
    const session = authorizationService.requirePermission("vacation_types.edit");
    const existing = hrService.getById({ entity: "vacation_types", id: params.id });
    if (!existing) throw new Error("Вид отпуска не найден");
    assertVacationTypeInScope(existing, session, "vacation_types.edit");
    const enterpriseId = positiveNumber(existing.enterprise_id);
    if (!enterpriseId) {
      throw new Error("Исторический вид отпуска без предприятия нельзя изменять");
    }
    const requestedEnterpriseId = positiveNumber(params.data.enterprise_id);
    if (requestedEnterpriseId && requestedEnterpriseId !== enterpriseId) {
      throw new Error("Нельзя перенести вид отпуска в другое предприятие");
    }
    const updated = hrService.update({
      ...params,
      data: { ...params.data, enterprise_id: enterpriseId },
    });
    auditService.record(
      authenticationService.requireSession(),
      "update",
      "vacation_types",
      params.id,
      existing,
      updated,
    );
    return updated;
  });

  ipcMain.handle("tenant:vacationTypes:delete", (event, raw: unknown) => {
    assertTrustedSender(event);
    const params = ipcValidation.remove(raw);
    assertVacationTypeEntity(params.entity);
    const session = authorizationService.requirePermission("vacation_types.delete");
    const existing = hrService.getById({ entity: "vacation_types", id: params.id });
    if (!existing) throw new Error("Вид отпуска не найден");
    assertVacationTypeInScope(existing, session, "vacation_types.delete");
    const result = hrService.delete(params);
    auditService.record(
      authenticationService.requireSession(),
      "delete",
      "vacation_types",
      params.id,
      existing,
    );
    return result;
  });

  // hrCrudIpc registers global handlers first. Replace the journal and employee
  // export after common HR handlers so scoped administrators use the same APIs
  // with mandatory tenant filtering on the backend.
  ipcMain.removeHandler("audit:list");
  ipcMain.handle("audit:list", (event, raw: unknown) => {
    assertTrustedSender(event);
    const session = authorizationService.requirePermission("audit.view");
    const permissionScope = session.permissionScopes["audit.view"];
    if (!permissionScope) throw new Error("Недостаточно прав для просмотра журнала");
    return auditService.list(parseAuditListParams(raw), {
      scopeType: permissionScope,
      enterpriseId: session.enterpriseId,
      departmentId: session.departmentId,
    });
  });

  ipcMain.removeHandler("admin:exportEmployeesCsv");
  ipcMain.handle("admin:exportEmployeesCsv", (event) => {
    assertTrustedSender(event);
    const session = authorizationService.requirePermission("employees.export");
    const permissionScope = session.permissionScopes["employees.export"];
    if (!permissionScope || permissionScope === "self") {
      throw new Error("Недостаточно прав для экспорта сотрудников");
    }
    const result = adminDataService.exportEmployeesCsv({
      scopeType: permissionScope,
      enterpriseId: session.enterpriseId,
      departmentId: session.departmentId,
    });
    if (!result.canceled) {
      auditService.record(
        session,
        "export.employees_csv",
        "employees",
        null,
        null,
        null,
        {
          scopeType: permissionScope,
          enterpriseId: session.enterpriseId,
          departmentId: session.departmentId,
        },
      );
    }
    return result;
  });
}

function assertVacationTypeEntity(entity: string): void {
  if (entity !== "vacation_types") {
    throw new Error("Недопустимая сущность для tenant-канала");
  }
}

function tenantEnterpriseId(
  session: AuthSession,
  permissionCode: string,
): number | null {
  const scope = session.permissionScopes[permissionCode];
  if (scope === "global") return null;
  if (scope !== "enterprise" && scope !== "department") {
    throw new Error("Виды отпусков недоступны в личной области данных");
  }
  if (!session.enterpriseId) {
    throw new Error("Для текущего пользователя не определено предприятие");
  }
  return session.enterpriseId;
}

function resolveVacationTypeWriteEnterprise(
  session: AuthSession,
  permissionCode: string,
  data: HrRecord,
): number {
  const scope = session.permissionScopes[permissionCode];
  if (scope === "global") {
    const enterpriseId = positiveNumber(data.enterprise_id);
    if (!enterpriseId) throw new Error("Выберите предприятие для вида отпуска");
    return enterpriseId;
  }
  if (scope !== "enterprise") {
    throw new Error("Изменять виды отпусков можно только на уровне предприятия");
  }
  if (!session.enterpriseId) {
    throw new Error("Для текущего пользователя не определено предприятие");
  }
  return session.enterpriseId;
}

function assertVacationTypeInScope(
  record: HrRecord,
  session: AuthSession,
  permissionCode: string,
): void {
  const scope = session.permissionScopes[permissionCode];
  if (scope === "global") return;
  if (scope !== "enterprise" && scope !== "department") {
    throw new Error("Вид отпуска находится вне доступной области данных");
  }
  const enterpriseId = positiveNumber(record.enterprise_id);
  if (!enterpriseId || enterpriseId !== session.enterpriseId) {
    throw new Error("Вид отпуска принадлежит другому предприятию");
  }
}

function parseAuditListParams(raw: unknown): AuditListParams {
  if (raw === undefined || raw === null) return {};
  if (typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Некорректные параметры журнала действий");
  }
  const value = raw as Record<string, unknown>;
  const search = value.search;
  const limit = value.limit;
  if (search !== undefined && typeof search !== "string") {
    throw new Error("Некорректный поисковый запрос журнала");
  }
  if (typeof search === "string" && search.length > 500) {
    throw new Error("Поисковый запрос слишком длинный");
  }
  if (
    limit !== undefined &&
    (typeof limit !== "number" || !Number.isInteger(limit) || limit < 1 || limit > 500)
  ) {
    throw new Error("Некорректный лимит журнала действий");
  }
  return {
    search: typeof search === "string" ? search : undefined,
    limit: typeof limit === "number" ? limit : undefined,
  };
}

function positiveNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function assertTrustedSender(event: IpcMainInvokeEvent): void {
  const url = event.senderFrame?.url ?? "";
  const devServer = process.env.VITE_DEV_SERVER_URL;
  if (url.startsWith("file://")) return;
  if (devServer && url.startsWith(devServer)) return;
  throw new Error("Недоверенный источник IPC-запроса");
}
