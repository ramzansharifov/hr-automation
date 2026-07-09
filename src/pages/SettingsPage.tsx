import { FiCheck, FiMonitor, FiMoon, FiSun } from 'react-icons/fi'
import { useTranslation } from 'react-i18next'
import {
  accentColorOptions,
  themeOptions,
  useTheme,
  type ThemePreference,
} from '../app/themeContext'
import { supportedLanguages } from '../shared/i18n'

function getThemeIcon(theme: ThemePreference): typeof FiSun {
  if (theme === 'dark') {
    return FiMoon
  }

  if (theme === 'system') {
    return FiMonitor
  }

  return FiSun
}

export function SettingsPage(): JSX.Element {
  const { i18n, t } = useTranslation()
  const { accentColor, resolvedTheme, setAccentColor, setTheme, theme } = useTheme()
  const currentLanguage = i18n.resolvedLanguage ?? i18n.language

  return (
    <div className="space-y-6">
      <h1 className="app-text text-3xl font-black tracking-tight">{t('settings.title')}</h1>

      <section className="app-surface app-shadow rounded-[28px] border p-7">
        <div>
          <h2 className="app-text text-xl font-black">{t('settings.appearance.title')}</h2>
          <p className="app-muted mt-2 text-sm">
            {t('settings.appearance.description')}
          </p>
        </div>

        <div className="mt-6 grid gap-5 xl:grid-cols-[1fr_1.15fr]">
          <div className="app-surface-muted rounded-2xl p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="app-text text-sm font-bold">{t('settings.appearance.theme.title')}</p>
                <p className="app-muted mt-1 text-sm">
                  {t('settings.appearance.theme.currentPalette', {
                    palette: t(`settings.appearance.theme.palette.${resolvedTheme}`),
                  })}
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {themeOptions.map((option) => {
                const isSelected = theme === option.id
                const Icon = getThemeIcon(option.id)

                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setTheme(option.id)}
                    className={[
                      'flex h-12 items-center justify-center gap-2 rounded-2xl border px-4 text-sm font-bold transition',
                      isSelected
                        ? 'app-accent app-accent-border'
                        : 'app-button-secondary',
                    ].join(' ')}
                  >
                    <Icon className="h-4 w-4" />
                    {t(`settings.appearance.theme.options.${option.id}`)}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="app-surface-muted rounded-2xl p-5">
            <p className="app-text text-sm font-bold">{t('settings.appearance.accent.title')}</p>
            <p className="app-muted mt-1 text-sm">
              {t('settings.appearance.accent.description')}
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {accentColorOptions.map((option) => {
                const isSelected = accentColor === option.id

                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setAccentColor(option.id)}
                    className={[
                      'app-surface flex h-12 items-center justify-between gap-3 rounded-2xl border px-4 text-sm font-bold transition',
                      isSelected ? 'app-accent-border' : 'app-border app-hover-muted',
                    ].join(' ')}
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
          </div>
        </div>

        <div className="app-surface-muted mt-5 rounded-2xl p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="app-text text-sm font-bold">{t('settings.language.title')}</p>
              <p className="app-muted mt-1 text-sm">{t('settings.language.description')}</p>
            </div>

            <div className="flex flex-wrap gap-3">
              {supportedLanguages.map((language) => {
                const isSelected = currentLanguage.split('-')[0] === language.id

                return (
                  <button
                    key={language.id}
                    type="button"
                    onClick={() => void i18n.changeLanguage(language.id)}
                    className={[
                      'flex h-12 items-center justify-center gap-2 rounded-2xl border px-4 text-sm font-bold transition',
                      isSelected ? 'app-accent app-accent-border' : 'app-button-secondary',
                    ].join(' ')}
                  >
                    {t(language.labelKey)}
                    {isSelected && <FiCheck className="h-4 w-4 shrink-0" />}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="app-surface app-shadow rounded-[28px] border p-7">
        <h2 className="app-text text-xl font-black">{t('settings.system.title')}</h2>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="app-surface-muted rounded-2xl p-5">
            <p className="app-text text-sm font-bold">{t('settings.system.database.title')}</p>
            <p className="app-muted mt-2 text-sm">
              {t('settings.system.database.description')}
            </p>
          </div>

          <div className="app-surface-muted rounded-2xl p-5">
            <p className="app-text text-sm font-bold">{t('settings.system.interface.title')}</p>
            <p className="app-muted mt-2 text-sm">
              {t('settings.system.interface.description')}
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
