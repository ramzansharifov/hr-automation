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

const hrApi: HrApi = {
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
