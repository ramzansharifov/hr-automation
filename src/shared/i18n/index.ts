import { useCallback } from 'react'
import i18n from 'i18next'
import { initReactI18next, useTranslation } from 'react-i18next'
import { en } from './locales/en'
import { ru } from './locales/ru'

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
] as const

export type AppLanguage = (typeof supportedLanguages)[number]['id']

const resources = {
  ru: {
    translation: ru,
  },
  en: {
    translation: en,
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

export function useAppText(): (ru: string, en: string) => string {
  const { i18n: instance } = useTranslation()
  const language = (instance.resolvedLanguage ?? instance.language).split('-')[0]

  return useCallback(
    (ru: string, en: string) => (language === 'en' ? en : ru),
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