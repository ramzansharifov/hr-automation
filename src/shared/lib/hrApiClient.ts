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
  ResetAccessPasswordParams,
  SaveAccessRoleParams,
  SaveAccessUserParams,
} from "../types/access";

function getHrApi(): HrApi {
  if (window.hrApi) {
    return window.hrApi;
  }

  if (window.ipcRenderer) {
    return createHrApiFromIpcRenderer();
  }

  throw new Error(
    "HR API недоступен. Закрой браузерное окно, останови dev-сервер через Ctrl+C и заново запусти npm run dev. Работать нужно именно в Electron-окне.",
  );
}

function createHrApiFromIpcRenderer(): HrApi {
  return {
    list(params: HrListParams) {
      return invoke<HrListResult>("hr:list", params);
    },

    getById(params: HrGetByIdParams) {
      return invoke<HrRecord | null>("hr:getById", params);
    },

    create(params: HrCreateParams) {
      return invoke<HrRecord>("hr:create", params);
    },

    update(params: HrUpdateParams) {
      return invoke<HrRecord>("hr:update", params);
    },

    changeEmployment(params: HrEmploymentChangeParams) {
      return invoke<HrRecord>("hr:changeEmployment", params);
    },

    delete(params: HrDeleteParams) {
      return invoke<{ success: true }>("hr:delete", params);
    },

    dashboard() {
      return invoke<HrDashboardStats>("hr:dashboard");
    },

    listVacancies(params: RecruitmentListParams) {
      return invoke<HrRecord[]>("recruitment:listVacancies", params);
    },
    getVacancy(id: number) {
      return invoke<VacancyProfile | null>("recruitment:getVacancy", id);
    },
    saveVacancy(params: SaveVacancyParams) {
      return invoke<VacancyProfile>("recruitment:saveVacancy", params);
    },
    deleteVacancy(id: number) {
      return invoke<{ success: true }>("recruitment:deleteVacancy", id);
    },
    listCandidates(params: RecruitmentListParams) {
      return invoke<HrRecord[]>("recruitment:listCandidates", params);
    },
    getCandidate(id: number) {
      return invoke<CandidateProfile | null>("recruitment:getCandidate", id);
    },
    saveCandidate(params: SaveCandidateParams) {
      return invoke<CandidateProfile>("recruitment:saveCandidate", params);
    },
    deleteCandidate(id: number) {
      return invoke<{ success: true }>("recruitment:deleteCandidate", id);
    },

    getAccessOverview() {
      return invoke<AccessControlOverview>("access:overview");
    },
    saveAccessRole(params: SaveAccessRoleParams) {
      return invoke<AccessRoleSummary>("access:saveRole", params);
    },
    deleteAccessRole(id: number) {
      return invoke<{ success: true }>("access:deleteRole", id);
    },
    saveAccessUser(params: SaveAccessUserParams) {
      return invoke<AccessUserSummary>("access:saveUser", params);
    },
    resetAccessPassword(params: ResetAccessPasswordParams) {
      return invoke<{ success: true }>("access:resetPassword", params);
    },
    deleteAccessUser(id: number) {
      return invoke<{ success: true }>("access:deleteUser", id);
    },
  };
}

function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  if (!window.ipcRenderer) {
    return Promise.reject(new Error(`IPC канал ${channel} недоступен`));
  }

  return window.ipcRenderer.invoke(channel, ...args) as Promise<T>;
}

export const hrApiClient = {
  list(params: HrListParams) {
    return getHrApi().list(params);
  },

  getById(params: HrGetByIdParams) {
    return getHrApi().getById(params);
  },

  create(params: HrCreateParams) {
    return getHrApi().create(params);
  },

  update(params: HrUpdateParams) {
    return getHrApi().update(params);
  },

  changeEmployment(params: HrEmploymentChangeParams) {
    return getHrApi().changeEmployment(params);
  },

  delete(params: HrDeleteParams) {
    return getHrApi().delete(params);
  },

  dashboard() {
    return getHrApi().dashboard();
  },
  listVacancies(params: RecruitmentListParams) {
    return getHrApi().listVacancies(params);
  },
  getVacancy(id: number) {
    return getHrApi().getVacancy(id);
  },
  saveVacancy(params: SaveVacancyParams) {
    return getHrApi().saveVacancy(params);
  },
  deleteVacancy(id: number) {
    return getHrApi().deleteVacancy(id);
  },
  listCandidates(params: RecruitmentListParams) {
    return getHrApi().listCandidates(params);
  },
  getCandidate(id: number) {
    return getHrApi().getCandidate(id);
  },
  saveCandidate(params: SaveCandidateParams) {
    return getHrApi().saveCandidate(params);
  },
  deleteCandidate(id: number) {
    return getHrApi().deleteCandidate(id);
  },

  getAccessOverview() {
    return getHrApi().getAccessOverview();
  },
  saveAccessRole(params: SaveAccessRoleParams) {
    return getHrApi().saveAccessRole(params);
  },
  deleteAccessRole(id: number) {
    return getHrApi().deleteAccessRole(id);
  },
  saveAccessUser(params: SaveAccessUserParams) {
    return getHrApi().saveAccessUser(params);
  },
  resetAccessPassword(params: ResetAccessPasswordParams) {
    return getHrApi().resetAccessPassword(params);
  },
  deleteAccessUser(id: number) {
    return getHrApi().deleteAccessUser(id);
  },
};
