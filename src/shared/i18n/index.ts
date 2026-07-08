import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { ru } from './locales/ru'

export const DEFAULT_LANGUAGE = 'ru'
export const LANGUAGE_STORAGE_KEY = 'hr-automation-language'

export const supportedLanguages = [
  {
    id: 'ru',
    labelKey: 'settings.language.options.ru',
    locale: 'ru-RU',
  },
] as const

export type AppLanguage = (typeof supportedLanguages)[number]['id']

const resources = {
  ru: {
    translation: ru,
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

i18n.on('languageChanged', (language) => {
  if (typeof window === 'undefined') {
    return
  }

  const normalizedLanguage = language.split('-')[0]

  if (isAppLanguage(normalizedLanguage)) {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, normalizedLanguage)
  }
})

export { i18n }