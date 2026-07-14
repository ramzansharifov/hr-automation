import type { ReactNode } from 'react'
import { FiCheck, FiGlobe, FiMonitor, FiMoon, FiSettings, FiSun } from 'react-icons/fi'
import { useTranslation } from 'react-i18next'

import {
  accentColorOptions,
  themeOptions,
  useTheme,
  type ThemePreference,
} from '../app/themeContext'
import { supportedLanguages } from '../shared/i18n'

function getThemeIcon(theme: ThemePreference): typeof FiSun {
  if (theme === 'dark') return FiMoon
  if (theme === 'system') return FiMonitor
  return FiSun
}

export function SettingsPage(): JSX.Element {
  const { i18n, t } = useTranslation()
  const { accentColor, resolvedTheme, setAccentColor, setTheme, theme } = useTheme()
  const currentLanguage = i18n.resolvedLanguage ?? i18n.language

  return (
    <div className="space-y-6">
      <section className="app-accent-gradient-panel flex items-center gap-4 overflow-hidden rounded-[28px] border p-6 sm:p-7">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-white backdrop-blur">
          <FiSettings className="h-6 w-6" />
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-3xl font-black tracking-tight text-white sm:text-4xl">
            {t('settings.title')}
          </h1>
          <span className="mt-2 inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-bold text-white/80">
            {t(`settings.appearance.theme.palette.${resolvedTheme}`)}
          </span>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <SettingsCard icon={<FiMonitor className="h-5 w-5" />} title={t('settings.appearance.theme.title')}>
          <div className="grid gap-3 sm:grid-cols-3">
            {themeOptions.map((option) => {
              const isSelected = theme === option.id
              const Icon = getThemeIcon(option.id)

              return (
                <button
                  className={[
                    'flex h-12 items-center justify-center gap-2 rounded-2xl border px-4 text-sm font-bold transition',
                    isSelected ? 'app-accent app-accent-border shadow-lg' : 'app-button-secondary',
                  ].join(' ')}
                  key={option.id}
                  onClick={() => setTheme(option.id)}
                  type="button"
                >
                  <Icon className="h-4 w-4" />
                  {t(`settings.appearance.theme.options.${option.id}`)}
                </button>
              )
            })}
          </div>
        </SettingsCard>

        <SettingsCard icon={<FiSun className="h-5 w-5" />} title={t('settings.appearance.accent.title')}>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {accentColorOptions.map((option) => {
              const isSelected = accentColor === option.id

              return (
                <button
                  className={[
                    'app-surface flex h-12 items-center justify-between gap-3 rounded-2xl border px-4 text-sm font-bold shadow-none transition',
                    isSelected ? 'app-accent-border' : 'app-border app-hover-muted',
                  ].join(' ')}
                  key={option.id}
                  onClick={() => setAccentColor(option.id)}
                  type="button"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span
                      className="h-5 w-5 shrink-0 rounded-full border border-white/40 shadow-sm"
                      style={{ backgroundColor: option.value }}
                    />
                    <span className="truncate">
                      {t(`settings.appearance.accent.options.${option.id}`)}
                    </span>
                  </span>
                  {isSelected && <FiCheck className="app-accent-text h-4 w-4 shrink-0" />}
                </button>
              )
            })}
          </div>
        </SettingsCard>

        <SettingsCard icon={<FiGlobe className="h-5 w-5" />} title={t('settings.language.title')}>
          <div className="flex flex-wrap gap-3">
            {supportedLanguages.map((language) => {
              const isSelected = currentLanguage.split('-')[0] === language.id

              return (
                <button
                  className={[
                    'flex h-12 min-w-32 items-center justify-center gap-2 rounded-2xl border px-4 text-sm font-bold transition',
                    isSelected ? 'app-accent app-accent-border shadow-lg' : 'app-button-secondary',
                  ].join(' ')}
                  key={language.id}
                  onClick={() => void i18n.changeLanguage(language.id)}
                  type="button"
                >
                  {t(language.labelKey)}
                  {isSelected && <FiCheck className="h-4 w-4 shrink-0" />}
                </button>
              )
            })}
          </div>
        </SettingsCard>

        <SettingsCard icon={<FiSettings className="h-5 w-5" />} title={t('settings.system.title')}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="app-surface-muted app-border rounded-2xl border p-4">
              <p className="app-text text-sm font-black">{t('settings.system.database.title')}</p>
            </div>
            <div className="app-surface-muted app-border rounded-2xl border p-4">
              <p className="app-text text-sm font-black">{t('settings.system.interface.title')}</p>
            </div>
          </div>
        </SettingsCard>
      </section>
    </div>
  )
}

function SettingsCard({
  children,
  icon,
  title,
}: {
  children: ReactNode
  icon: ReactNode
  title: string
}): JSX.Element {
  return (
    <section className="app-surface app-border rounded-[28px] border p-6">
      <header className="mb-5 flex items-center gap-3">
        <span className="app-accent-soft flex h-11 w-11 items-center justify-center rounded-2xl border">
          {icon}
        </span>
        <h2 className="app-text text-xl font-black">{title}</h2>
      </header>
      {children}
    </section>
  )
}
