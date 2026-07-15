import * as RadixDropdownMenu from '@radix-ui/react-dropdown-menu'
import type { ReactNode } from 'react'
import { FiMoreVertical } from 'react-icons/fi'
import { Button } from './Button'

export interface DropdownMenuAction {
  danger?: boolean
  icon?: ReactNode
  label: string
  onSelect: () => void
}

interface DropdownMenuProps {
  actions: DropdownMenuAction[]
  align?: 'start' | 'center' | 'end'
  triggerLabel: string
}

export function DropdownMenu({
  actions,
  align = 'end',
  triggerLabel,
}: DropdownMenuProps): JSX.Element {
  return (
    <RadixDropdownMenu.Root>
      <RadixDropdownMenu.Trigger asChild>
        <Button
          aria-label={triggerLabel}
          className="h-10 w-10 rounded-xl p-0"
          size="sm"
          tooltipSide="left"
          variant="ghost"
        >
          <FiMoreVertical className="h-4 w-4" />
        </Button>
      </RadixDropdownMenu.Trigger>

      <RadixDropdownMenu.Portal>
        <RadixDropdownMenu.Content
          align={align}
          className="radix-dropdown-content app-surface app-border z-50 min-w-48 rounded-xl border p-1 shadow-2xl"
          collisionPadding={12}
          sideOffset={8}
        >
          {actions.map((action) => (
            <RadixDropdownMenu.Item
              key={action.label}
              onSelect={action.onSelect}
              className={[
                'radix-menu-item flex min-h-10 cursor-pointer select-none items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold outline-none transition',
                action.danger
                  ? 'text-rose-600 data-[highlighted]:bg-rose-500/10 data-[highlighted]:text-rose-500'
                  : 'app-text-soft data-[highlighted]:bg-[var(--color-surface-hover)] data-[highlighted]:text-[var(--color-text)]',
              ].join(' ')}
            >
              {action.icon}
              <span>{action.label}</span>
            </RadixDropdownMenu.Item>
          ))}
        </RadixDropdownMenu.Content>
      </RadixDropdownMenu.Portal>
    </RadixDropdownMenu.Root>
  )
}
