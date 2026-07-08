import { FiCheck, FiMonitor, FiMoon, FiSun } from 'react-icons/fi'
import {
  accentColorOptions,
  themeOptions,
  useTheme,
  type ThemePreference,
} from '../app/theme'

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
  const { accentColor, resolvedTheme, setAccentColor, setTheme, theme } = useTheme()

  return (
    <div className="space-y-6">
      <h1 className="app-text text-3xl font-black tracking-tight">Настройки</h1>

      <section className="app-surface app-shadow rounded-[28px] border p-7">
        <div>
          <h2 className="app-text text-xl font-black">Внешний вид</h2>
          <p className="app-muted mt-2 text-sm">
            Тема и акцент применяются ко всему интерфейсу и сохраняются локально.
          </p>
        </div>

        <div className="mt-6 grid gap-5 xl:grid-cols-[1fr_1.15fr]">
          <div className="app-surface-muted rounded-2xl p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="app-text text-sm font-bold">Тема</p>
                <p className="app-muted mt-1 text-sm">
                  Сейчас активна {resolvedTheme === 'dark' ? 'темная' : 'светлая'} палитра.
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
                    {option.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="app-surface-muted rounded-2xl p-5">
            <p className="app-text text-sm font-bold">Акцентный цвет</p>
            <p className="app-muted mt-1 text-sm">
              Используется для активной навигации, кнопок, ссылок и выделений.
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
                      <span className="truncate">{option.label}</span>
                    </span>

                    {isSelected && <FiCheck className="app-accent-text h-4 w-4 shrink-0" />}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="app-surface app-shadow rounded-[28px] border p-7">
        <h2 className="app-text text-xl font-black">Система</h2>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="app-surface-muted rounded-2xl p-5">
            <p className="app-text text-sm font-bold">База данных</p>
            <p className="app-muted mt-2 text-sm">
              SQLite подключена через Electron backend.
            </p>
          </div>

          <div className="app-surface-muted rounded-2xl p-5">
            <p className="app-text text-sm font-bold">Интерфейс</p>
            <p className="app-muted mt-2 text-sm">
              Настройки оформления применяются без перезапуска приложения.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
