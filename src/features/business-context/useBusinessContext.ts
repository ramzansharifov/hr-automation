import { createContext, useContext } from "react";
import type { BusinessContextState } from "../../shared/types/access";

export interface BusinessContextValue {
  state: BusinessContextState | null;
  isLoading: boolean;
  error: string;
  selectEnterprise: (enterpriseId: number | null) => Promise<void>;
  selectDepartment: (departmentId: number | null) => Promise<void>;
  refresh: () => Promise<void>;
}

export const BusinessContext = createContext<BusinessContextValue | null>(null);

export function useBusinessContext(): BusinessContextValue {
  const value = useContext(BusinessContext);
  if (!value) {
    throw new Error("BusinessContext используется вне BusinessContextProvider");
  }
  return value;
}
