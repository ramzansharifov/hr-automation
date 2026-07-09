import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm, type Resolver } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import type { HrEntityKey } from '../../../shared/types/hr'
import { Button, FieldError, Input, Select, Textarea } from '../../../shared/ui'
import { getHrEntityFormConfig, type HrEntityFormField } from '../config/hrEntityFormConfig'
import { getHrEntitySchema } from '../config/hrEntitySchemas'
import type { HrEntityFormValues } from '../lib/hrEntityFormMapper'

interface HrEntityFormProps {
  cancelLabel: string
  defaultValues: HrEntityFormValues
  entity: HrEntityKey
  isSubmitting?: boolean
  onCancel: () => void
  onSubmit: (values: HrEntityFormValues) => Promise<void> | void
  submitLabel: string
}

function getInputType(field: HrEntityFormField): string {
  if (field.type === 'number') {
    return 'number'
  }

  if (field.type === 'email' || field.type === 'tel' || field.type === 'date') {
    return field.type
  }

  return 'text'
}

export function HrEntityForm({
  cancelLabel,
  defaultValues,
  entity,
  isSubmitting = false,
  onCancel,
  onSubmit,
  submitLabel,
}: HrEntityFormProps): JSX.Element {
  const { t } = useTranslation()
  const config = getHrEntityFormConfig(entity)
  const schema = getHrEntitySchema(entity)
  const {
    formState: { errors },
    handleSubmit,
    register,
    reset,
  } = useForm<HrEntityFormValues>({
    defaultValues,
    resolver: zodResolver(schema) as Resolver<HrEntityFormValues>,
  })

  useEffect(() => {
    reset(defaultValues)
  }, [defaultValues, reset])

  return (
    <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
      <div className="grid gap-4 md:grid-cols-2">
        {config.fields.map((field) => {
          const error = errors[field.name]?.message
          const errorMessage = typeof error === 'string' ? t(error) : undefined
          const label = t(field.labelKey)
          const placeholder = field.placeholderKey ? t(field.placeholderKey) : label
          const commonProps = {
            id: `${entity}-${field.name}`,
            invalid: Boolean(errorMessage),
            placeholder,
            ...register(field.name),
          }

          return (
            <label
              key={field.name}
              className={field.type === 'textarea' ? 'block md:col-span-2' : 'block'}
              htmlFor={`${entity}-${field.name}`}
            >
              <span className="app-text mb-2 block text-sm font-bold">
                {label}
                {field.required && <span className="text-rose-500"> *</span>}
              </span>

              {field.type === 'textarea' ? (
                <Textarea {...commonProps} />
              ) : field.type === 'select' ? (
                <Select
                  {...commonProps}
                  options={(field.options ?? []).map((option) => ({
                    value: option.value,
                    label: t(option.labelKey),
                  }))}
                  placeholder={t('forms.placeholders.select')}
                />
              ) : (
                <Input min={field.type === 'number' ? 0 : undefined} type={getInputType(field)} {...commonProps} />
              )}

              <FieldError message={errorMessage} />
            </label>
          )
        })}
      </div>

      <div className="app-border-soft flex justify-end gap-3 border-t pt-5">
        <Button disabled={isSubmitting} onClick={onCancel} variant="secondary">
          {cancelLabel}
        </Button>
        <Button disabled={isSubmitting} type="submit" variant="primary">
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}
