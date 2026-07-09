import * as RadixDialog from '@radix-ui/react-dialog'
import { useTranslation } from 'react-i18next'
import type { ReactNode } from 'react'
import { FiX } from 'react-icons/fi'
import { Button } from './Button'

interface DialogProps {
  children: ReactNode
  description?: string
  onOpenChange: (open: boolean) => void
  open: boolean
  title: string
}

export function Dialog({
  children,
  description,
  onOpenChange,
  open,
  title,
}: DialogProps): JSX.Element {
  const { t } = useTranslation()

  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-50 bg-slate-950/55 backdrop-blur-sm" />
        <RadixDialog.Content className="app-surface app-shadow-lg fixed left-1/2 top-1/2 z-50 max-h-[86vh] w-[calc(100vw-32px)] max-w-3xl -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[28px] border">
          <div className="app-border-soft flex items-start justify-between gap-4 border-b p-6">
            <div className="min-w-0">
              <RadixDialog.Title className="app-text text-xl font-black">
                {title}
              </RadixDialog.Title>
              {description && (
                <RadixDialog.Description className="app-muted mt-1 text-sm">
                  {description}
                </RadixDialog.Description>
              )}
            </div>

            <RadixDialog.Close asChild>
              <Button
                aria-label={t('common.actions.close')}
                className="h-10 w-10 rounded-xl p-0"
                variant="ghost"
              >
                <FiX className="h-4 w-4" />
              </Button>
            </RadixDialog.Close>
          </div>

          <div className="max-h-[calc(86vh-93px)] overflow-y-auto p-6">{children}</div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  )
}
