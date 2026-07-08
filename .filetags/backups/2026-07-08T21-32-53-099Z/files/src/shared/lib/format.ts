export function formatCurrency(value: unknown): string {
  const amount = Number(value ?? 0)

  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'TJS',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0)
}

export function formatDate(value: unknown): string {
  if (!value) {
    return '—'
  }

  const text = String(value)
  const date = new Date(text.length === 10 ? `${text}T00:00:00` : text)

  if (Number.isNaN(date.getTime())) {
    return text
  }

  return new Intl.DateTimeFormat('ru-RU').format(date)
}

export function formatCellValue(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '—'
  }

  if (typeof value === 'number') {
    return new Intl.NumberFormat('ru-RU').format(value)
  }

  return String(value)
}

export function humanizeStatus(value: unknown): string {
  const key = String(value ?? '')

  const labels: Record<string, string> = {
    active: 'Активен',
    inactive: 'Неактивен',
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