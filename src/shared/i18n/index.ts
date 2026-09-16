import { useCallback } from 'react'
import i18n from 'i18next'
import { initReactI18next, useTranslation } from 'react-i18next'
import { en } from './locales/en'
import { ru } from './locales/ru'
import { tg } from './locales/tg'
import { translateTajikText } from './tajikText'

export const DEFAULT_LANGUAGE = 'ru'
export const LANGUAGE_STORAGE_KEY = 'hr-automation-language'

export const supportedLanguages = [
  {
    id: 'ru',
    labelKey: 'settings.language.options.ru',
    locale: 'ru-RU',
  },
  {
    id: 'en',
    labelKey: 'settings.language.options.en',
    locale: 'en-US',
  },
  {
    id: 'tg',
    labelKey: 'settings.language.options.tg',
    locale: 'tg-TJ',
  },
] as const

export type AppLanguage = (typeof supportedLanguages)[number]['id']

const resources = {
  ru: {
    translation: ru,
  },
  en: {
    translation: en,
  },
  tg: {
    translation: tg,
  },
} as const

export function isAppLanguage(value: string | null | undefined): value is AppLanguage {
  return supportedLanguages.some((language) => language.id === value)
}

export function getAppLocale(language: string | null | undefined): string {
  const normalizedLanguage = language?.split('-')[0]

  const languageConfig = supportedLanguages.find((item) => item.id === normalizedLanguage)
  return languageConfig?.locale ?? 'ru-RU'
}

export function useAppLocale(): string {
  const { i18n: instance } = useTranslation()
  return getAppLocale(instance.resolvedLanguage ?? instance.language)
}

export type AppText = (ru: string, en: string, tg?: string) => string

function resolveAppText(
  language: string,
  ru: string,
  en: string,
  tajik?: string,
): string {
  if (language === 'en') return en
  if (language === 'tg') return tajik ?? translateTajikText(ru)
  return ru
}

export function appText(ru: string, en: string, tajik?: string): string {
  const language = (i18n.resolvedLanguage ?? i18n.language).split('-')[0]
  return resolveAppText(language, ru, en, tajik)
}

export function useAppText(): AppText {
  const { i18n: instance } = useTranslation()
  const language = (instance.resolvedLanguage ?? instance.language).split('-')[0]

  return useCallback(
    (ru: string, en: string, tajik?: string) =>
      resolveAppText(language, ru, en, tajik),
    [language],
  )
}

function getStoredLanguage(): AppLanguage {
  if (typeof window === 'undefined') {
    return DEFAULT_LANGUAGE
  }

  const storedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY)
  return isAppLanguage(storedLanguage) ? storedLanguage : DEFAULT_LANGUAGE
}

void i18n.use(initReactI18next).init({
  resources,
  lng: getStoredLanguage(),
  fallbackLng: DEFAULT_LANGUAGE,
  supportedLngs: supportedLanguages.map((language) => language.id),
  interpolation: {
    escapeValue: false,
  },
  react: {
    useSuspense: false,
  },
})

function applyDocumentLanguage(language: string): void {
  if (typeof document === 'undefined') return
  const normalizedLanguage = language.split('-')[0]
  if (isAppLanguage(normalizedLanguage)) {
    document.documentElement.lang = normalizedLanguage
  }
}

applyDocumentLanguage(i18n.language)

i18n.on('languageChanged', (language) => {
  applyDocumentLanguage(language)

  if (typeof window === 'undefined') {
    return
  }

  const normalizedLanguage = language.split('-')[0]

  if (isAppLanguage(normalizedLanguage)) {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, normalizedLanguage)
  }
})

export { i18n }