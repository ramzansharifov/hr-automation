import { forwardRef, type SelectHTMLAttributes } from 'react'

export interface SelectOption {
  value: string
  label: string
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean
  options: SelectOption[]
  placeholder?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className = '', invalid = false, options, placeholder, ...props }, ref) => (
    <select
      ref={ref}
      className={[
        'app-input h-11 w-full rounded-2xl border px-4 text-sm outline-none transition',
        invalid ? 'border-rose-400 focus:border-rose-500' : '',
        className,
      ].join(' ')}
      {...props}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
)

Select.displayName = 'Select'
