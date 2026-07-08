import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export type ThemePreference = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'
export type AccentColor = 'blue' | 'indigo' | 'emerald' | 'violet' | 'rose' | 'amber'

interface AccentColorOption {
  id: AccentColor
  label: string
  value: string
}

interface ThemeContextValue {
  theme: ThemePreference
  resolvedTheme: ResolvedTheme
  accentColor: AccentColor
  setTheme: (theme: ThemePreference) => void
  setAccentColor: (accentColor: AccentColor) => void
}

const THEME_STORAGE_KEY = 'hr-automation-theme'
const ACCENT_STORAGE_KEY = 'hr-automation-accent'

export const themeOptions: Array<{ id: ThemePreference; label: string }> = [
  { id: 'light', label: 'Светлая' },
  { id: 'dark', label: 'Темная' },
  { id: 'system', label: 'Системная' },
]

export const accentColorOptions: AccentColorOption[] = [
  { id: 'blue', label: 'Синий', value: '#2563eb' },
  { id: 'indigo', label: 'Индиго', value: '#4f46e5' },
  { id: 'emerald', label: 'Изумруд', value: '#059669' },
  { id: 'violet', label: 'Фиолетовый', value: '#7c3aed' },
  { id: 'rose', label: 'Розовый', value: '#e11d48' },
  { id: 'amber', label: 'Янтарный', value: '#d97706' },
]

const ThemeContext = createContext<ThemeContextValue | null>(null)

function isThemePreference(value: string | null): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system'
}

function isAccentColor(value: string | null): value is AccentColor {
  return accentColorOptions.some((option) => option.id === value)
}

function getStoredTheme(): ThemePreference {
  if (typeof window === 'undefined') {
    return 'system'
  }

  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY)
  return isThemePreference(storedTheme) ? storedTheme : 'system'
}

function getStoredAccentColor(): AccentColor {
  if (typeof window === 'undefined') {
    return 'blue'
  }

  const storedAccentColor = window.localStorage.getItem(ACCENT_STORAGE_KEY)
  return isAccentColor(storedAccentColor) ? storedAccentColor : 'blue'
}

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') {
    return 'light'
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function resolveTheme(theme: ThemePreference): ResolvedTheme {
  return theme === 'system' ? getSystemTheme() : theme
}

interface ThemeProviderProps {
  children: ReactNode
}

export function ThemeProvider({ children }: ThemeProviderProps): JSX.Element {
  const [theme, setTheme] = useState<ThemePreference>(getStoredTheme)
  const [accentColor, setAccentColor] = useState<AccentColor>(getStoredAccentColor)
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(getSystemTheme)
  const resolvedTheme = theme === 'system' ? systemTheme : theme

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

    function handleChange(event: MediaQueryListEvent): void {
      setSystemTheme(event.matches ? 'dark' : 'light')
    }

    setSystemTheme(mediaQuery.matches ? 'dark' : 'light')
    mediaQuery.addEventListener('change', handleChange)

    return () => {
      mediaQuery.removeEventListener('change', handleChange)
    }
  }, [])

  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = resolvedTheme
    root.dataset.accent = accentColor
    root.style.colorScheme = resolvedTheme
  }, [accentColor, resolvedTheme])

  useEffect(() => {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  }, [theme])

  useEffect(() => {
    window.localStorage.setItem(ACCENT_STORAGE_KEY, accentColor)
  }, [accentColor])

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      resolvedTheme,
      accentColor,
      setTheme,
      setAccentColor,
    }),
    [accentColor, resolvedTheme, theme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)

  if (!context) {
    throw new Error('useTheme must be used inside ThemeProvider')
  }

  return context
}

export function getResolvedTheme(theme: ThemePreference): ResolvedTheme {
  return resolveTheme(theme)
}
