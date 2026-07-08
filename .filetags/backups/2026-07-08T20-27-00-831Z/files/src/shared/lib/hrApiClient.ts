import type {
  HrApi,
  HrCreateParams,
  HrDeleteParams,
  HrGetByIdParams,
  HrListParams,
  HrUpdateParams,
} from '../types/hr'

function getHrApi(): HrApi {
  if (!window.hrApi) {
    throw new Error('HR API недоступен. Запусти приложение через Electron.')
  }

  return window.hrApi
}

export const hrApiClient = {
  list(params: HrListParams) {
    return getHrApi().list(params)
  },

  getById(params: HrGetByIdParams) {
    return getHrApi().getById(params)
  },

  create(params: HrCreateParams) {
    return getHrApi().create(params)
  },

  update(params: HrUpdateParams) {
    return getHrApi().update(params)
  },

  delete(params: HrDeleteParams) {
    return getHrApi().delete(params)
  },

  dashboard() {
    return getHrApi().dashboard()
  },
}