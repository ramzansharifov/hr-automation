import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import {
  FiArchive,
  FiCheck,
  FiDatabase,
  FiDownload,
  FiFolder,
  FiGlobe,
  FiHardDrive,
  FiMonitor,
  FiMoon,
  FiRefreshCw,
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
import { supportedLanguages } from "../shared/i18n";
import { hrApiClient } from "../shared/lib/hrApiClient";
import type { BackupInfo } from "../shared/types/hr";
import { Button, ConfirmDialog, LoadingState, PageHeader } from "../shared/ui";

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
  const canManageSystem = hasPermission("settings.manage");
  const canExportEmployees =
    session.permissionScopes["employees.view"] === "global";
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [isLoadingBackups, setIsLoadingBackups] = useState(false);
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<BackupInfo | null>(null);

  const loadBackups = useCallback(async (): Promise<void> => {
    if (!canManageSystem) return;
    setIsLoadingBackups(true);
    try {
      setBackups(await hrApiClient.listBackups());
    } catch (error) {
      toast.error(getErrorMessage(error, "Не удалось загрузить резервные копии"));
    } finally {
      setIsLoadingBackups(false);
    }
  }, [canManageSystem]);

  useEffect(() => {
    void loadBackups();
  }, [loadBackups]);

  async function createBackup(): Promise<void> {
    setIsCreatingBackup(true);
    try {
      const backup = await hrApiClient.createBackup();
      toast.success(`Резервная копия создана: ${backup.name}`);
      await loadBackups();
    } catch (error) {
      toast.error(getErrorMessage(error, "Не удалось создать резервную копию"));
    } finally {
      setIsCreatingBackup(false);
    }
  }

  async function restoreBackup(): Promise<void> {
    if (!restoreTarget) return;
    try {
      await hrApiClient.restoreBackup(restoreTarget.name);
      toast.info("База восстановлена. Приложение будет перезапущено.");
      setRestoreTarget(null);
    } catch (error) {
      toast.error(getErrorMessage(error, "Не удалось восстановить резервную копию"));
    }
  }

  async function exportEmployees(): Promise<void> {
    try {
      const result = await hrApiClient.exportEmployeesCsv();
      if (!result.canceled) toast.success("Реестр сотрудников экспортирован");
    } catch (error) {
      toast.error(getErrorMessage(error, "Не удалось экспортировать сотрудников"));
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        description={
          <>Личные параметры интерфейса{canManageSystem ? " и системные инструменты администратора" : ""}.</>
        }
        icon={<FiSettings />}
        meta={
          <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-bold text-white/80">
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
                <button
                  className={[
                    "flex h-12 items-center justify-center gap-2 rounded-2xl border px-4 text-sm font-bold transition",
                    isSelected ? "app-accent app-accent-border shadow-lg" : "app-button-secondary",
                  ].join(" ")}
                  key={option.id}
                  onClick={() => setTheme(option.id)}
                  type="button"
                >
                  <Icon className="h-4 w-4" />
                  {t(`settings.appearance.theme.options.${option.id}`)}
                </button>
              );
            })}
          </div>
        </SettingsCard>

        <SettingsCard icon={<FiSun className="h-5 w-5" />} title={t("settings.appearance.accent.title")}>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {accentColorOptions.map((option) => {
              const isSelected = accentColor === option.id;
              return (
                <button
                  className={[
                    "app-surface flex h-12 items-center justify-between gap-3 rounded-2xl border px-4 text-sm font-bold transition",
                    isSelected ? "app-accent-border" : "app-border app-hover-muted",
                  ].join(" ")}
                  key={option.id}
                  onClick={() => setAccentColor(option.id)}
                  type="button"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span
                      className="h-5 w-5 shrink-0 rounded-full border border-white/40 shadow-sm"
                      style={{ backgroundColor: option.value }}
                    />
                    <span className="truncate">{t(`settings.appearance.accent.options.${option.id}`)}</span>
                  </span>
                  {isSelected && <FiCheck className="app-accent-text h-4 w-4 shrink-0" />}
                </button>
              );
            })}
          </div>
        </SettingsCard>

        <SettingsCard icon={<FiGlobe className="h-5 w-5" />} title={t("settings.language.title")}>
          <div className="flex flex-wrap gap-3">
            {supportedLanguages.map((language) => {
              const isSelected = currentLanguage.split("-")[0] === language.id;
              return (
                <button
                  className={[
                    "flex h-12 min-w-32 items-center justify-center gap-2 rounded-2xl border px-4 text-sm font-bold transition",
                    isSelected ? "app-accent app-accent-border shadow-lg" : "app-button-secondary",
                  ].join(" ")}
                  key={language.id}
                  onClick={() => void i18n.changeLanguage(language.id)}
                  type="button"
                >
                  {t(language.labelKey)}
                  {isSelected && <FiCheck className="h-4 w-4 shrink-0" />}
                </button>
              );
            })}
          </div>
        </SettingsCard>

        <SettingsCard icon={<FiDatabase className="h-5 w-5" />} title="О приложении">
          <div className="grid gap-3 sm:grid-cols-2">
            <InfoItem label="Хранение данных" value="Локальная SQLite база" />
            <InfoItem label="Режим" value="HR — без бухгалтерских начислений" />
          </div>
        </SettingsCard>
      </section>

      {canManageSystem && (
        <section className="space-y-5">
          <div>
            <p className="app-accent-text text-xs font-black uppercase tracking-[0.16em]">Superadmin</p>
            <h2 className="app-text mt-1 text-2xl font-black">Системное администрирование</h2>
            <p className="app-muted mt-2 max-w-3xl text-sm leading-6">
              Резервные копии и переносимые выгрузки кадровых данных. Восстановление полностью заменяет текущую базу выбранной копией и перезапускает приложение.
            </p>
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.5fr)]">
            <SettingsCard icon={<FiHardDrive className="h-5 w-5" />} title="Резервные копии">
              <div className="mb-5 flex flex-wrap gap-3">
                <Button
                  disabled={isCreatingBackup}
                  leftIcon={<FiArchive className="h-4 w-4" />}
                  onClick={() => void createBackup()}
                >
                  {isCreatingBackup ? "Создание..." : "Создать копию"}
                </Button>
                <Button
                  leftIcon={<FiFolder className="h-4 w-4" />}
                  onClick={() => void hrApiClient.openBackupsFolder()}
                  variant="secondary"
                >
                  Открыть папку
                </Button>
                <Button
                  leftIcon={<FiRefreshCw className={isLoadingBackups ? "animate-spin" : ""} />}
                  onClick={() => void loadBackups()}
                  variant="ghost"
                >
                  Обновить
                </Button>
              </div>

              {isLoadingBackups ? (
                <LoadingState label="Загрузка резервных копий..." />
              ) : backups.length === 0 ? (
                <div className="app-surface-muted app-muted rounded-2xl border border-dashed p-6 text-center text-sm">
                  Резервных копий пока нет.
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
                          {new Date(backup.createdAt).toLocaleString("ru-RU")} · {formatBytes(backup.sizeBytes)}
                        </p>
                      </div>
                      <Button onClick={() => setRestoreTarget(backup)} variant="secondary">
                        Восстановить
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </SettingsCard>

            <SettingsCard icon={<FiDownload className="h-5 w-5" />} title="Экспорт">
              <p className="app-muted mb-4 text-sm leading-6">
                Выгрузка реестра сотрудников в CSV для резервного просмотра и внешней обработки.
              </p>
              {canExportEmployees ? (
                <Button className="w-full" leftIcon={<FiDownload />} onClick={() => void exportEmployees()}>
                  Экспортировать сотрудников
                </Button>
              ) : (
                <p className="app-muted text-sm">
                  Для экспорта требуется глобальное право просмотра сотрудников.
                </p>
              )}
            </SettingsCard>
          </div>
        </section>
      )}

      <ConfirmDialog
        cancelLabel="Отмена"
        confirmLabel="Восстановить базу"
        description={
          restoreTarget
            ? `Текущая база будет заменена копией «${restoreTarget.name}». После восстановления приложение автоматически перезапустится.`
            : ""
        }
        onConfirm={() => void restoreBackup()}
        onOpenChange={(open) => {
          if (!open) setRestoreTarget(null);
        }}
        open={Boolean(restoreTarget)}
        title="Восстановить резервную копию?"
      />
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

function InfoItem({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="app-surface-muted app-border rounded-2xl border p-4">
      <p className="app-muted text-xs font-bold uppercase tracking-wide">{label}</p>
      <p className="app-text mt-1 text-sm font-black">{value}</p>
    </div>
  );
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} Б`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} КБ`;
  return `${(value / 1024 / 1024).toFixed(1)} МБ`;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback;
  const parts = error.message.split("Error: ");
  return parts[parts.length - 1] || fallback;
}