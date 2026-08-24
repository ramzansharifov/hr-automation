import { ipcMain, type IpcMainInvokeEvent } from "electron";
import { getDatabase } from "../database/connection";
import { getActiveAuthenticationService } from "../services/authenticationService";
import { AuthorizationService } from "../services/authorizationService";
import { EmployeeWorkspaceService } from "../services/employeeWorkspaceService";

export function registerEmployeeWorkspaceIpcHandlers(): void {
  const database = getDatabase();
  const authenticationService = getActiveAuthenticationService();
  const authorizationService = new AuthorizationService(
    database,
    authenticationService,
  );
  const workspaceService = new EmployeeWorkspaceService(database);

  ipcMain.removeHandler("employee:workspace");
  ipcMain.handle("employee:workspace", (event) => {
    assertTrustedSender(event);
    const session = authorizationService.requirePermission("directory.view");
    return workspaceService.getWorkspace(session.employeeId);
  });
}

function assertTrustedSender(event: IpcMainInvokeEvent): void {
  const url = event.senderFrame?.url ?? "";
  const devServer = process.env.VITE_DEV_SERVER_URL;
  if (url.startsWith("file://")) return;
  if (devServer && url.startsWith(devServer)) return;
  throw new Error("Недоверенный источник IPC-запроса");
}
