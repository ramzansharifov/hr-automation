import { forwardRef, type InputHTMLAttributes } from 'react'
import { DatePicker } from './DatePicker'

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  invalid?: boolean
  type?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', invalid = false, type, ...props }, ref) => {
    if (type === 'date') {
      return (
        <DatePicker
          ref={ref}
          className={className}
          invalid={invalid}
          {...props}
        />
      )
    }

    return (
      <input
        ref={ref}
        type={type as InputHTMLAttributes<HTMLInputElement>['type']}
        className={[
          'app-input app-placeholder h-11 w-full rounded-2xl border px-4 text-sm outline-none transition',
          invalid ? 'border-rose-400 focus:border-rose-500' : '',
          className,
        ].join(' ')}
        {...props}
      />
    )
  },
)

Input.displayName = 'Input'
