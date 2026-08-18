import type {
  AuditListParams,
  HireCandidateParams,
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
} from "../types/hr";
import type {
  BootstrapSuperadminParams,
  ChangeOwnPasswordParams,
  LoginParams,
  ResetAccessPasswordParams,
  SaveAccessRoleParams,
  SaveAccessUserParams,
} from "../types/access";

function getHrApi() {
  if (window.hrApi) return window.hrApi;
  throw new Error(
    "HR API недоступен. Приложение необходимо открыть в защищённом Electron-окне.",
  );
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
  terminateEmployee: (params: HrTerminationParams) =>
    getHrApi().terminateEmployee(params),
  correctHireDate: (params: HrHireDateCorrectionParams) =>
    getHrApi().correctHireDate(params),
  delete: (params: HrDeleteParams) => getHrApi().delete(params),
  dashboard: () => getHrApi().dashboard(),
  listVacancies: (params: RecruitmentListParams) =>
    getHrApi().listVacancies(params),
  getVacancy: (id: number) => getHrApi().getVacancy(id),
  saveVacancy: (params: SaveVacancyParams) => getHrApi().saveVacancy(params),
  deleteVacancy: (id: number) => getHrApi().deleteVacancy(id),
  listCandidates: (params: RecruitmentListParams) =>
    getHrApi().listCandidates(params),
  getCandidate: (id: number) => getHrApi().getCandidate(id),
  saveCandidate: (params: SaveCandidateParams) =>
    getHrApi().saveCandidate(params),
  hireCandidate: (params: HireCandidateParams) =>
    getHrApi().hireCandidate(params),
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
  listAuditEvents: (params: AuditListParams = {}) =>
    getHrApi().listAuditEvents(params),
  listBackups: () => getHrApi().listBackups(),
  createBackup: () => getHrApi().createBackup(),
  restoreBackup: (name: string) => getHrApi().restoreBackup(name),
  openBackupsFolder: () => getHrApi().openBackupsFolder(),
  exportEmployeesCsv: () => getHrApi().exportEmployeesCsv(),
};
