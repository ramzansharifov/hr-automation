import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  ACCENT_STORAGE_KEY,
  THEME_STORAGE_KEY,
  ThemeContext,
  isAccentColor,
  isThemePreference,
  type AccentColor,
  type ResolvedTheme,
  type ThemeContextValue,
  type ThemePreference,
} from './themeContext'

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
