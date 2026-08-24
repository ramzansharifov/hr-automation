import * as RadixSwitch from '@radix-ui/react-switch'

interface ToggleProps {
  ariaLabel: string
  checked: boolean
  className?: string
  disabled?: boolean
  onCheckedChange: (checked: boolean) => void
}

export function Toggle({
  ariaLabel,
  checked,
  className = '',
  disabled = false,
  onCheckedChange,
}: ToggleProps): JSX.Element {
  return (
    <RadixSwitch.Root
      aria-label={ariaLabel}
      checked={checked}
      className={[
        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-transparent bg-slate-300 transition-colors',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-border)]',
        'data-[state=checked]:bg-[var(--accent)] dark:bg-slate-700',
        'disabled:cursor-not-allowed disabled:opacity-45',
        className,
      ].join(' ')}
      disabled={disabled}
      onCheckedChange={onCheckedChange}
    >
      <RadixSwitch.Thumb
        className={[
          'block h-5 w-5 translate-x-0.5 rounded-full bg-white shadow-sm transition-transform duration-200',
          'data-[state=checked]:translate-x-5',
        ].join(' ')}
      />
    </RadixSwitch.Root>
  )
}
