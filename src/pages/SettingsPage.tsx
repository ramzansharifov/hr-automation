import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import {
  FiCheck,
  FiDownload,
  FiGlobe,
  FiHardDrive,
  FiMonitor,
  FiMoon,
  FiSettings,
  FiSun,
} from "react-icons/fi";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";

import {
  accentColorOptions,
  themeOptions,
  useTheme,
  type ThemePreference,
} from "../app/themeContext";
import { useAuth } from "../features/auth/AuthContext";
import { getAppLocale, supportedLanguages } from "../shared/i18n";
import { hrApiClient } from "../shared/lib/hrApiClient";
import type { BackupInfo } from "../shared/types/hr";
import {
  ActionButton,
  ChoiceButton,
  ConfirmDialog,
  LoadingState,
  PageHeader,
} from "../shared/ui";

function getThemeIcon(theme: ThemePreference): typeof FiSun {
  if (theme === "dark") return FiMoon;
  if (theme === "system") return FiMonitor;
  return FiSun;
}

export function SettingsPage(): JSX.Element {
  const { i18n, t } = useTranslation();
  const { hasPermission, session } = useAuth();
  const { accentColor, resolvedTheme, setAccentColor, setTheme, theme } = useTheme();
  const currentLanguage = i18n.resolvedLanguage ?? i18n.language;
  const currentLocale = getAppLocale(currentLanguage);
  const canViewBackups =
    hasPermission("settings.backups_view") &&
    session.permissionScopes["settings.backups_view"] === "global";
  const canCreateBackup =
    hasPermission("settings.backups_create") &&
    session.permissionScopes["settings.backups_create"] === "global";
  const canRestoreBackup =
    hasPermission("settings.backups_restore") &&
    session.permissionScopes["settings.backups_restore"] === "global";
  const canOpenBackupsFolder =
    hasPermission("settings.backups_open_folder") &&
    session.permissionScopes["settings.backups_open_folder"] === "global";
  const canExportEmployees =
    hasPermission("employees.export") &&
    session.permissionScopes["employees.export"] === "global";
  const hasSystemTools =
    canViewBackups ||
    canCreateBackup ||
    canRestoreBackup ||
    canOpenBackupsFolder ||
    canExportEmployees;
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [isLoadingBackups, setIsLoadingBackups] = useState(false);
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<BackupInfo | null>(null);

  const loadBackups = useCallback(async (): Promise<void> => {
    if (!canViewBackups) return;
    setIsLoadingBackups(true);
    try {
      setBackups(await hrApiClient.listBackups());
    } catch (error) {
      toast.error(getErrorMessage(error, t("settings.administration.backups.loadError")));
    } finally {
      setIsLoadingBackups(false);
    }
  }, [canViewBackups, t]);

  useEffect(() => {
    void loadBackups();
  }, [loadBackups]);

  async function createBackup(): Promise<void> {
    if (!canCreateBackup) return;
    setIsCreatingBackup(true);
    try {
      const backup = await hrApiClient.createBackup();
      toast.success(t("settings.administration.backups.created", { name: backup.name }));
      if (canViewBackups) await loadBackups();
    } catch (error) {
      toast.error(getErrorMessage(error, t("settings.administration.backups.createError")));
    } finally {
      setIsCreatingBackup(false);
    }
  }

  async function restoreBackup(): Promise<void> {
    if (!restoreTarget || !canRestoreBackup) return;
    try {
      await hrApiClient.restoreBackup(restoreTarget.name);
      toast.info(t("settings.administration.backups.restored"));
      setRestoreTarget(null);
    } catch (error) {
      toast.error(getErrorMessage(error, t("settings.administration.backups.restoreError")));
    }
  }

  async function openBackupsFolder(): Promise<void> {
    if (!canOpenBackupsFolder) return;
    try {
      await hrApiClient.openBackupsFolder();
    } catch (error) {
      toast.error(getErrorMessage(error, t("settings.administration.backups.folderError")));
    }
  }

  async function exportEmployees(): Promise<void> {
    if (!canExportEmployees) return;
    try {
      const result = await hrApiClient.exportEmployeesCsv();
      if (!result.canceled) toast.success(t("settings.administration.export.success"));
    } catch (error) {
      toast.error(getErrorMessage(error, t("settings.administration.export.error")));
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<FiSettings />}
        meta={
          <span className="app-accent-soft inline-flex rounded-full border px-3 py-1 text-xs font-bold">
            {t(`settings.appearance.theme.palette.${resolvedTheme}`)}
          </span>
        }
        title={t("settings.title")}
      />

      <section className="grid gap-5 xl:grid-cols-2">
        <SettingsCard icon={<FiMonitor className="h-5 w-5" />} title={t("settings.appearance.theme.title")}>
          <div className="grid gap-3 sm:grid-cols-3">
            {themeOptions.map((option) => {
              const isSelected = theme === option.id;
              const Icon = getThemeIcon(option.id);
              return (
                <ChoiceButton
                  align="center"
                  key={option.id}
                  leading={<Icon />}
                  onClick={() => setTheme(option.id)}
                  selected={isSelected}
                >
                  {t(`settings.appearance.theme.options.${option.id}`)}
                </ChoiceButton>
              );
            })}
          </div>
        </SettingsCard>

        <SettingsCard icon={<FiSun className="h-5 w-5" />} title={t("settings.appearance.accent.title")}>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {accentColorOptions.map((option) => {
              const isSelected = accentColor === option.id;
              return (
                <ChoiceButton
                  align="between"
                  key={option.id}
                  leading={
                    <span
                      className="h-5 w-5 rounded-full border border-black/10 shadow-sm dark:border-white/20"
                      style={{ backgroundColor: option.value }}
                    />
                  }
                  onClick={() => setAccentColor(option.id)}
                  selected={isSelected}
                  trailing={isSelected ? <FiCheck /> : undefined}
                >
                  {t(`settings.appearance.accent.options.${option.id}`)}
                </ChoiceButton>
              );
            })}
          </div>
        </SettingsCard>

        <SettingsCard icon={<FiGlobe className="h-5 w-5" />} title={t("settings.language.title")}>
          <div className="flex flex-wrap gap-3">
            {supportedLanguages.map((language) => {
              const isSelected = currentLanguage.split("-")[0] === language.id;
              return (
                <ChoiceButton
                  align="center"
                  className="min-w-32"
                  key={language.id}
                  onClick={() => void i18n.changeLanguage(language.id)}
                  selected={isSelected}
                  trailing={isSelected ? <FiCheck /> : undefined}
                >
                  {t(language.labelKey)}
                </ChoiceButton>
              );
            })}
          </div>
        </SettingsCard>
      </section>

      {hasSystemTools && (
        <section className="space-y-5">
          <div>
            <p className="app-accent-text text-xs font-black uppercase tracking-[0.16em]">{t("settings.administration.eyebrow")}</p>
            <h2 className="app-text mt-1 text-2xl font-black">{t("settings.administration.title")}</h2>
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.5fr)]">
            {(canViewBackups || canCreateBackup || canRestoreBackup || canOpenBackupsFolder) && (
              <SettingsCard icon={<FiHardDrive className="h-5 w-5" />} title={t("settings.administration.backups.title")}>
                <div className="mb-5 flex flex-wrap gap-3">
                  {canCreateBackup && (
                    <ActionButton
                      action="backup"
                      loading={isCreatingBackup}
                      onClick={() => void createBackup()}
                    >
                      {t("settings.administration.backups.create")}
                    </ActionButton>
                  )}
                  {canOpenBackupsFolder && (
                    <ActionButton
                      action="folderOpen"
                      onClick={() => void openBackupsFolder()}
                    />
                  )}
                  {canViewBackups && (
                    <ActionButton
                      action="refresh"
                      loading={isLoadingBackups}
                      onClick={() => void loadBackups()}
                    />
                  )}
                </div>

                {canViewBackups ? (
                  isLoadingBackups ? (
                    <LoadingState label={t("settings.administration.backups.loading")} />
                  ) : backups.length === 0 ? (
                    <div className="app-surface-muted app-muted rounded-2xl border border-dashed p-6 text-center text-sm">
                      {t("settings.administration.backups.empty")}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {backups.map((backup) => (
                        <div
                          className="app-surface-muted app-border flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between"
                          key={backup.name}
                        >
                          <div className="min-w-0">
                            <p className="app-text truncate text-sm font-black">{backup.name}</p>
                            <p className="app-muted mt-1 text-xs font-bold">
                              {new Date(backup.createdAt).toLocaleString(currentLocale)} · {formatBytes(backup.sizeBytes, currentLocale)}
                            </p>
                          </div>
                          {canRestoreBackup && (
                            <ActionButton
                              action="restore"
                              onClick={() => setRestoreTarget(backup)}
                              size="sm"
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  )
                ) : (
                  <p className="app-muted text-sm">
                    {t("settings.administration.backups.listUnavailable")}
                  </p>
                )}
              </SettingsCard>
            )}

            {canExportEmployees && (
              <SettingsCard icon={<FiDownload className="h-5 w-5" />} title={t("settings.administration.export.title")}>
                <ActionButton
                  action="export"
                  className="w-full"
                  onClick={() => void exportEmployees()}
                >
                  {t("settings.administration.export.employees")}
                </ActionButton>
              </SettingsCard>
            )}
          </div>
        </section>
      )}

      {canRestoreBackup && (
        <ConfirmDialog
          cancelLabel={t("common.actions.cancel")}
          confirmAction="restore"
          confirmLabel={t("settings.administration.backups.restoreConfirm")}
          confirmVariant="danger"
          description={
            restoreTarget
              ? t("settings.administration.backups.restoreDescription", {
                  name: restoreTarget.name,
                })
              : ""
          }
          onConfirm={() => void restoreBackup()}
          onOpenChange={(open) => {
            if (!open) setRestoreTarget(null);
          }}
          open={Boolean(restoreTarget)}
          title={t("settings.administration.backups.restoreTitle")}
        />
      )}
    </div>
  );
}

function SettingsCard({
  children,
  icon,
  title,
}: {
  children: ReactNode;
  icon: ReactNode;
  title: string;
}): JSX.Element {
  return (
    <section className="app-surface app-border rounded-[28px] border p-6">
      <header className="mb-5 flex items-center gap-3">
        <span className="app-accent-soft flex h-11 w-11 items-center justify-center rounded-2xl border">{icon}</span>
        <h2 className="app-text text-xl font-black">{title}</h2>
      </header>
      {children}
    </section>
  );
}

function formatBytes(value: number, locale: string): string {
  const format = (amount: number): string =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(amount);
  if (value < 1024) return `${format(value)} B`;
  if (value < 1024 * 1024) return `${format(value / 1024)} KB`;
  return `${format(value / 1024 / 1024)} MB`;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback;
  const parts = error.message.split("Error: ");
  return parts[parts.length - 1] || fallback;
}
