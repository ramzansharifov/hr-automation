import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { FiBriefcase, FiLayers } from "react-icons/fi";
import { Outlet } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import { hrApiClient } from "../../shared/lib/hrApiClient";
import type { BusinessContextState } from "../../shared/types/access";
import { EmptyState, LoadingState, Select } from "../../shared/ui";
import {
  BusinessContext,
  useBusinessContext,
  type BusinessContextValue,
} from "./useBusinessContext";

export function BusinessContextProvider({
  children,
}: {
  children: ReactNode;
}): JSX.Element {
  const { session } = useAuth();
  const [state, setState] = useState<BusinessContextState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError("");
    try {
      setState(await hrApiClient.getBusinessContext());
    } catch (loadError) {
      setError(errorMessage(loadError, "Не удалось загрузить рабочий контекст"));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh, session.userId, session.employeeId]);

  const selectEnterprise = useCallback(
    async (enterpriseId: number | null): Promise<void> => {
      setError("");
      try {
        setState(
          await hrApiClient.setBusinessContext({
            enterpriseId,
            departmentId: null,
          }),
        );
      } catch (saveError) {
        setError(errorMessage(saveError, "Не удалось выбрать предприятие"));
      }
    },
    [],
  );

  const selectDepartment = useCallback(
    async (departmentId: number | null): Promise<void> => {
      if (!state?.enterpriseId) return;
      setError("");
      try {
        setState(
          await hrApiClient.setBusinessContext({
            enterpriseId: state.enterpriseId,
            departmentId,
          }),
        );
      } catch (saveError) {
        setError(errorMessage(saveError, "Не удалось выбрать отдел"));
      }
    },
    [state?.enterpriseId],
  );

  const value = useMemo<BusinessContextValue>(
    () => ({
      state,
      isLoading,
      error,
      selectEnterprise,
      selectDepartment,
      refresh,
    }),
    [state, isLoading, error, selectEnterprise, selectDepartment, refresh],
  );

  return (
    <BusinessContext.Provider value={value}>{children}</BusinessContext.Provider>
  );
}

export function BusinessContextRoute(): JSX.Element {
  const {
    state,
    isLoading,
    error,
    selectEnterprise,
    selectDepartment,
  } = useBusinessContext();

  if (isLoading) {
    return <LoadingState label="Загрузка рабочего контекста..." />;
  }

  if (!state) {
    return (
      <EmptyState
        title="Не удалось определить рабочий контекст"
        description={error || "Обновите страницу или войдите в систему заново."}
      />
    );
  }

  const enterpriseOptions = state.enterprises.map((enterprise) => ({
    value: String(enterprise.id),
    label: enterprise.name,
  }));
  const departmentOptions = state.departments.map((department) => ({
    value: String(department.id),
    label: department.name,
  }));

  return (
    <div className="space-y-5">
      <section className="app-surface app-border flex flex-col gap-4 rounded-[24px] border p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <span className="app-accent-soft flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border">
            <FiLayers className="h-4 w-4" />
          </span>
          <p className="app-text text-sm font-black">Контекст работы</p>
        </div>

        {state.canSelectEnterprise ? (
          <div className="grid w-full gap-3 sm:grid-cols-2 lg:w-[620px]">
            <label className="grid gap-1.5">
              <span className="app-muted flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.08em]">
                <FiLayers className="h-3.5 w-3.5" /> Предприятие
              </span>
              <Select
                allowEmpty
                emptyOptionLabel="Выберите предприятие"
                onValueChange={(value) =>
                  void selectEnterprise(value ? Number(value) : null)
                }
                options={enterpriseOptions}
                placeholder="Выберите предприятие"
                value={state.enterpriseId ? String(state.enterpriseId) : ""}
              />
            </label>

            <label className="grid gap-1.5">
              <span className="app-muted flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.08em]">
                <FiBriefcase className="h-3.5 w-3.5" /> Отдел
              </span>
              <Select
                allowEmpty
                disabled={!state.canSelectDepartment || !state.enterpriseId}
                emptyOptionLabel="Все отделы"
                onValueChange={(value) =>
                  void selectDepartment(value ? Number(value) : null)
                }
                options={departmentOptions}
                placeholder="Все отделы"
                value={state.departmentId ? String(state.departmentId) : ""}
              />
            </label>
          </div>
        ) : (
          <div className="app-surface-muted app-border-soft rounded-2xl border px-4 py-3 text-sm font-bold">
            <span className="app-text">{state.enterpriseName || "Предприятие не определено"}</span>
            {state.departmentName ? (
              <span className="app-muted"> · {state.departmentName}</span>
            ) : null}
          </div>
        )}
      </section>

      {error ? (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700 dark:border-rose-800 dark:bg-rose-950/35 dark:text-rose-300">
          {error}
        </p>
      ) : null}

      {state.requiresEnterpriseSelection && !state.enterpriseId ? (
        <EmptyState
          title="Выберите предприятие"
          description="Superadmin работает с операционными HR-разделами только внутри конкретного предприятия. После выбора можно дополнительно сузить данные до одного отдела."
        />
      ) : (
        <Outlet />
      )}
    </div>
  );
}

function errorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback;
  const marker = "Error: ";
  const index = error.message.lastIndexOf(marker);
  return index >= 0 ? error.message.slice(index + marker.length) : error.message || fallback;
}
