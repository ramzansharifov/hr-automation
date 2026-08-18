import { useCallback, useEffect } from "react";

import {
  AUTH_SESSION_SYNC_EVENT,
  hrApiClient,
} from "../../shared/lib/hrApiClient";
import type { AuthSession } from "../../shared/types/access";
import { useAuth } from "./AuthContext";

export function AuthSessionSynchronizer(): null {
  const { logout, session, updateSession } = useAuth();

  const synchronize = useCallback(async (): Promise<void> => {
    try {
      const state = await hrApiClient.getAuthState();
      const nextSession = state.session;

      if (!nextSession) {
        await logout();
        return;
      }

      if (!sessionsEqual(session, nextSession)) {
        updateSession(nextSession);
      }
    } catch {
      // A transient IPC/read failure must not destroy an otherwise valid renderer session.
      // The backend still revalidates the current identity on every protected request.
    }
  }, [logout, session, updateSession]);

  useEffect(() => {
    const handleSync = (): void => {
      void synchronize();
    };
    const handleVisibilityChange = (): void => {
      if (document.visibilityState === "visible") handleSync();
    };

    window.addEventListener(AUTH_SESSION_SYNC_EVENT, handleSync);
    window.addEventListener("focus", handleSync);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener(AUTH_SESSION_SYNC_EVENT, handleSync);
      window.removeEventListener("focus", handleSync);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [synchronize]);

  return null;
}

function sessionsEqual(current: AuthSession, next: AuthSession): boolean {
  return JSON.stringify(current) === JSON.stringify(next);
}
