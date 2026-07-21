import { contextBridge, ipcRenderer } from "electron";
import type {
  HrApi,
  HrCreateParams,
  HrDeleteParams,
  HrEmploymentChangeParams,
  HrGetByIdParams,
  HrListParams,
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
  getAuthState() {
    return ipcRenderer.invoke("auth:state");
  },
  listBootstrapEmployees() {
    return ipcRenderer.invoke("auth:bootstrapEmployees");
  },
  bootstrapSuperadmin(params: BootstrapSuperadminParams) {
    return ipcRenderer.invoke("auth:bootstrap", params);
  },
  login(params: LoginParams) {
    return ipcRenderer.invoke("auth:login", params);
  },
  logout() {
    return ipcRenderer.invoke("auth:logout");
  },
  changeOwnPassword(params: ChangeOwnPasswordParams) {
    return ipcRenderer.invoke("auth:changePassword", params);
  },
  list(params: HrListParams) {
    return ipcRenderer.invoke("hr:list", params);
  },
  getById(params: HrGetByIdParams) {
    return ipcRenderer.invoke("hr:getById", params);
  },
  create(params: HrCreateParams) {
    return ipcRenderer.invoke("hr:create", params);
  },
  update(params: HrUpdateParams) {
    return ipcRenderer.invoke("hr:update", params);
  },
  changeEmployment(params: HrEmploymentChangeParams) {
    return ipcRenderer.invoke("hr:changeEmployment", params);
  },
  delete(params: HrDeleteParams) {
    return ipcRenderer.invoke("hr:delete", params);
  },
  dashboard() {
    return ipcRenderer.invoke("hr:dashboard");
  },
  listVacancies(params: RecruitmentListParams) {
    return ipcRenderer.invoke("recruitment:listVacancies", params);
  },
  getVacancy(id: number) {
    return ipcRenderer.invoke("recruitment:getVacancy", id);
  },
  saveVacancy(params: SaveVacancyParams) {
    return ipcRenderer.invoke("recruitment:saveVacancy", params);
  },
  deleteVacancy(id: number) {
    return ipcRenderer.invoke("recruitment:deleteVacancy", id);
  },
  listCandidates(params: RecruitmentListParams) {
    return ipcRenderer.invoke("recruitment:listCandidates", params);
  },
  getCandidate(id: number) {
    return ipcRenderer.invoke("recruitment:getCandidate", id);
  },
  saveCandidate(params: SaveCandidateParams) {
    return ipcRenderer.invoke("recruitment:saveCandidate", params);
  },
  deleteCandidate(id: number) {
    return ipcRenderer.invoke("recruitment:deleteCandidate", id);
  },
  getAccessOverview() {
    return ipcRenderer.invoke("access:overview");
  },
  saveAccessRole(params: SaveAccessRoleParams) {
    return ipcRenderer.invoke("access:saveRole", params);
  },
  deleteAccessRole(id: number) {
    return ipcRenderer.invoke("access:deleteRole", id);
  },
  saveAccessUser(params: SaveAccessUserParams) {
    return ipcRenderer.invoke("access:saveUser", params);
  },
  resetAccessPassword(params: ResetAccessPasswordParams) {
    return ipcRenderer.invoke("access:resetPassword", params);
  },
  deleteAccessUser(id: number) {
    return ipcRenderer.invoke("access:deleteUser", id);
  },
};

contextBridge.exposeInMainWorld("hrApi", hrApi);

contextBridge.exposeInMainWorld("ipcRenderer", {
  on(...args: Parameters<typeof ipcRenderer.on>) {
    const [channel, listener] = args;
    return ipcRenderer.on(channel, (event, ...listenerArgs) =>
      listener(event, ...listenerArgs),
    );
  },
  off(...args: Parameters<typeof ipcRenderer.off>) {
    const [channel, ...listenerArgs] = args;
    return ipcRenderer.off(channel, ...listenerArgs);
  },
  send(...args: Parameters<typeof ipcRenderer.send>) {
    const [channel, ...sendArgs] = args;
    return ipcRenderer.send(channel, ...sendArgs);
  },
  invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
    const [channel, ...invokeArgs] = args;
    return ipcRenderer.invoke(channel, ...invokeArgs);
  },
});
