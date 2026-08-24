import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'react-toastify'
import { getUserFacingErrorMessage } from '../../../shared/lib/userFacingErrors'
import { ConfirmDialog } from '../../../shared/ui'

interface HrEntityDeleteDialogProps {
  onConfirm: () => Promise<void>
  onOpenChange: (open: boolean) => void
  open: boolean
}

export function HrEntityDeleteDialog({
  onConfirm,
  onOpenChange,
  open,
}: HrEntityDeleteDialogProps): JSX.Element {
  const { t } = useTranslation()
  const [isLoading, setIsLoading] = useState(false)

  async function handleConfirm(): Promise<void> {
    setIsLoading(true)

    try {
      await onConfirm()
      toast.success(t('forms.toasts.deleted'))
      onOpenChange(false)
    } catch (error) {
      toast.error(getUserFacingErrorMessage(error, t('forms.toasts.deleteError')))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <ConfirmDialog
      cancelLabel={t('common.actions.cancel')}
      confirmLabel={t('common.actions.delete')}
      description={t('forms.delete.description')}
      isLoading={isLoading}
      onConfirm={() => void handleConfirm()}
      onOpenChange={onOpenChange}
      open={open}
      title={t('forms.delete.title')}
    />
  )
}
