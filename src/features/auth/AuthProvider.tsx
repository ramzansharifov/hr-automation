import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { FiKey, FiLock, FiLogIn, FiShield, FiUser } from "react-icons/fi";

import { HRLogo } from "../../app/brand/HRLogo";
import { hrApiClient } from "../../shared/lib/hrApiClient";
import type {
  AuthEmployeeOption,
  AuthSession,
  AuthState,
} from "../../shared/types/access";
import {
  Button,
  Input,
  LoadingState,
  Select,
  type SelectOption,
} from "../../shared/ui";
import { AuthContext } from "./AuthContext";

const initialState: AuthState = {
  isInitialized: false,
  session: null,
};

export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const [authState, setAuthState] = useState<AuthState>(initialState);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const refreshState = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      setAuthState(await hrApiClient.getAuthState());
    } catch (loadError) {
      setError(getErrorMessage(loadError, "Не удалось проверить состояние входа"));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshState();
  }, [refreshState]);

  if (isLoading) {
    return (
      <AuthShell>
        <LoadingState label="Проверка доступа..." />
      </AuthShell>
    );
  }

  if (error) {
    return (
      <AuthShell>
        <AuthCard
          icon={<FiLock />}
          title="Не удалось открыть систему"
          description={error}
        >
          <Button onClick={() => void refreshState()}>Повторить</Button>
        </AuthCard>
      </AuthShell>
    );
  }

  if (!authState.isInitialized) {
    return (
      <BootstrapScreen
        onAuthenticated={(session) =>
          setAuthState({ isInitialized: true, session })
        }
      />
    );
  }

  if (!authState.session) {
    return (
      <LoginScreen
        onAuthenticated={(session) =>
          setAuthState({ isInitialized: true, session })
        }
      />
    );
  }

  if (authState.session.mustChangePassword) {
    return (
      <ChangePasswordScreen
        session={authState.session}
        onChanged={(session) =>
          setAuthState({ isInitialized: true, session })
        }
      />
    );
  }

  const session = authState.session;

  return (
    <AuthContext.Provider
      value={{
        session,
        hasPermission: (permissionCode) =>
          session.permissionCodes.includes(permissionCode),
        logout: async () => {
          await hrApiClient.logout();
          setAuthState({ isInitialized: true, session: null });
        },
        updateSession: (nextSession) =>
          setAuthState({ isInitialized: true, session: nextSession }),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

function BootstrapScreen({
  onAuthenticated,
}: {
  onAuthenticated: (session: AuthSession) => void;
}): JSX.Element {
  const [employees, setEmployees] = useState<AuthEmployeeOption[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    hrApiClient
      .listBootstrapEmployees()
      .then(setEmployees)
      .catch((loadError: unknown) =>
        setError(
          getErrorMessage(
            loadError,
            "Не удалось загрузить сотрудников для первичной настройки",
          ),
        ),
      )
      .finally(() => setIsLoading(false));
  }, []);

  const options = useMemo<SelectOption[]>(
    () =>
      employees.map((employee) => ({
        value: String(employee.id),
        label: [
          employee.fullName,
          employee.departmentName,
          employee.enterpriseName,
        ]
          .filter(Boolean)
          .join(" · "),
      })),
    [employees],
  );

  async function submit(): Promise<void> {
    setError("");
    if (password !== confirmPassword) {
      setError("Пароли не совпадают");
      return;
    }
    setIsSaving(true);
    try {
      const session = await hrApiClient.bootstrapSuperadmin({
        employeeId: Number(employeeId),
        username,
        password,
      });
      onAuthenticated(session);
    } catch (saveError) {
      setError(getErrorMessage(saveError, "Не удалось создать superadmin"));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <AuthShell>
      <AuthCard
        icon={<FiShield />}
        title="Первичная настройка"
        description="Создайте первого пользователя. Он будет неизменяемым активным superadmin и обязательно свяжется с существующим сотрудником."
      >
        {isLoading ? (
          <LoadingState label="Загрузка сотрудников..." />
        ) : employees.length === 0 ? (
          <AuthNotice>
            Нет активных сотрудников. Добавьте или активируйте сотрудника в базе данных,
            затем перезапустите приложение.
          </AuthNotice>
        ) : (
          <div className="grid gap-4">
            <AuthField label="Сотрудник-superadmin">
              <Select
                onValueChange={setEmployeeId}
                options={options}
                placeholder="Выберите сотрудника"
                value={employeeId}
              />
            </AuthField>
            <AuthField label="Логин">
              <Input
                autoComplete="username"
                onChange={(event) => setUsername(event.target.value)}
                placeholder="admin"
                value={username}
              />
            </AuthField>
            <AuthField label="Пароль">
              <Input
                autoComplete="new-password"
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Минимум 8 символов, буква и цифра"
                type="password"
                value={password}
              />
            </AuthField>
            <AuthField label="Повторите пароль">
              <Input
                autoComplete="new-password"
                onChange={(event) => setConfirmPassword(event.target.value)}
                type="password"
                value={confirmPassword}
              />
            </AuthField>
            <AuthError message={error} />
            <Button
              disabled={isSaving || !employeeId || !username || !password}
              leftIcon={<FiShield />}
              onClick={() => void submit()}
            >
              Создать superadmin
            </Button>
          </div>
        )}
      </AuthCard>
    </AuthShell>
  );
}

function LoginScreen({
  onAuthenticated,
}: {
  onAuthenticated: (session: AuthSession) => void;
}): JSX.Element {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function submit(): Promise<void> {
    setIsSaving(true);
    setError("");
    try {
      onAuthenticated(await hrApiClient.login({ username, password }));
    } catch (loginError) {
      setError(getErrorMessage(loginError, "Не удалось войти"));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <AuthShell>
      <AuthCard
        icon={<FiLogIn />}
        title="Вход в HR Automation"
        description="Введите логин и пароль учётной записи, связанной с вашим сотрудником."
      >
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <AuthField label="Логин">
            <Input
              autoComplete="username"
              autoFocus
              onChange={(event) => setUsername(event.target.value)}
              value={username}
            />
          </AuthField>
          <AuthField label="Пароль">
            <Input
              autoComplete="current-password"
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              value={password}
            />
          </AuthField>
          <AuthError message={error} />
          <Button
            disabled={isSaving || !username || !password}
            leftIcon={<FiLogIn />}
            type="submit"
          >
            Войти
          </Button>
        </form>
      </AuthCard>
    </AuthShell>
  );
}

function ChangePasswordScreen({
  onChanged,
  session,
}: {
  onChanged: (session: AuthSession) => void;
  session: AuthSession;
}): JSX.Element {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function submit(): Promise<void> {
    setError("");
    if (newPassword !== confirmPassword) {
      setError("Новые пароли не совпадают");
      return;
    }
    setIsSaving(true);
    try {
      onChanged(
        await hrApiClient.changeOwnPassword({ currentPassword, newPassword }),
      );
    } catch (changeError) {
      setError(getErrorMessage(changeError, "Не удалось изменить пароль"));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <AuthShell>
      <AuthCard
        icon={<FiKey />}
        title="Смените временный пароль"
        description={`Пользователь @${session.username} должен установить постоянный пароль перед началом работы.`}
      >
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <AuthField label="Текущий временный пароль">
            <Input
              autoComplete="current-password"
              onChange={(event) => setCurrentPassword(event.target.value)}
              type="password"
              value={currentPassword}
            />
          </AuthField>
          <AuthField label="Новый пароль">
            <Input
              autoComplete="new-password"
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder="Минимум 8 символов, буква и цифра"
              type="password"
              value={newPassword}
            />
          </AuthField>
          <AuthField label="Повторите новый пароль">
            <Input
              autoComplete="new-password"
              onChange={(event) => setConfirmPassword(event.target.value)}
              type="password"
              value={confirmPassword}
            />
          </AuthField>
          <AuthError message={error} />
          <Button
            disabled={isSaving || !currentPassword || !newPassword}
            leftIcon={<FiKey />}
            type="submit"
          >
            Сохранить новый пароль
          </Button>
        </form>
      </AuthCard>
    </AuthShell>
  );
}

function AuthShell({ children }: { children: ReactNode }): JSX.Element {
  return (
    <main className="app-page flex min-h-screen items-center justify-center overflow-hidden px-5 py-10">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_20%_15%,color-mix(in_srgb,var(--accent)_10%,transparent),transparent_34%),radial-gradient(circle_at_85%_80%,color-mix(in_srgb,var(--accent-border)_10%,transparent),transparent_36%)]" />
      <div className="relative z-10 w-full max-w-xl">{children}</div>
    </main>
  );
}

function AuthCard({
  children,
  description,
  icon,
  title,
}: {
  children: ReactNode;
  description: string;
  icon: ReactNode;
  title: string;
}): JSX.Element {
  return (
    <section className="app-surface app-border overflow-hidden rounded-[30px] border shadow-2xl shadow-slate-950/10">
      <header className="app-border-soft border-b p-7 text-center sm:p-9">
        <HRLogo className="mx-auto h-16 w-16" />
        <span className="app-accent-soft mx-auto mt-5 flex h-12 w-12 items-center justify-center rounded-2xl border [&>svg]:h-6 [&>svg]:w-6">
          {icon}
        </span>
        <h1 className="app-text mt-4 text-2xl font-black tracking-tight sm:text-3xl">
          {title}
        </h1>
        <p className="app-muted mx-auto mt-2 max-w-md text-sm leading-6">
          {description}
        </p>
      </header>
      <div className="p-6 sm:p-8">{children}</div>
    </section>
  );
}

function AuthField({ children, label }: { children: ReactNode; label: string }): JSX.Element {
  return (
    <label className="grid gap-2">
      <span className="app-text text-sm font-black">{label}</span>
      {children}
    </label>
  );
}

function AuthError({ message }: { message: string }): JSX.Element | null {
  if (!message) return null;
  return (
    <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700 dark:border-rose-800 dark:bg-rose-950/35 dark:text-rose-300">
      {message}
    </p>
  );
}

function AuthNotice({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div className="app-surface-muted app-border flex items-start gap-3 rounded-2xl border p-4">
      <FiUser className="app-accent-text mt-0.5 h-5 w-5 shrink-0" />
      <p className="app-text-soft text-sm font-semibold leading-6">{children}</p>
    </div>
  );
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback;
  const marker = "Error: ";
  const index = error.message.lastIndexOf(marker);
  return index >= 0 ? error.message.slice(index + marker.length) : error.message || fallback;
}
