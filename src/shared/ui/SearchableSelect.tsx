import * as RadixPopover from '@radix-ui/react-popover'
import { useMemo, useRef, useState } from 'react'
import { FiCheck, FiChevronDown, FiSearch } from 'react-icons/fi'

import type { SelectOption } from './Select'

interface SearchableSelectProps {
  ariaLabel?: string
  allowEmpty?: boolean
  className?: string
  disabled?: boolean
  emptyOptionLabel?: string
  noOptionsLabel?: string
  onValueChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  searchPlaceholder?: string
  value?: string
}

export function SearchableSelect({
  ariaLabel,
  allowEmpty = false,
  className = '',
  disabled = false,
  emptyOptionLabel = 'Не выбрано',
  noOptionsLabel = 'Ничего не найдено',
  onValueChange,
  options,
  placeholder = 'Выберите значение',
  searchPlaceholder = 'Поиск...',
  value = '',
}: SearchableSelectProps): JSX.Element {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)
  const selectedOption = options.find((option) => option.value === value)
  const normalizedSearch = search.trim().toLocaleLowerCase()
  const filteredOptions = useMemo(
    () =>
      normalizedSearch
        ? options.filter((option) =>
            option.label.toLocaleLowerCase().includes(normalizedSearch),
          )
        : options,
    [normalizedSearch, options],
  )

  function handleOpenChange(nextOpen: boolean): void {
    setOpen(nextOpen)
    if (!nextOpen) setSearch('')
  }

  function choose(nextValue: string): void {
    onValueChange(nextValue)
    setOpen(false)
    setSearch('')
  }

  return (
    <RadixPopover.Root onOpenChange={handleOpenChange} open={open}>
      <RadixPopover.Trigger asChild>
        <button
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-label={ariaLabel}
          className={[
            'app-input flex h-11 w-full items-center justify-between gap-3 rounded-2xl border px-4 text-left text-sm outline-none transition',
            'disabled:cursor-not-allowed disabled:opacity-60 focus:border-[var(--accent-border)]',
            className,
          ].join(' ')}
          disabled={disabled}
          role="combobox"
          type="button"
        >
          <span
            className={[
              'min-w-0 flex-1 truncate',
              selectedOption ? 'app-text' : 'text-[var(--color-placeholder)]',
            ].join(' ')}
          >
            {selectedOption?.label ?? placeholder}
          </span>
          <FiChevronDown className="app-muted h-4 w-4 shrink-0" />
        </button>
      </RadixPopover.Trigger>

      <RadixPopover.Portal>
        <RadixPopover.Content
          align="start"
          className="app-surface app-border z-50 w-[var(--radix-popover-trigger-width)] overflow-hidden rounded-2xl border shadow-xl"
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            window.requestAnimationFrame(() => searchInputRef.current?.focus())
          }}
          sideOffset={8}
        >
          <div className="app-border-soft relative border-b p-2">
            <FiSearch className="app-muted pointer-events-none absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2" />
            <input
              aria-label={searchPlaceholder}
              className="app-input app-placeholder h-10 w-full rounded-xl border pl-10 pr-3 text-sm outline-none transition focus:border-[var(--accent-border)]"
              onChange={(event) => setSearch(event.target.value)}
              placeholder={searchPlaceholder}
              ref={searchInputRef}
              value={search}
            />
          </div>

          <div className="max-h-64 overflow-y-auto p-1" role="listbox">
            {allowEmpty && (
              <OptionButton
                isSelected={value === ''}
                label={emptyOptionLabel}
                onClick={() => choose('')}
              />
            )}

            {filteredOptions.map((option) => (
              <OptionButton
                isSelected={option.value === value}
                key={option.value}
                label={option.label}
                onClick={() => choose(option.value)}
              />
            ))}

            {filteredOptions.length === 0 && (
              <p className="app-muted px-3 py-5 text-center text-sm font-semibold">
                {noOptionsLabel}
              </p>
            )}
          </div>
        </RadixPopover.Content>
      </RadixPopover.Portal>
    </RadixPopover.Root>
  )
}

function OptionButton({
  isSelected,
  label,
  onClick,
}: {
  isSelected: boolean
  label: string
  onClick: () => void
}): JSX.Element {
  return (
    <button
      aria-selected={isSelected}
      className={[
        'app-hover-muted app-text relative flex min-h-10 w-full items-center rounded-xl py-2 pl-9 pr-3 text-left text-sm outline-none transition',
        'focus-visible:bg-[var(--color-surface-hover)]',
        isSelected ? 'app-accent-soft' : '',
      ].join(' ')}
      onClick={onClick}
      role="option"
      type="button"
    >
      {isSelected && <FiCheck className="absolute left-3 h-4 w-4" />}
      <span className="truncate">{label}</span>
    </button>
  )
}
