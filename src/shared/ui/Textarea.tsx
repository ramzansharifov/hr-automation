import { forwardRef, type TextareaHTMLAttributes } from 'react'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className = '', invalid = false, rows = 4, ...props }, ref) => (
    <textarea
      ref={ref}
      rows={rows}
      className={[
        'app-input app-placeholder min-h-28 w-full resize-y rounded-2xl border px-4 py-3 text-sm outline-none transition',
        invalid ? 'border-rose-400 focus:border-rose-500' : '',
        className,
      ].join(' ')}
      {...props}
    />
  ),
)

Textarea.displayName = 'Textarea'
