import * as AlertDialog from '@radix-ui/react-alert-dialog'
import { Button } from './Button'

interface ConfirmDialogProps {
  cancelLabel: string
  confirmLabel: string
  description: string
  isLoading?: boolean
  onConfirm: () => void
  onOpenChange: (open: boolean) => void
  open: boolean
  title: string
}

export function ConfirmDialog({
  cancelLabel,
  confirmLabel,
  description,
  isLoading = false,
  onConfirm,
  onOpenChange,
  open,
  title,
}: ConfirmDialogProps): JSX.Element {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-slate-950/55 backdrop-blur-sm" />
        <AlertDialog.Content className="app-surface app-border fixed left-1/2 top-1/2 z-50 flex max-h-[min(90dvh,900px)] w-[calc(100vw-32px)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[28px] border shadow-2xl outline-none">
          <div className="app-border-soft shrink-0 border-b px-6 py-5 sm:px-7 sm:py-6">
            <AlertDialog.Title className="app-text text-xl font-black leading-tight">
              {title}
            </AlertDialog.Title>
            <AlertDialog.Description className="app-muted mt-1.5 text-sm leading-5">
              {description}
            </AlertDialog.Description>
          </div>

          <div className="app-surface app-border-soft flex shrink-0 flex-wrap justify-end gap-3 border-t px-6 py-4 sm:px-7 sm:py-5">
            <AlertDialog.Cancel asChild>
              <Button disabled={isLoading} variant="secondary">
                {cancelLabel}
              </Button>
            </AlertDialog.Cancel>
            <Button disabled={isLoading} onClick={onConfirm} variant="danger">
              {confirmLabel}
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
