import * as Popover from '@radix-ui/react-popover'
import {
  forwardRef,
  useEffect,
  useMemo,
  useRef,
  useState,
  type InputHTMLAttributes,
  type MouseEvent,
  type Ref,
} from 'react'
import { FiCalendar, FiChevronLeft, FiChevronRight } from 'react-icons/fi'

import { Button } from './Button'
import { IconButton } from './IconButton'

export interface DatePickerProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  invalid?: boolean
}

const calendarLabels = {
  clear: 'Очистить',
  nextMonth: 'Следующий месяц',
  openCalendar: 'Открыть календарь',
  previousMonth: 'Предыдущий месяц',
  today: 'Сегодня',
}

export const DatePicker = forwardRef<HTMLInputElement, DatePickerProps>(
  (
    {
      className = '',
      defaultValue,
      disabled = false,
      invalid = false,
      max,
      min,
      onClick,
      onChange,
      placeholder,
      readOnly = false,
      required = false,
      value,
      ...props
    },
    forwardedRef,
  ) => {
    const inputRef = useRef<HTMLInputElement | null>(null)
    const initialValue = inputValueToString(value ?? defaultValue)
    const initialDate = parseDateValue(initialValue)
    const [open, setOpen] = useState(false)
    const [selectedValue, setSelectedValue] = useState(initialValue)
    const [viewMonth, setViewMonth] = useState(() =>
      startOfMonth(initialDate ?? new Date()),
    )

    const locale =
      typeof document !== 'undefined' && document.documentElement.lang
        ? document.documentElement.lang
        : undefined
    const minDate = parseDateValue(inputValueToString(min))
    const maxDate = parseDateValue(inputValueToString(max))
    const selectedDate = parseDateValue(selectedValue)
    const today = startOfDay(new Date())

    const monthTitle = useMemo(
      () =>
        capitalize(
          new Intl.DateTimeFormat(locale, {
            month: 'long',
            year: 'numeric',
          }).format(viewMonth),
        ),
      [locale, viewMonth],
    )

    const weekdayLabels = useMemo(
      () =>
        Array.from({ length: 7 }, (_, index) => {
          const monday = new Date(2024, 0, 1 + index)
          return new Intl.DateTimeFormat(locale, { weekday: 'short' })
            .format(monday)
            .replace('.', '')
        }),
      [locale],
    )

    const calendarDays = useMemo(() => buildCalendarDays(viewMonth), [viewMonth])
    const previousMonth = shiftMonth(viewMonth, -1)
    const nextMonth = shiftMonth(viewMonth, 1)
    const canGoPrevious = !minDate || endOfMonth(previousMonth) >= minDate
    const canGoNext = !maxDate || startOfMonth(nextMonth) <= maxDate
    const canSelectToday = isDateAllowed(today, minDate, maxDate)
    const interactionDisabled = disabled || readOnly

    useEffect(() => {
      if (value === undefined) return
      const nextValue = inputValueToString(value)
      setSelectedValue(nextValue)
      if (!open) return
      const nextDate = parseDateValue(nextValue)
      if (nextDate) setViewMonth(startOfMonth(nextDate))
    }, [open, value])

    function assignInputRef(node: HTMLInputElement | null): void {
      inputRef.current = node
      assignRef(forwardedRef, node)
    }

    function syncCalendarFromInput(): void {
      const currentValue = inputRef.current?.value ?? inputValueToString(value)
      setSelectedValue(currentValue)
      const currentDate = parseDateValue(currentValue)
      setViewMonth(startOfMonth(currentDate ?? new Date()))
    }

    function handleOpenChange(nextOpen: boolean): void {
      if (nextOpen && interactionDisabled) return
      if (nextOpen) syncCalendarFromInput()
      setOpen(nextOpen)
    }

    function handleInputClick(event: MouseEvent<HTMLInputElement>): void {
      onClick?.(event)
      if (!event.defaultPrevented && !interactionDisabled) {
        syncCalendarFromInput()
        setOpen(true)
      }
    }

    function writeValue(nextValue: string): void {
      const input = inputRef.current
      if (!input || interactionDisabled) return

      const nativeSetter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
      )?.set
      if (nativeSetter) {
        nativeSetter.call(input, nextValue)
      } else {
        input.value = nextValue
      }

      setSelectedValue(nextValue)
      input.dispatchEvent(new Event('input', { bubbles: true }))
    }

    function selectDate(date: Date): void {
      if (!isDateAllowed(date, minDate, maxDate)) return
      writeValue(formatDateValue(date))
      setOpen(false)
      requestAnimationFrame(() => inputRef.current?.focus())
    }

    function clearDate(): void {
      if (required) return
      writeValue('')
      setOpen(false)
      requestAnimationFrame(() => inputRef.current?.focus())
    }

    return (
      <Popover.Root open={open} onOpenChange={handleOpenChange}>
        <div className="relative w-full">
          <input
            {...props}
            ref={assignInputRef}
            aria-expanded={open}
            aria-haspopup="dialog"
            className={[
              'app-input app-placeholder h-11 w-full rounded-2xl border px-4 pr-11 text-sm outline-none transition',
              invalid ? 'border-rose-400 focus:border-rose-500' : '',
              interactionDisabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
              className,
            ].join(' ')}
            defaultValue={defaultValue}
            disabled={disabled}
            onChange={onChange}
            onClick={handleInputClick}
            placeholder={placeholder}
            readOnly
            required={required}
            type="text"
            value={value}
          />

          <Popover.Trigger asChild>
            <IconButton
              className="absolute right-1.5 top-1/2 -translate-y-1/2"
              disabled={interactionDisabled}
              icon={<FiCalendar />}
              label={calendarLabels.openCalendar}
              size="sm"
            />
          </Popover.Trigger>
        </div>

        <Popover.Portal>
          <Popover.Content
            align="end"
            className="app-surface app-border z-[220] w-[320px] rounded-[24px] border p-4 shadow-2xl outline-none"
            sideOffset={8}
          >
            <div className="flex items-center justify-between gap-3">
              <IconButton
                disabled={!canGoPrevious}
                icon={<FiChevronLeft />}
                label={calendarLabels.previousMonth}
                onClick={() => canGoPrevious && setViewMonth(previousMonth)}
                size="sm"
              />

              <div className="app-text text-sm font-black">{monthTitle}</div>

              <IconButton
                disabled={!canGoNext}
                icon={<FiChevronRight />}
                label={calendarLabels.nextMonth}
                onClick={() => canGoNext && setViewMonth(nextMonth)}
                size="sm"
              />
            </div>

            <div className="mt-3 grid grid-cols-7 gap-1">
              {weekdayLabels.map((label) => (
                <div
                  className="app-muted flex h-8 items-center justify-center text-[11px] font-black uppercase"
                  key={label}
                >
                  {label}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1" role="grid">
              {calendarDays.map((date) => {
                const outsideMonth = date.getMonth() !== viewMonth.getMonth()
                const isSelected = Boolean(selectedDate && isSameDay(date, selectedDate))
                const isToday = isSameDay(date, today)
                const dayDisabled = !isDateAllowed(date, minDate, maxDate)

                return (
                  <button
                    aria-label={new Intl.DateTimeFormat(locale, {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    }).format(date)}
                    aria-selected={isSelected}
                    className={[
                      'relative flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)]',
                      isSelected
                        ? 'text-[var(--button-primary-fg)] shadow-sm'
                        : 'app-text hover:bg-[var(--color-surface-hover)]',
                      outsideMonth && !isSelected ? 'opacity-40' : '',
                      dayDisabled ? 'cursor-not-allowed opacity-25' : '',
                      isToday && !isSelected
                        ? 'app-accent-text ring-1 ring-[var(--accent-border)]'
                        : '',
                    ].join(' ')}
                    disabled={dayDisabled}
                    key={formatDateValue(date)}
                    onClick={() => selectDate(date)}
                    role="gridcell"
                    style={
                      isSelected
                        ? { background: 'var(--button-primary-bg)' }
                        : undefined
                    }
                    type="button"
                  >
                    {date.getDate()}
                  </button>
                )
              })}
            </div>

            <div className="app-border-soft mt-4 flex items-center justify-between border-t pt-3">
              {!required ? (
                <Button onClick={clearDate} size="sm" variant="ghost">
                  {calendarLabels.clear}
                </Button>
              ) : (
                <span />
              )}
              <Button
                disabled={!canSelectToday}
                onClick={() => selectDate(today)}
                size="sm"
                variant="secondary"
              >
                {calendarLabels.today}
              </Button>
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    )
  },
)

DatePicker.displayName = 'DatePicker'

function assignRef<T>(ref: Ref<T>, value: T | null): void {
  if (typeof ref === 'function') {
    ref(value)
    return
  }
  if (ref) {
    const mutableRef = ref as { current: T | null }
    mutableRef.current = value
  }
}

function inputValueToString(
  value: string | number | readonly string[] | undefined,
): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : ''
}

function parseDateValue(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2]) - 1
  const day = Number(match[3])
  const date = new Date(year, month, day)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day
  ) {
    return null
  }
  return startOfDay(date)
}

function formatDateValue(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0)
}

function shiftMonth(date: Date, amount: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1)
}

function shiftDay(date: Date, amount: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount)
}

function buildCalendarDays(month: Date): Date[] {
  const firstDay = startOfMonth(month)
  const mondayOffset = (firstDay.getDay() + 6) % 7
  const gridStart = shiftDay(firstDay, -mondayOffset)
  return Array.from({ length: 42 }, (_, index) => shiftDay(gridStart, index))
}

function isSameDay(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  )
}

function isDateAllowed(date: Date, minDate: Date | null, maxDate: Date | null): boolean {
  const normalized = startOfDay(date)
  if (minDate && normalized < minDate) return false
  if (maxDate && normalized > maxDate) return false
  return true
}

function capitalize(value: string): string {
  return value ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : value
}
