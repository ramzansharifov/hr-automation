import { Button } from './Button'
import { Dialog } from './Dialog'

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
    <Dialog
      description={description}
      footer={
        <div className="flex justify-end gap-3">
          <Button
            disabled={isLoading}
            onClick={() => onOpenChange(false)}
            variant="secondary"
          >
            {cancelLabel}
          </Button>
          <Button disabled={isLoading} onClick={onConfirm} variant="danger">
            {confirmLabel}
          </Button>
        </div>
      }
      onOpenChange={onOpenChange}
      open={open}
      size="sm"
      title={title}
    >
      <span className="sr-only">{description}</span>
    </Dialog>
  )
}
