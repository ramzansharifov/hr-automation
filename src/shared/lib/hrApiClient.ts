import type {
  HrApi,
  HrCreateParams,
  HrDashboardStats,
  HrDeleteParams,
  HrEmploymentChangeParams,
  HrGetByIdParams,
  HrListParams,
  HrListResult,
  HrRecord,
  CandidateProfile,
  RecruitmentListParams,
  SaveCandidateParams,
  SaveVacancyParams,
  VacancyProfile,
  HrUpdateParams,
} from "../types/hr";
import type {
  AccessControlOverview,
  AccessRoleSummary,
  AccessUserSummary,
  AuthEmployeeOption,
  AuthSession,
  AuthState,
  BootstrapSuperadminParams,
  ChangeOwnPasswordParams,
  LoginParams,
  ResetAccessPasswordParams,
  SaveAccessRoleParams,
  SaveAccessUserParams,
} from "../types/access";

function getHrApi(): HrApi {
  if (window.hrApi) return window.hrApi;
  if (window.ipcRenderer) return createHrApiFromIpcRenderer();
  throw new Error(
    "HR API недоступен. Закрой браузерное окно, останови dev-сервер через Ctrl+C и заново запусти npm run dev. Работать нужно именно в Electron-окне.",
  );
}

function createHrApiFromIpcRenderer(): HrApi {
  return {
    getAuthState: () => invoke<AuthState>("auth:state"),
    listBootstrapEmployees: () =>
      invoke<AuthEmployeeOption[]>("auth:bootstrapEmployees"),
    bootstrapSuperadmin: (params: BootstrapSuperadminParams) =>
      invoke<AuthSession>("auth:bootstrap", params),
    login: (params: LoginParams) => invoke<AuthSession>("auth:login", params),
    logout: () => invoke<{ success: true }>("auth:logout"),
    changeOwnPassword: (params: ChangeOwnPasswordParams) =>
      invoke<AuthSession>("auth:changePassword", params),
    list: (params: HrListParams) => invoke<HrListResult>("hr:list", params),
    getById: (params: HrGetByIdParams) =>
      invoke<HrRecord | null>("hr:getById", params),
    create: (params: HrCreateParams) => invoke<HrRecord>("hr:create", params),
    update: (params: HrUpdateParams) => invoke<HrRecord>("hr:update", params),
    changeEmployment: (params: HrEmploymentChangeParams) =>
      invoke<HrRecord>("hr:changeEmployment", params),
    delete: (params: HrDeleteParams) =>
      invoke<{ success: true }>("hr:delete", params),
    dashboard: () => invoke<HrDashboardStats>("hr:dashboard"),
    listVacancies: (params: RecruitmentListParams) =>
      invoke<HrRecord[]>("recruitment:listVacancies", params),
    getVacancy: (id: number) =>
      invoke<VacancyProfile | null>("recruitment:getVacancy", id),
    saveVacancy: (params: SaveVacancyParams) =>
      invoke<VacancyProfile>("recruitment:saveVacancy", params),
    deleteVacancy: (id: number) =>
      invoke<{ success: true }>("recruitment:deleteVacancy", id),
    listCandidates: (params: RecruitmentListParams) =>
      invoke<HrRecord[]>("recruitment:listCandidates", params),
    getCandidate: (id: number) =>
      invoke<CandidateProfile | null>("recruitment:getCandidate", id),
    saveCandidate: (params: SaveCandidateParams) =>
      invoke<CandidateProfile>("recruitment:saveCandidate", params),
    deleteCandidate: (id: number) =>
      invoke<{ success: true }>("recruitment:deleteCandidate", id),
    getAccessOverview: () =>
      invoke<AccessControlOverview>("access:overview"),
    saveAccessRole: (params: SaveAccessRoleParams) =>
      invoke<AccessRoleSummary>("access:saveRole", params),
    deleteAccessRole: (id: number) =>
      invoke<{ success: true }>("access:deleteRole", id),
    saveAccessUser: (params: SaveAccessUserParams) =>
      invoke<AccessUserSummary>("access:saveUser", params),
    resetAccessPassword: (params: ResetAccessPasswordParams) =>
      invoke<{ success: true }>("access:resetPassword", params),
    deleteAccessUser: (id: number) =>
      invoke<{ success: true }>("access:deleteUser", id),
  };
}

function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  if (!window.ipcRenderer) {
    return Promise.reject(new Error(`IPC канал ${channel} недоступен`));
  }
  return window.ipcRenderer.invoke(channel, ...args) as Promise<T>;
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
  create: (params: HrCreateParams) => getHrApi().create(params),
  update: (params: HrUpdateParams) => getHrApi().update(params),
  changeEmployment: (params: HrEmploymentChangeParams) =>
    getHrApi().changeEmployment(params),
  delete: (params: HrDeleteParams) => getHrApi().delete(params),
  dashboard: () => getHrApi().dashboard(),
  listVacancies: (params: RecruitmentListParams) =>
    getHrApi().listVacancies(params),
  getVacancy: (id: number) => getHrApi().getVacancy(id),
  saveVacancy: (params: SaveVacancyParams) =>
    getHrApi().saveVacancy(params),
  deleteVacancy: (id: number) => getHrApi().deleteVacancy(id),
  listCandidates: (params: RecruitmentListParams) =>
    getHrApi().listCandidates(params),
  getCandidate: (id: number) => getHrApi().getCandidate(id),
  saveCandidate: (params: SaveCandidateParams) =>
    getHrApi().saveCandidate(params),
  deleteCandidate: (id: number) => getHrApi().deleteCandidate(id),
  getAccessOverview: () => getHrApi().getAccessOverview(),
  saveAccessRole: (params: SaveAccessRoleParams) =>
    getHrApi().saveAccessRole(params),
  deleteAccessRole: (id: number) => getHrApi().deleteAccessRole(id),
  saveAccessUser: (params: SaveAccessUserParams) =>
    getHrApi().saveAccessUser(params),
  resetAccessPassword: (params: ResetAccessPasswordParams) =>
    getHrApi().resetAccessPassword(params),
  deleteAccessUser: (id: number) => getHrApi().deleteAccessUser(id),
};
