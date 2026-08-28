import { ipcMain, type IpcMainInvokeEvent } from "electron";
import type { AuthSession } from "../../src/shared/types/access";
import type {
  AddEmployeeDocumentParams,
  ApplyEmployeeImportParams,
  DeleteEmployeeDocumentParams,
  ExportDataParams,
  HrLeadershipChangeParams,
  PreviewEmployeeImportParams,
} from "../../src/shared/types/hr";
import { getDatabase } from "../database/connection";
import { AuditService } from "../services/auditService";
import { getActiveAuthenticationService } from "../services/authenticationService";
import { AuthorizationService } from "../services/authorizationService";
import { EmployeeImportService } from "../services/employeeImportService";
import { HrAnalyticsService } from "../services/hrAnalyticsService";
import { HrCoreExpansionService } from "../services/hrCoreExpansionService";

const scopeRank: Record<AuthSession["scopeType"], number> = {
  self: 0,
  department: 1,
  enterprise: 2,
  global: 3,
};

export function registerHrCoreExpansionIpcHandlers(): void {
  const database = getDatabase();
  const authenticationService = getActiveAuthenticationService();
  const authorizationService = new AuthorizationService(database, authenticationService);
  const auditService = new AuditService(database);
  const service = new HrCoreExpansionService(database);
  const employeeImportService = new EmployeeImportService(database);
  const analyticsService = new HrAnalyticsService(database);

  ipcMain.handle("hr:changeLeadership", (event, raw: unknown) => {
    assertTrustedSender(event);
    const params = raw as HrLeadershipChangeParams;
    const organizationSession = authorizationService.requirePermission("organization.assign_leader");
    const employmentSession = authorizationService.requirePermission("employees.change_employment");
    const session = narrowerSession(organizationSession, employmentSession);
    const result = service.changeLeadership(params, session);
    auditService.record(
      authenticationService.requireSession(),
      "leadership.change",
      params.targetType === "enterprise" ? "enterprises" : "departments",
      params.targetId,
      null,
      null,
      {
        targetType: params.targetType,
        targetId: params.targetId,
        newLeaderEmployeeId: params.newLeaderEmployeeId,
        previousLeaderOutcome: params.previousLeaderOutcome,
        effectiveAt: params.effectiveAt,
        reason: params.reason,
      },
    );
    return result;
  });

  ipcMain.handle("documents:list", (event, raw: unknown) => {
    assertTrustedSender(event);
    const session = authorizationService.requirePermission("documents.view");
    const employeeId = optionalPositiveNumber(raw);
    return service.listEmployeeDocuments(employeeId ?? undefined, session);
  });

  ipcMain.handle("documents:add", (event, raw: unknown) => {
    assertTrustedSender(event);
    const session = authorizationService.requirePermission("documents.add");
    const params = raw as AddEmployeeDocumentParams;
    const document = service.addEmployeeDocument(params, session);
    if (document) {
      auditService.record(
        authenticationService.requireSession(),
        "document.add",
        "employees",
        document.employeeId,
        null,
        null,
        { documentId: document.id, title: document.title, sha256: document.sha256 },
      );
    }
    return document;
  });

  ipcMain.handle("documents:open", (event, raw: unknown) => {
    assertTrustedSender(event);
    const session = authorizationService.requirePermission("documents.view");
    const id = requirePositiveNumber(raw, "Документ не выбран");
    const result = service.openEmployeeDocument(id, session);
    auditService.record(
      authenticationService.requireSession(),
      "document.view",
      "employee_documents",
      id,
    );
    return result;
  });

  ipcMain.handle("documents:delete", (event, raw: unknown) => {
    assertTrustedSender(event);
    const session = authorizationService.requirePermission("documents.delete");
    const params = raw as DeleteEmployeeDocumentParams;
    const result = service.deleteEmployeeDocument(params.id, params.reason, session);
    auditService.record(
      authenticationService.requireSession(),
      "document.delete",
      "employee_documents",
      params.id,
      null,
      null,
      { reason: params.reason },
    );
    return result;
  });

  ipcMain.handle("attention:list", (event) => {
    assertTrustedSender(event);
    const session = authorizationService.requirePermission("attention.view");
    return service.listAttentionItems(session);
  });

  ipcMain.handle("analytics:get", (event) => {
    assertTrustedSender(event);
    const session = authorizationService.requirePermission("analytics.view");
    return analyticsService.getReport(session);
  });

  ipcMain.handle("dataExchange:selectEmployeeImport", (event) => {
    assertTrustedSender(event);
    authorizationService.requirePermission("data_exchange.import");
    return employeeImportService.selectFile();
  });

  ipcMain.handle("dataExchange:previewEmployeeImport", (event, raw: unknown) => {
    assertTrustedSender(event);
    const session = authorizationService.requirePermission("data_exchange.import");
    return employeeImportService.preview(
      raw as PreviewEmployeeImportParams,
      session,
    );
  });

  ipcMain.handle("dataExchange:applyEmployeeImport", (event, raw: unknown) => {
    assertTrustedSender(event);
    const session = authorizationService.requirePermission("data_exchange.import");
    const params = raw as ApplyEmployeeImportParams;
    const result = employeeImportService.apply(params, session);
    if (!params.dryRun) {
      auditService.record(
        authenticationService.requireSession(),
        "data.import.employees",
        "employees",
        null,
        null,
        null,
        {
          totalRows: result.totalRows,
          importedRows: result.importedRows,
          skippedRows: result.skippedRows,
          enterpriseId: session.enterpriseId,
          departmentId: session.departmentId,
        },
      );
    }
    return result;
  });

  ipcMain.handle("dataExchange:export", (event, raw: unknown) => {
    assertTrustedSender(event);
    const session = authorizationService.requirePermission("data_exchange.export");
    const params = raw as ExportDataParams;
    const result = service.exportData(params, session);
    if (!result.canceled) {
      auditService.record(
        authenticationService.requireSession(),
        "data.export",
        params.domain,
        null,
        null,
        null,
        {
          format: params.format,
          enterpriseId: session.enterpriseId,
          departmentId: session.departmentId,
        },
      );
    }
    return result;
  });
}

function narrowerSession(first: AuthSession, second: AuthSession): AuthSession {
  return scopeRank[first.scopeType] <= scopeRank[second.scopeType] ? first : second;
}

function requirePositiveNumber(value: unknown, message: string): number {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) throw new Error(message);
  return number;
}

function optionalPositiveNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  return requirePositiveNumber(value, "Некорректный идентификатор сотрудника");
}

function assertTrustedSender(event: IpcMainInvokeEvent): void {
  const url = event.senderFrame?.url ?? "";
  const devServer = process.env.VITE_DEV_SERVER_URL;
  if (url.startsWith("file://")) return;
  if (devServer && url.startsWith(devServer)) return;
  throw new Error("Недоверенный источник IPC-запроса");
}
