import type { TFunction } from 'i18next'

type TranslateStatus = TFunction | ((key: string) => string)

export function formatCurrency(value: unknown, locale = 'ru-RU'): string {
  const amount = Number(value ?? 0)

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'TJS',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0)
}

export function formatDate(value: unknown, locale = 'ru-RU'): string {
  if (!value) {
    return '—'
  }

  const text = String(value)
  const date = new Date(text.length === 10 ? `${text}T00:00:00` : text)

  if (Number.isNaN(date.getTime())) {
    return text
  }

  return new Intl.DateTimeFormat(locale).format(date)
}

export function formatCellValue(value: unknown, locale = 'ru-RU'): string {
  if (value === null || value === undefined || value === '') {
    return '—'
  }

  if (typeof value === 'number') {
    return new Intl.NumberFormat(locale).format(value)
  }

  return String(value)
}

export function humanizeStatus(value: unknown, t?: TranslateStatus): string {
  const key = String(value ?? '')

  if (t) {
    const translationKey = `common.status.${key}`
    const translated = String(t(translationKey as never))

    if (translated !== translationKey) {
      return translated
    }
  }

  const labels: Record<string, string> = {
    active: 'Активен',
    inactive: 'Неактивен',
    terminated: 'Уволен',
    planned: 'Запланирован',
    approved: 'Одобрен',
    rejected: 'Отклонён',
    completed: 'Завершён',
    paid: 'Выплачено',
    pending: 'Ожидает',
    male: 'Мужской',
    female: 'Женский',
  }

  return labels[key] ?? formatCellValue(value)
}
