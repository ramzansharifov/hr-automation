import { contextBridge, ipcRenderer } from "electron";
import type {
  AuditListParams,
  HireCandidateParams,
  HrApi,
  HrCreateParams,
  HrDeleteParams,
  HrEmploymentChangeParams,
  HrGetByIdParams,
  HrHireDateCorrectionParams,
  HrListParams,
  HrTerminationParams,
  RecruitmentListParams,
  SaveCandidateParams,
  SaveVacancyParams,
  HrUpdateParams,
} from "../src/shared/types/hr";
import type {
  BootstrapSuperadminParams,
  ChangeOwnPasswordParams,
  LoginParams,
  ResetAccessPasswordParams,
  SaveAccessRoleParams,
  SaveAccessUserParams,
} from "../src/shared/types/access";

const hrApi: HrApi = {
  getAuthState: () => ipcRenderer.invoke("auth:state"),
  listBootstrapEmployees: () => ipcRenderer.invoke("auth:bootstrapEmployees"),
  bootstrapSuperadmin: (params: BootstrapSuperadminParams) =>
    ipcRenderer.invoke("auth:bootstrap", params),
  login: (params: LoginParams) => ipcRenderer.invoke("auth:login", params),
  logout: () => ipcRenderer.invoke("auth:logout"),
  changeOwnPassword: (params: ChangeOwnPasswordParams) =>
    ipcRenderer.invoke("auth:changePassword", params),
  list: (params: HrListParams) => ipcRenderer.invoke("hr:list", params),
  getById: (params: HrGetByIdParams) => ipcRenderer.invoke("hr:getById", params),
  create: (params: HrCreateParams) => ipcRenderer.invoke("hr:create", params),
  update: (params: HrUpdateParams) => ipcRenderer.invoke("hr:update", params),
  changeEmployment: (params: HrEmploymentChangeParams) =>
    ipcRenderer.invoke("hr:changeEmployment", params),
  terminateEmployee: (params: HrTerminationParams) =>
    ipcRenderer.invoke("hr:terminateEmployee", params),
  correctHireDate: (params: HrHireDateCorrectionParams) =>
    ipcRenderer.invoke("hr:correctHireDate", params),
  delete: (params: HrDeleteParams) => ipcRenderer.invoke("hr:delete", params),
  dashboard: () => ipcRenderer.invoke("hr:dashboard"),
  listVacancies: (params: RecruitmentListParams) =>
    ipcRenderer.invoke("recruitment:listVacancies", params),
  getVacancy: (id: number) => ipcRenderer.invoke("recruitment:getVacancy", id),
  saveVacancy: (params: SaveVacancyParams) =>
    ipcRenderer.invoke("recruitment:saveVacancy", params),
  deleteVacancy: (id: number) =>
    ipcRenderer.invoke("recruitment:deleteVacancy", id),
  listCandidates: (params: RecruitmentListParams) =>
    ipcRenderer.invoke("recruitment:listCandidates", params),
  getCandidate: (id: number) => ipcRenderer.invoke("recruitment:getCandidate", id),
  saveCandidate: (params: SaveCandidateParams) =>
    ipcRenderer.invoke("recruitment:saveCandidate", params),
  hireCandidate: (params: HireCandidateParams) =>
    ipcRenderer.invoke("recruitment:hireCandidate", params),
  deleteCandidate: (id: number) =>
    ipcRenderer.invoke("recruitment:deleteCandidate", id),
  listAccessPermissions: () => ipcRenderer.invoke("access:listPermissions"),
  listAccessRoles: () => ipcRenderer.invoke("access:listRoles"),
  listAccessUsers: () => ipcRenderer.invoke("access:listUsers"),
  getAccessSystemAdmin: () => ipcRenderer.invoke("access:getSystemAdmin"),
  saveAccessRole: (params: SaveAccessRoleParams) =>
    ipcRenderer.invoke("access:saveRole", params),
  deleteAccessRole: (id: number) => ipcRenderer.invoke("access:deleteRole", id),
  saveAccessUser: (params: SaveAccessUserParams) =>
    ipcRenderer.invoke("access:saveUser", params),
  resetAccessPassword: (params: ResetAccessPasswordParams) =>
    ipcRenderer.invoke("access:resetPassword", params),
  deleteAccessUser: (id: number) => ipcRenderer.invoke("access:deleteUser", id),
  listAuditEvents: (params: AuditListParams = {}) =>
    ipcRenderer.invoke("audit:list", params),
  listBackups: () => ipcRenderer.invoke("admin:listBackups"),
  createBackup: () => ipcRenderer.invoke("admin:createBackup"),
  restoreBackup: (name: string) => ipcRenderer.invoke("admin:restoreBackup", name),
  openBackupsFolder: () => ipcRenderer.invoke("admin:openBackupsFolder"),
  exportEmployeesCsv: () => ipcRenderer.invoke("admin:exportEmployeesCsv"),
};

contextBridge.exposeInMainWorld("hrApi", hrApi);
