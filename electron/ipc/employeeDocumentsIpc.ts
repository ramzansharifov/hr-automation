import { ipcMain, type IpcMainInvokeEvent } from "electron";
import type {
  AddEmployeeDocumentParams,
  DeleteEmployeeDocumentParams,
} from "../../src/shared/types/hr";
import { getDatabase } from "../database/connection";
import { AuditService } from "../services/auditService";
import { getActiveAuthenticationService } from "../services/authenticationService";
import { AuthorizationService } from "../services/authorizationService";
import { EmployeeDocumentService } from "../services/employeeDocumentService";

const employeeDocumentChannels = [
  "documents:list",
  "documents:listTypesForEmployee",
  "documents:add",
  "documents:open",
  "documents:delete",
];

export function registerEmployeeDocumentsIpcHandlers(): void {
  const database = getDatabase();
  const authenticationService = getActiveAuthenticationService();
  const authorizationService = new AuthorizationService(database, authenticationService);
  const auditService = new AuditService(database);
  const service = new EmployeeDocumentService(database);

  for (const channel of employeeDocumentChannels) ipcMain.removeHandler(channel);

  ipcMain.handle("documents:list", (event, raw: unknown) => {
    assertTrustedSender(event);
    const session = authorizationService.requirePermission("documents.view");
    return service.list(positiveId(raw, "Сотрудник не выбран"), session);
  });

  ipcMain.handle("documents:listTypesForEmployee", (event, raw: unknown) => {
    assertTrustedSender(event);
    const session = authorizationService.requirePermission("documents.add");
    return service.listTypesForEmployee(
      positiveId(raw, "Сотрудник не выбран"),
      session,
    );
  });

  ipcMain.handle("documents:add", (event, raw: unknown) => {
    assertTrustedSender(event);
    const session = authorizationService.requirePermission("documents.add");
    const params = parseAddParams(raw);
    const document = service.add(params, session);
    if (document) {
      auditService.record(
        authenticationService.requireSession(),
        "document.add",
        "employees",
        document.employeeId,
        null,
        null,
        {
          documentId: document.id,
          documentType: document.documentType,
          title: document.title,
          sha256: document.sha256,
        },
      );
    }
    return document;
  });

  ipcMain.handle("documents:open", (event, raw: unknown) => {
    assertTrustedSender(event);
    const session = authorizationService.requirePermission("documents.view");
    const id = positiveId(raw, "Документ не выбран");
    const result = service.open(id, session);
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
    const params = parseDeleteParams(raw);
    const result = service.delete(params.id, params.reason, session);
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
}

function parseAddParams(raw: unknown): AddEmployeeDocumentParams {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Некорректные данные документа");
  }
  const value = raw as Record<string, unknown>;
  const documentType = String(value.documentType ?? "").trim();
  const title = String(value.title ?? "").trim();
  if (!documentType) throw new Error("Выберите тип документа");
  if (!title) throw new Error("Укажите название документа");
  if (documentType.length > 200 || title.length > 500) {
    throw new Error("Название документа или его типа слишком длинное");
  }
  return {
    employeeId: positiveId(value.employeeId, "Сотрудник не выбран"),
    employmentHistoryId:
      value.employmentHistoryId === null || value.employmentHistoryId === undefined
        ? null
        : positiveId(value.employmentHistoryId, "Некорректное кадровое событие"),
    documentType,
    title,
    issuedAt: optionalDate(value.issuedAt, "Некорректная дата выдачи документа"),
    expiresAt: optionalDate(value.expiresAt, "Некорректный срок действия документа"),
  };
}

function parseDeleteParams(raw: unknown): DeleteEmployeeDocumentParams {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Некорректные данные удаления документа");
  }
  const value = raw as Record<string, unknown>;
  const reason = String(value.reason ?? "").trim();
  if (!reason) throw new Error("Укажите основание удаления документа");
  if (reason.length > 2000) throw new Error("Основание удаления слишком длинное");
  return {
    id: positiveId(value.id, "Документ не выбран"),
    reason,
  };
}

function optionalDate(value: unknown, message: string): string | null {
  if (value === null || value === undefined || value === "") return null;
  const date = String(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(message);
  return date;
}

function positiveId(value: unknown, message: string): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) throw new Error(message);
  return id;
}

function assertTrustedSender(event: IpcMainInvokeEvent): void {
  const url = event.senderFrame?.url ?? "";
  if (url.startsWith("file://")) return;
  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl && url.startsWith(devServerUrl)) return;
  throw new Error("Недоверенный источник IPC-запроса");
}
