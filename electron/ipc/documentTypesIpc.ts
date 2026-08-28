import { ipcMain, type IpcMainInvokeEvent } from "electron";
import type { SaveDocumentTypeParams } from "../../src/shared/types/documentTypes";
import { getDatabase } from "../database/connection";
import { AuditService } from "../services/auditService";
import { getActiveAuthenticationService } from "../services/authenticationService";
import { AuthorizationService } from "../services/authorizationService";
import { DocumentTypeService } from "../services/documentTypeService";

export function registerDocumentTypesIpcHandlers(): void {
  const database = getDatabase();
  const authenticationService = getActiveAuthenticationService();
  const authorizationService = new AuthorizationService(database, authenticationService);
  const auditService = new AuditService(database);
  const service = new DocumentTypeService(database);

  ipcMain.handle("documentTypes:list", (event) => {
    assertTrustedSender(event);
    const session = authorizationService.requirePermission("document_types.view");
    return service.list(session);
  });

  ipcMain.handle("documentTypes:save", (event, raw: unknown) => {
    assertTrustedSender(event);
    const params = parseSaveParams(raw);
    const permission = params.id ? "document_types.edit" : "document_types.create";
    const session = authorizationService.requirePermission(permission);
    const saved = service.save(params, session);
    auditService.record(
      authenticationService.requireSession(),
      params.id ? "document_type.update" : "document_type.create",
      "document_types",
      saved.id,
      null,
      {
        id: saved.id,
        enterprise_id: saved.enterpriseId,
        name: saved.name,
        is_active: saved.isActive ? 1 : 0,
      },
    );
    return saved;
  });

  ipcMain.handle("documentTypes:delete", (event, raw: unknown) => {
    assertTrustedSender(event);
    const id = positiveId(raw);
    const session = authorizationService.requirePermission("document_types.delete");
    const result = service.delete(id, session);
    auditService.record(
      authenticationService.requireSession(),
      "document_type.delete",
      "document_types",
      id,
    );
    return result;
  });
}

function parseSaveParams(raw: unknown): SaveDocumentTypeParams {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Некорректные данные типа документа");
  }
  const value = raw as Record<string, unknown>;
  const id = value.id === undefined ? undefined : positiveId(value.id);
  const enterpriseId =
    value.enterpriseId === undefined || value.enterpriseId === null
      ? undefined
      : positiveId(value.enterpriseId);
  const name = String(value.name ?? "").trim();
  if (!name) throw new Error("Укажите название типа документа");
  if (name.length > 200) throw new Error("Название типа документа слишком длинное");
  return {
    id,
    enterpriseId,
    name,
    isActive: value.isActive !== false,
  };
}

function positiveId(value: unknown): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) throw new Error("Некорректный идентификатор");
  return id;
}

function assertTrustedSender(event: IpcMainInvokeEvent): void {
  const url = event.senderFrame?.url ?? "";
  if (url.startsWith("file://")) return;
  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl && url.startsWith(devServerUrl)) return;
  throw new Error("Недоверенный источник IPC-запроса");
}
