import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'

type IconButtonSize = 'sm' | 'md' | 'lg'
type IconButtonTone = 'neutral' | 'accent' | 'danger'

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode
  label: string
  size?: IconButtonSize
  tone?: IconButtonTone
}

const sizeClasses: Record<IconButtonSize, string> = {
  sm: 'h-9 w-9 rounded-xl [&>svg]:h-[18px] [&>svg]:w-[18px]',
  md: 'h-10 w-10 rounded-xl [&>svg]:h-5 [&>svg]:w-5',
  lg: 'h-11 w-11 rounded-2xl [&>svg]:h-5 [&>svg]:w-5',
}

const toneClasses: Record<IconButtonTone, string> = {
  neutral: 'app-text app-hover-muted border-transparent',
  accent: 'app-accent-soft app-accent-text border-[var(--accent-border)]',
  danger: 'app-danger-soft border-rose-400/25 text-rose-500 hover:bg-rose-500/15',
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      className = '',
      icon,
      label,
      size = 'md',
      tone = 'neutral',
      title,
      type = 'button',
      ...props
    },
    ref,
  ) => (
    <button
      {...props}
      aria-label={label}
      className={[
        'inline-flex shrink-0 items-center justify-center border p-0 leading-none transition',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-border)]',
        'disabled:cursor-not-allowed disabled:opacity-50 [&>svg]:shrink-0 [&>svg]:stroke-[2]',
        sizeClasses[size],
        toneClasses[tone],
        className,
      ].join(' ')}
      ref={ref}
      title={title ?? label}
      type={type}
    >
      {icon}
    </button>
  ),
)

IconButton.displayName = 'IconButton'
