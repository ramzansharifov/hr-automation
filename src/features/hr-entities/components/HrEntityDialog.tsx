import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'react-toastify'
import type { HrEntityKey, HrRecord } from '../../../shared/types/hr'
import { Dialog } from '../../../shared/ui'
import { getHrEntityFormConfig } from '../config/hrEntityFormConfig'
import {
  getHrEntityDefaultValues,
  mapHrEntityFormValues,
  type HrEntityFormValues,
} from '../lib/hrEntityFormMapper'
import { HrEntityForm } from './HrEntityForm'

interface HrEntityDialogProps {
  entity: HrEntityKey
  initialRecord?: HrRecord | null
  mode: 'create' | 'edit'
  onOpenChange: (open: boolean) => void
  onSubmit: (data: HrRecord) => Promise<void>
  open: boolean
}

export function HrEntityDialog({
  entity,
  initialRecord,
  mode,
  onOpenChange,
  onSubmit,
  open,
}: HrEntityDialogProps): JSX.Element {
  const { t } = useTranslation()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const config = getHrEntityFormConfig(entity)
  const defaultValues = useMemo(
    () => getHrEntityDefaultValues(entity, initialRecord),
    [entity, initialRecord],
  )

  async function handleSubmit(values: HrEntityFormValues): Promise<void> {
    setIsSubmitting(true)

    try {
      await onSubmit(mapHrEntityFormValues(entity, values))
      toast.success(t(mode === 'create' ? 'forms.toasts.created' : 'forms.toasts.updated'))
      onOpenChange(false)
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : t(mode === 'create' ? 'forms.toasts.createError' : 'forms.toasts.updateError')
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog
      description={t('forms.dialogDescription')}
      onOpenChange={onOpenChange}
      open={open}
      title={t(mode === 'create' ? config.createTitleKey : config.editTitleKey)}
    >
      <HrEntityForm
        cancelLabel={t('common.actions.cancel')}
        defaultValues={defaultValues}
        entity={entity}
        isSubmitting={isSubmitting}
        onCancel={() => onOpenChange(false)}
        onSubmit={handleSubmit}
        submitLabel={t('common.actions.save')}
      />
    </Dialog>
  )
}
