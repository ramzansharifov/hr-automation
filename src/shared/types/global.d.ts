import type { HrApi } from './hr'

declare global {
  interface Window {
    hrApi: HrApi
    ipcRenderer: {
      on: (...args: unknown[]) => unknown
      off: (...args: unknown[]) => unknown
      send: (...args: unknown[]) => unknown
      invoke: (...args: unknown[]) => Promise<unknown>
    }
  }
}

export {}