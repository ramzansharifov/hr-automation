import type {
  AddEmployeeDocumentParams,
  ApplyEmployeeImportParams,
  AuditListParams,
  DeleteEmployeeDocumentParams,
  ExportDataParams,
  HireCandidateParams,
  HrCreateParams,
  HrDeleteParams,
  HrEmploymentChangeParams,
  HrGetByIdParams,
  HrHireDateCorrectionParams,
  HrLeadershipChangeParams,
  HrListParams,
  HrTerminationParams,
  LeaveOverviewParams,
  PreviewEmployeeImportParams,
  RecruitmentListParams,
  SaveCandidateParams,
  SaveLeaveBalanceParams,
  SaveVacancyParams,
  SaveWorkCalendarDayParams,
  HrUpdateParams,
} from "../types/hr";
import type {
  BootstrapSuperadminParams,
  ChangeOwnPasswordParams,
  LoginParams,
  ResetAccessPasswordParams,
  SaveAccessRoleParams,
  SaveAccessUserParams,
} from "../types/access";
import type { EmployeeWorkspaceData } from "../types/employeeWorkspace";

export const AUTH_SESSION_SYNC_EVENT = "hr:auth-session-sync";

type EmployeeWorkspaceBridge = {
  getEmployeeWorkspace(): Promise<EmployeeWorkspaceData>;
};

function getHrApi() {
  if (window.hrApi) return window.hrApi;
  throw new Error(
    "HR API недоступен. Приложение необходимо открыть в защищённом Electron-окне.",
  );
}

function getEmployeeWorkspaceBridge(): EmployeeWorkspaceBridge {
  return getHrApi() as typeof window.hrApi & EmployeeWorkspaceBridge;
}

function notifyAuthSessionChanged<T>(request: Promise<T>): Promise<T> {
  return request.then((result) => {
    window.dispatchEvent(new Event(AUTH_SESSION_SYNC_EVENT));
    return result;
  });
}

export const hrApiClient = {
  getAuthState: () => getHrApi().getAuthState(),
  listBootstrapEmployees: () => getHrApi().listBootstrapEmployees(),
  bootstrapSuperadmin: (params: BootstrapSuperadminParams) =>
    getHrApi().bootstrapSuperadmin(params),
  login: (params: LoginParams) => getHrApi().login(params),
  logout: () => getHrApi().logout(),
  changeOwnPassword: (params: ChangeOwnPasswordParams) =>
    getHrApi().changeOwnPassword(params),
  list: (params: HrListParams) => getHrApi().list(params),
  getById: (params: HrGetByIdParams) => getHrApi().getById(params),
  create: (params: HrCreateParams) =>
    notifyAuthSessionChanged(getHrApi().create(params)),
  update: (params: HrUpdateParams) =>
    notifyAuthSessionChanged(getHrApi().update(params)),
  changeEmployment: (params: HrEmploymentChangeParams) =>
    notifyAuthSessionChanged(getHrApi().changeEmployment(params)),
  changeLeadership: (params: HrLeadershipChangeParams) =>
    notifyAuthSessionChanged(getHrApi().changeLeadership(params)),
  terminateEmployee: (params: HrTerminationParams) =>
    notifyAuthSessionChanged(getHrApi().terminateEmployee(params)),
  correctHireDate: (params: HrHireDateCorrectionParams) =>
    notifyAuthSessionChanged(getHrApi().correctHireDate(params)),
  delete: (params: HrDeleteParams) =>
    notifyAuthSessionChanged(getHrApi().delete(params)),
  dashboard: () => getHrApi().dashboard(),
  getEmployeeWorkspace: () => getEmployeeWorkspaceBridge().getEmployeeWorkspace(),
  listVacancies: (params: RecruitmentListParams) =>
    getHrApi().listVacancies(params),
  getVacancy: (id: number) => getHrApi().getVacancy(id),
  saveVacancy: (params: SaveVacancyParams) =>
    notifyAuthSessionChanged(getHrApi().saveVacancy(params)),
  deleteVacancy: (id: number) =>
    notifyAuthSessionChanged(getHrApi().deleteVacancy(id)),
  listCandidates: (params: RecruitmentListParams) =>
    getHrApi().listCandidates(params),
  getCandidate: (id: number) => getHrApi().getCandidate(id),
  saveCandidate: (params: SaveCandidateParams) =>
    notifyAuthSessionChanged(getHrApi().saveCandidate(params)),
  hireCandidate: (params: HireCandidateParams) =>
    notifyAuthSessionChanged(getHrApi().hireCandidate(params)),
  deleteCandidate: (id: number) =>
    notifyAuthSessionChanged(getHrApi().deleteCandidate(id)),
  listEmployeeDocuments: (employeeId?: number) =>
    getHrApi().listEmployeeDocuments(employeeId),
  addEmployeeDocument: (params: AddEmployeeDocumentParams) =>
    getHrApi().addEmployeeDocument(params),
  openEmployeeDocument: (id: number) => getHrApi().openEmployeeDocument(id),
  deleteEmployeeDocument: (params: DeleteEmployeeDocumentParams) =>
    getHrApi().deleteEmployeeDocument(params),
  getLeaveOverview: (params: LeaveOverviewParams) =>
    getHrApi().getLeaveOverview(params),
  saveLeaveBalance: (params: SaveLeaveBalanceParams) =>
    getHrApi().saveLeaveBalance(params),
  saveWorkCalendarDay: (params: SaveWorkCalendarDayParams) =>
    getHrApi().saveWorkCalendarDay(params),
  listAttentionItems: () => getHrApi().listAttentionItems(),
  getAnalytics: () => getHrApi().getAnalytics(),
  selectEmployeeImportFile: () => getHrApi().selectEmployeeImportFile(),
  previewEmployeeImport: (params: PreviewEmployeeImportParams) =>
    getHrApi().previewEmployeeImport(params),
  applyEmployeeImport: (params: ApplyEmployeeImportParams) =>
    notifyAuthSessionChanged(getHrApi().applyEmployeeImport(params)),
  exportData: (params: ExportDataParams) => getHrApi().exportData(params),
  listAccessPermissions: () => getHrApi().listAccessPermissions(),
  listAccessRoles: () => getHrApi().listAccessRoles(),
  listAccessUsers: () => getHrApi().listAccessUsers(),
  getAccessSystemAdmin: () => getHrApi().getAccessSystemAdmin(),
  saveAccessRole: (params: SaveAccessRoleParams) =>
    notifyAuthSessionChanged(getHrApi().saveAccessRole(params)),
  deleteAccessRole: (id: number) =>
    notifyAuthSessionChanged(getHrApi().deleteAccessRole(id)),
  saveAccessUser: (params: SaveAccessUserParams) =>
    notifyAuthSessionChanged(getHrApi().saveAccessUser(params)),
  resetAccessPassword: (params: ResetAccessPasswordParams) =>
    notifyAuthSessionChanged(getHrApi().resetAccessPassword(params)),
  deleteAccessUser: (id: number) =>
    notifyAuthSessionChanged(getHrApi().deleteAccessUser(id)),
  listAuditEvents: (params: AuditListParams = {}) =>
    getHrApi().listAuditEvents(params),
  listBackups: () => getHrApi().listBackups(),
  createBackup: () => getHrApi().createBackup(),
  restoreBackup: (name: string) =>
    notifyAuthSessionChanged(getHrApi().restoreBackup(name)),
  openBackupsFolder: () => getHrApi().openBackupsFolder(),
  exportEmployeesCsv: () => getHrApi().exportEmployeesCsv(),
};
