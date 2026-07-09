import { forwardRef, type InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', invalid = false, ...props }, ref) => (
    <input
      ref={ref}
      className={[
        'app-input app-placeholder h-11 w-full rounded-2xl border px-4 text-sm outline-none transition',
        invalid ? 'border-rose-400 focus:border-rose-500' : '',
        className,
      ].join(' ')}
      {...props}
    />
  ),
)

Input.displayName = 'Input'
