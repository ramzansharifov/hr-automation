import { ipcMain, type IpcMainInvokeEvent } from "electron";
import type {
  ApplyEmployeeImportParams,
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
import { HrAttentionService } from "../services/hrAttentionService";
import { HrDataExportService } from "../services/hrDataExportService";
import { HrLeadershipService } from "../services/hrLeadershipService";

export function registerHrCoreExpansionIpcHandlers(): void {
  const database = getDatabase();
  const authenticationService = getActiveAuthenticationService();
  const authorizationService = new AuthorizationService(database, authenticationService);
  const auditService = new AuditService(database);
  const leadershipService = new HrLeadershipService(database);
  const attentionService = new HrAttentionService(database);
  const employeeImportService = new EmployeeImportService(database);
  const analyticsService = new HrAnalyticsService(database);
  const exportService = new HrDataExportService(database);

  ipcMain.handle("hr:changeLeadership", (event, raw: unknown) => {
    assertTrustedSender(event);
    const params = raw as HrLeadershipChangeParams;
    const session = authorizationService.requirePermission(
      params.targetType === "enterprise"
        ? "enterprises.assign_leader"
        : "departments.assign_leader",
    );
    const result = leadershipService.change(params, session);
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

  ipcMain.handle("attention:list", (event) => {
    assertTrustedSender(event);
    const session = authorizationService.requirePermission("attention.view");
    return attentionService.list(session);
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
    const result = exportService.export(params, session);
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

function assertTrustedSender(event: IpcMainInvokeEvent): void {
  const url = event.senderFrame?.url ?? "";
  const devServer = process.env.VITE_DEV_SERVER_URL;
  if (url.startsWith("file://")) return;
  if (devServer && url.startsWith(devServer)) return;
  throw new Error("Недоверенный источник IPC-запроса");
}
