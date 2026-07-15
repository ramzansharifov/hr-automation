import {
  forwardRef,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react'
import { Tooltip } from './Tooltip'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  tooltip?: ReactNode
  tooltipSide?: 'top' | 'right' | 'bottom' | 'left'
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'app-button-primary',
  secondary: 'app-button-secondary border',
  ghost: 'app-text hover:bg-[var(--color-surface-hover)]',
  danger: 'app-danger-soft border',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-10 px-3 text-sm',
  md: 'h-11 px-4 text-sm',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      'aria-label': ariaLabel,
      children,
      className = '',
      leftIcon,
      rightIcon,
      size = 'md',
      tooltip,
      tooltipSide = 'top',
      type = 'button',
      variant = 'secondary',
      ...props
    },
    ref,
  ) => {
    const button = (
      <button
        aria-label={ariaLabel}
        ref={ref}
        type={type}
        className={[
          'inline-flex items-center justify-center gap-2 rounded-2xl font-bold transition disabled:cursor-not-allowed disabled:opacity-50',
          variantClasses[variant],
          sizeClasses[size],
          className,
        ].join(' ')}
        {...props}
      >
        {leftIcon}
        {children}
        {rightIcon}
      </button>
    )

    const tooltipContent = tooltip ?? ariaLabel
    if (!tooltipContent) return button

    return (
      <Tooltip content={tooltipContent} side={tooltipSide}>
        {button}
      </Tooltip>
    )
  },
)

Button.displayName = 'Button'
