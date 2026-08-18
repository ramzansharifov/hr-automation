import * as AlertDialog from '@radix-ui/react-alert-dialog'
import { Button } from './Button'
import { ModalLayout } from './ModalLayout'

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
        <AlertDialog.Content className="app-surface app-border fixed left-1/2 top-1/2 z-50 flex max-h-[86vh] w-[calc(100vw-32px)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[28px] border">
          <ModalLayout
            footer={
              <div className="flex justify-end gap-3">
                <AlertDialog.Cancel asChild>
                  <Button disabled={isLoading} variant="secondary">
                    {cancelLabel}
                  </Button>
                </AlertDialog.Cancel>
                <Button disabled={isLoading} onClick={onConfirm} variant="danger">
                  {confirmLabel}
                </Button>
              </div>
            }
            header={
              <div className="app-border-soft border-b p-6">
                <AlertDialog.Title className="app-text text-xl font-black">
                  {title}
                </AlertDialog.Title>
                <AlertDialog.Description className="app-muted mt-2 text-sm">
                  {description}
                </AlertDialog.Description>
              </div>
            }
          >
            <div className="app-muted text-sm leading-6">{description}</div>
          </ModalLayout>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
