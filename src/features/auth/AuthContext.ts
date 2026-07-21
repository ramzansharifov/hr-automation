import { createContext, useContext } from "react";
import type { AuthSession } from "../../shared/types/access";

export interface AuthContextValue {
  session: AuthSession;
  hasPermission: (permissionCode: string) => boolean;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  updateSession: (session: AuthSession) => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("AuthContext используется вне AuthProvider");
  return value;
}
