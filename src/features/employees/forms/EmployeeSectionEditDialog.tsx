import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useMemo, useState } from 'react'
import { useForm, type Resolver } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'react-toastify'
import type { HrRecord } from '../../../shared/types/hr'
import { Button, Dialog, type SelectOption } from '../../../shared/ui'
import { hrApiClient } from '../../../shared/lib/hrApiClient'
import {
  normalizeEmail,
  normalizePersonName,
  normalizePhone,
} from '../lib/employeeFormatters'
import { loadEmployeeRelationOptions } from '../lib/employeeRelations'
import type { EmployeeFormValues } from '../types'
import {
  EmployeeAddressFormSection,
  EmployeeCompanyFormSection,
  EmployeeNotesFormSection,
  EmployeePersonalFormSection,
} from './EmployeeFormSections'
import {
  employeeSectionSchemas,
  type EmployeeFormSectionKey,
} from './employeeFormValidation'
import {
  mapEmployeeFormSectionToRecord,
  mapEmployeeRecordToFormValues,
} from './employeeFormRecordMapper'

interface EmployeeSectionEditDialogProps {
  employee: HrRecord
  employeeId: number
  onOpenChange: (open: boolean) => void
  onSaved: (employee: HrRecord) => void | Promise<void>
  open: boolean
  section: EmployeeFormSectionKey | null
}

export function EmployeeSectionEditDialog({
  employee,
  employeeId,
  onOpenChange,
  onSaved,
  open,
  section,
}: EmployeeSectionEditDialogProps): JSX.Element {
  const { t } = useTranslation()
  const activeSection = section ?? 'personal'
  const [departments, setDepartments] = useState<SelectOption[]>([])
  const [positions, setPositions] = useState<SelectOption[]>([])
  const [isRelationsLoading, setIsRelationsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const defaultValues = useMemo(() => mapEmployeeRecordToFormValues(employee), [employee])
  const {
    control,
    formState: { errors },
    getValues,
    handleSubmit,
    register,
    reset,
    setValue,
  } = useForm<EmployeeFormValues>({
    defaultValues,
    resolver: zodResolver(employeeSectionSchemas[activeSection]) as Resolver<EmployeeFormValues>,
  })

  const statusOptions = useMemo(
    () => [
      { value: 'active', label: t('common.status.active') },
      { value: 'inactive', label: t('common.status.inactive') },
    ],
    [t],
  )

  const genderOptions = useMemo(
    () => [
      { value: 'male', label: t('common.status.male') },
      { value: 'female', label: t('common.status.female') },
    ],
    [t],
  )

  useEffect(() => {
    reset(defaultValues)
  }, [defaultValues, reset, activeSection, open])

  useEffect(() => {
    let isActive = true

    setIsRelationsLoading(true)
    loadEmployeeRelationOptions()
      .then((options) => {
        if (!isActive) {
          return
        }

        setDepartments(options.departments)
        setPositions(options.positions)
      })
      .catch(() => {
        toast.error(t('forms.toasts.relationsLoadError'))
      })
      .finally(() => {
        if (isActive) {
          setIsRelationsLoading(false)
        }
      })

    return () => {
      isActive = false
    }
  }, [t])

  function normalizeField(name: keyof EmployeeFormValues): void {
    const value = getValues(name)

    if (name === 'last_name' || name === 'first_name' || name === 'middle_name') {
      setValue(name, normalizePersonName(value), { shouldValidate: true })
      return
    }

    if (name === 'email') {
      setValue(name, normalizeEmail(value), { shouldValidate: true })
      return
    }

    if (name === 'phone') {
      setValue(name, normalizePhone(value), { shouldValidate: true })
    }
  }

  async function handleSave(): Promise<void> {
    if (!Number.isFinite(employeeId) || !section) {
      return
    }

    setIsSubmitting(true)

    try {
      const updatedEmployee = await hrApiClient.update({
        entity: 'employees',
        id: employeeId,
        data: mapEmployeeFormSectionToRecord(section, getValues()),
      })

      await onSaved(updatedEmployee)
      toast.success(t('forms.toasts.updated'))
      onOpenChange(false)
    } catch (error) {
      const message = error instanceof Error ? error.message : t('forms.toasts.updateError')
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog
      description="Изменяются только поля выбранного раздела."
      onOpenChange={onOpenChange}
      open={open}
      title={getSectionDialogTitle(activeSection)}
    >
      <form className="space-y-6" onSubmit={handleSubmit(() => void handleSave())}>
        {activeSection === 'personal' && (
          <EmployeePersonalFormSection
            control={control}
            errors={errors}
            genderOptions={genderOptions}
            normalizeField={normalizeField}
            register={register}
            t={t}
          />
        )}

        {activeSection === 'address' && (
          <EmployeeAddressFormSection
            control={control}
            errors={errors}
            register={register}
            t={t}
          />
        )}

        {activeSection === 'company' && (
          <EmployeeCompanyFormSection
            control={control}
            departments={departments}
            errors={errors}
            isRelationsLoading={isRelationsLoading}
            positions={positions}
            register={register}
            statusOptions={statusOptions}
            t={t}
          />
        )}

        {activeSection === 'notes' && (
          <EmployeeNotesFormSection
            control={control}
            errors={errors}
            register={register}
            t={t}
          />
        )}

        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            {t('common.actions.cancel')}
          </Button>
          <Button disabled={isSubmitting} type="submit" variant="primary">
            {t('common.actions.save')}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

function getSectionDialogTitle(section: EmployeeFormSectionKey): string {
  const titles: Record<EmployeeFormSectionKey, string> = {
    personal: 'Редактировать личные данные',
    address: 'Редактировать адресные данные',
    company: 'Редактировать данные по компании',
    notes: 'Редактировать служебную информацию',
  }

  return titles[section]
}