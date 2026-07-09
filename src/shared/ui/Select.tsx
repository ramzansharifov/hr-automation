import * as RadixSelect from '@radix-ui/react-select'
import { FiCheck, FiChevronDown } from 'react-icons/fi'

const CLEAR_VALUE = '__empty__'

export interface SelectOption {
  value: string
  label: string
}

interface SelectProps {
  ariaLabel?: string
  allowEmpty?: boolean
  className?: string
  disabled?: boolean
  emptyOptionLabel?: string
  id?: string
  invalid?: boolean
  name?: string
  onBlur?: () => void
  onValueChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  value?: string
}

export function Select({
  ariaLabel,
  allowEmpty = false,
  className = '',
  disabled = false,
  emptyOptionLabel,
  id,
  invalid = false,
  name,
  onBlur,
  onValueChange,
  options,
  placeholder,
  value = '',
}: SelectProps): JSX.Element {
  function handleValueChange(nextValue: string): void {
    onValueChange(nextValue === CLEAR_VALUE ? '' : nextValue)
  }

  return (
    <RadixSelect.Root
      disabled={disabled}
      name={name}
      onValueChange={handleValueChange}
      value={value === '' ? undefined : value}
    >
      <RadixSelect.Trigger
        aria-label={ariaLabel}
        id={id}
        onBlur={onBlur}
        className={[
          'app-input flex h-11 w-full items-center justify-between gap-3 rounded-2xl border px-4 text-left text-sm outline-none transition',
          'data-[placeholder]:text-[var(--color-placeholder)] disabled:cursor-not-allowed disabled:opacity-60',
          'focus:border-[var(--accent-border)]',
          invalid ? 'border-rose-400 focus:border-rose-500' : '',
          className,
        ].join(' ')}
      >
        <RadixSelect.Value placeholder={placeholder} />
        <RadixSelect.Icon asChild>
          <FiChevronDown className="app-muted h-4 w-4 shrink-0" />
        </RadixSelect.Icon>
      </RadixSelect.Trigger>

      <RadixSelect.Portal>
        <RadixSelect.Content
          className="app-surface app-shadow-lg z-50 max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-2xl border p-1"
          position="popper"
          sideOffset={8}
        >
          <RadixSelect.Viewport className="max-h-72 overflow-y-auto">
            {allowEmpty && emptyOptionLabel && (
              <SelectItem value={CLEAR_VALUE}>{emptyOptionLabel}</SelectItem>
            )}

            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  )
}

interface SelectItemProps {
  children: string
  value: string
}

function SelectItem({ children, value }: SelectItemProps): JSX.Element {
  return (
    <RadixSelect.Item
      className={[
        'relative flex min-h-10 cursor-pointer select-none items-center rounded-xl py-2 pl-9 pr-3 text-sm outline-none transition',
        'data-[highlighted]:bg-[var(--color-surface-hover)] data-[highlighted]:text-[var(--color-text)]',
        'data-[state=checked]:bg-[var(--accent-soft)] data-[state=checked]:text-[var(--accent-soft-text)]',
      ].join(' ')}
      value={value}
    >
      <RadixSelect.ItemIndicator className="absolute left-3 inline-flex items-center justify-center">
        <FiCheck className="h-4 w-4" />
      </RadixSelect.ItemIndicator>
      <RadixSelect.ItemText>{children}</RadixSelect.ItemText>
    </RadixSelect.Item>
  )
}
