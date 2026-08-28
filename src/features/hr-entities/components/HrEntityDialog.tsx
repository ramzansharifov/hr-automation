import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'react-toastify'
import type { HrEntityKey, HrRecord } from '../../../shared/types/hr'
import { Button, Dialog } from '../../../shared/ui'
import { getUserFacingErrorMessage } from '../../../shared/lib/userFacingErrors'
import { getHrEntityFormConfig } from '../config/hrEntityFormConfig'
import {
  getHrEntityDefaultValues,
  mapHrEntityFormValues,
  type HrEntityFormValues,
} from '../lib/hrEntityFormMapper'
import { HrEntityForm } from './HrEntityForm'

interface HrEntityDialogProps {
  entity: HrEntityKey
  hiddenFieldNames?: string[]
  initialRecord?: HrRecord | null
  mode: 'create' | 'edit'
  onOpenChange: (open: boolean) => void
  onSubmit: (data: HrRecord) => Promise<void>
  open: boolean
}

export function HrEntityDialog({
  entity,
  hiddenFieldNames,
  initialRecord,
  mode,
  onOpenChange,
  onSubmit,
  open,
}: HrEntityDialogProps): JSX.Element {
  const { t } = useTranslation()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const config = getHrEntityFormConfig(entity)
  const formId = `hr-entity-dialog-${entity}`
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
      toast.error(
        getUserFacingErrorMessage(
          error,
          t(mode === 'create' ? 'forms.toasts.createError' : 'forms.toasts.updateError'),
        ),
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog
      footer={
        <div className="flex flex-wrap justify-end gap-3">
          <Button disabled={isSubmitting} onClick={() => onOpenChange(false)} variant="secondary">
            {t('common.actions.cancel')}
          </Button>
          <Button disabled={isSubmitting} form={formId} type="submit" variant="primary">
            {t('common.actions.save')}
          </Button>
        </div>
      }
      onOpenChange={onOpenChange}
      open={open}
      title={t(mode === 'create' ? config.createTitleKey : config.editTitleKey)}
    >
      <HrEntityForm
        defaultValues={defaultValues}
        entity={entity}
        formId={formId}
        hiddenFieldNames={hiddenFieldNames}
        onSubmit={handleSubmit}
      />
    </Dialog>
  )
}
