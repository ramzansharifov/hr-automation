import { createContext, useContext } from 'react'

export type ThemePreference = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'
export type AccentColor = 'blue' | 'indigo' | 'emerald' | 'violet' | 'rose' | 'amber'

interface AccentColorOption {
  id: AccentColor
  label: string
  value: string
}

export interface ThemeContextValue {
  theme: ThemePreference
  resolvedTheme: ResolvedTheme
  accentColor: AccentColor
  setTheme: (theme: ThemePreference) => void
  setAccentColor: (accentColor: AccentColor) => void
}

export const THEME_STORAGE_KEY = 'hr-automation-theme'
export const ACCENT_STORAGE_KEY = 'hr-automation-accent'

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

export const ThemeContext = createContext<ThemeContextValue | null>(null)

export function isThemePreference(value: string | null): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system'
}

export function isAccentColor(value: string | null): value is AccentColor {
  return accentColorOptions.some((option) => option.id === value)
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)

  if (!context) {
    throw new Error('useTheme must be used inside ThemeProvider')
  }

  return context
}
