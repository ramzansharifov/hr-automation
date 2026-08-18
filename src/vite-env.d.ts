/// <reference types="vite/client" />

import type { HrApi } from "./shared/types/hr";

declare global {
  interface Window {
    hrApi?: HrApi;
  }
}

export {};
