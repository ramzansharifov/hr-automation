import { useCallback, useEffect, useState, type ReactNode } from "react";
import { FiCheck, FiKey, FiLock, FiLogIn } from "react-icons/fi";
import { useTranslation } from "react-i18next";

import { HRLogo } from "../../app/brand/HRLogo";
import { supportedLanguages, useAppText } from "../../shared/i18n";
import { hrApiClient } from "../../shared/lib/hrApiClient";
import type { AuthSession, AuthState } from "../../shared/types/access";
import { ActionButton, Input, LoadingState } from "../../shared/ui";
import { AuthContext } from "./AuthContext";

const initialState: AuthState = {
  isInitialized: true,
  session: null,
};

export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const text = useAppText();
  const [authState, setAuthState] = useState<AuthState>(initialState);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const refreshState = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      setAuthState(await hrApiClient.getAuthState());
    } catch (loadError) {
      setError(getErrorMessage(loadError, text("Не удалось проверить состояние входа", "Failed to check sign-in state")));
    } finally {
      setIsLoading(false);
    }
  }, [text]);

  useEffect(() => {
    void refreshState();
  }, [refreshState]);

  if (isLoading) {
    return (
      <AuthShell>
        <LoadingState label={text("Проверка доступа...", "Checking access...")} />
      </AuthShell>
    );
  }

  if (error) {
    return (
      <AuthShell>
        <AuthCard
          icon={<FiLock />}
          title={text("Не удалось открыть систему", "Unable to open the system")}
          description={error}
        >
          <ActionButton action="refresh" onClick={() => void refreshState()}>{text("Повторить", "Retry")}</ActionButton>
        </AuthCard>
      </AuthShell>
    );
  }

  if (!authState.isInitialized) {
    return (
      <AuthShell>
        <AuthCard
          icon={<FiLock />}
          title={text("Системный администратор не создан", "System administrator is not initialized")}
          description={text(
            "Не удалось найти встроенную учётную запись superadmin. Перезапустите приложение, чтобы повторно применить миграции базы данных.",
            "The built-in superadmin account could not be found. Restart the application to reapply database migrations.",
          )}
        >
          <ActionButton action="refresh" onClick={() => void refreshState()}>{text("Проверить снова", "Check again")}</ActionButton>
        </AuthCard>
      </AuthShell>
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
        hasEffectivePermission: (permissionCode) =>
          Boolean(session.permissionScopes[permissionCode]),
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

function LoginScreen({
  onAuthenticated,
}: {
  onAuthenticated: (session: AuthSession) => void;
}): JSX.Element {
  const text = useAppText();
  const [username, setUsername] = useState("superadmin");
  const [password, setPassword] = useState("superadmin");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function submit(): Promise<void> {
    setIsSaving(true);
    setError("");
    try {
      onAuthenticated(await hrApiClient.login({ username, password }));
    } catch (loginError) {
      setError(getErrorMessage(loginError, text("Не удалось войти", "Failed to sign in")));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <AuthShell>
      <AuthCard
        icon={<FiLogIn />}
        title={text("Вход в HR Automation", "Sign in to HR Automation")}
        description={text(
          "Системный администратор не является сотрудником. Для входа используйте готовую учётную запись superadmin.",
          "The system administrator is not an employee. Use the built-in superadmin account to sign in.",
        )}
      >
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <div className="app-surface-muted app-border rounded-2xl border px-4 py-3 text-sm font-semibold">
            <span className="app-muted">{text("Логин и пароль по умолчанию:", "Default username and password:")}</span>{" "}
            <span className="app-text font-black">superadmin / superadmin</span>
          </div>
          <AuthField label={text("Логин", "Username")}>
            <Input
              autoComplete="username"
              autoFocus
              onChange={(event) => setUsername(event.target.value)}
              value={username}
            />
          </AuthField>
          <AuthField label={text("Пароль", "Password")}>
            <Input
              autoComplete="current-password"
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              value={password}
            />
          </AuthField>
          <AuthError message={error} />
          <ActionButton
            action="login"
            disabled={!username || !password}
            loading={isSaving}
            type="submit"
          />
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
  const text = useAppText();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function submit(): Promise<void> {
    setError("");
    if (newPassword !== confirmPassword) {
      setError(text("Новые пароли не совпадают", "The new passwords do not match"));
      return;
    }
    setIsSaving(true);
    try {
      onChanged(
        await hrApiClient.changeOwnPassword({ currentPassword, newPassword }),
      );
    } catch (changeError) {
      setError(getErrorMessage(changeError, text("Не удалось изменить пароль", "Failed to change password")));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <AuthShell>
      <AuthCard
        icon={<FiKey />}
        title={text("Смените временный пароль", "Change your temporary password")}
        description={text(
          `Пользователь @${session.username} должен установить постоянный пароль перед началом работы.`,
          `User @${session.username} must set a permanent password before continuing.`,
        )}
      >
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <AuthField label={text("Текущий временный пароль", "Current temporary password")}>
            <Input
              autoComplete="current-password"
              onChange={(event) => setCurrentPassword(event.target.value)}
              type="password"
              value={currentPassword}
            />
          </AuthField>
          <AuthField label={text("Новый пароль", "New password")}>
            <Input
              autoComplete="new-password"
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder={text("Минимум 8 символов, буква и цифра", "At least 8 characters, including a letter and a number")}
              type="password"
              value={newPassword}
            />
          </AuthField>
          <AuthField label={text("Повторите новый пароль", "Confirm new password")}>
            <Input
              autoComplete="new-password"
              onChange={(event) => setConfirmPassword(event.target.value)}
              type="password"
              value={confirmPassword}
            />
          </AuthField>
          <AuthError message={error} />
          <ActionButton
            action="save"
            disabled={!currentPassword || !newPassword}
            loading={isSaving}
            type="submit"
          >
            {text("Сохранить новый пароль", "Save new password")}
          </ActionButton>
        </form>
      </AuthCard>
    </AuthShell>
  );
}

function AuthShell({ children }: { children: ReactNode }): JSX.Element {
  const { i18n, t } = useTranslation();
  const currentLanguage = (i18n.resolvedLanguage ?? i18n.language).split("-")[0];

  return (
    <main className="app-page flex min-h-screen items-center justify-center overflow-hidden px-5 py-10">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_20%_15%,color-mix(in_srgb,var(--accent)_10%,transparent),transparent_34%),radial-gradient(circle_at_85%_80%,color-mix(in_srgb,var(--accent-border)_10%,transparent),transparent_36%)]" />
      <div className="absolute right-5 top-5 z-20 flex gap-2">
        {supportedLanguages.map((language) => {
          const selected = currentLanguage === language.id;
          return (
            <button
              aria-pressed={selected}
              className={[
                "app-border flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-black transition",
                selected
                  ? "app-accent-soft app-accent-text"
                  : "app-surface app-muted hover:text-[var(--color-text)]",
              ].join(" ")}
              key={language.id}
              onClick={() => void i18n.changeLanguage(language.id)}
              type="button"
            >
              {selected ? <FiCheck className="h-3.5 w-3.5" /> : null}
              {t(language.labelKey)}
            </button>
          );
        })}
      </div>
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

function AuthField({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}): JSX.Element {
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

function getErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback;
  const marker = "Error: ";
  const index = error.message.lastIndexOf(marker);
  return index >= 0
    ? error.message.slice(index + marker.length)
    : error.message || fallback;
}
