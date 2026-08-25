import { ipcMain, type IpcMainInvokeEvent } from "electron";
import type { BusinessContextSelection } from "../../src/shared/types/access";
import { getActiveAuthenticationService } from "../services/authenticationService";
import {
  getBusinessContextState,
  setBusinessContext,
} from "../services/businessContextService";

export function registerBusinessContextIpcHandlers(): void {
  ipcMain.handle("auth:businessContext", (event) => {
    assertTrustedSender(event);
    const session = getActiveAuthenticationService().requireSession();
    return getBusinessContextState(session);
  });

  ipcMain.handle("auth:setBusinessContext", (event, raw: unknown) => {
    assertTrustedSender(event);
    const session = getActiveAuthenticationService().requireSession();
    return setBusinessContext(session, normalizeSelection(raw));
  });
}

function normalizeSelection(raw: unknown): BusinessContextSelection {
  const value = (raw ?? {}) as Record<string, unknown>;
  return {
    enterpriseId: normalizeOptionalId(value.enterpriseId),
    departmentId: normalizeOptionalId(value.departmentId),
  };
}

function normalizeOptionalId(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const normalized = Number(value);
  if (!Number.isInteger(normalized) || normalized <= 0) {
    throw new Error("Некорректный идентификатор рабочего контекста");
  }
  return normalized;
}

function assertTrustedSender(event: IpcMainInvokeEvent): void {
  const url = event.senderFrame?.url ?? "";
  const devServer = process.env.VITE_DEV_SERVER_URL;
  if (url.startsWith("file://")) return;
  if (devServer && url.startsWith(devServer)) return;
  throw new Error("Недоверенный источник IPC-запроса");
}
