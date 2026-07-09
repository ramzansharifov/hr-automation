import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useMemo, useState } from 'react'
import { useForm, type Resolver } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'react-toastify'
import type { HrEntityKey, HrRecord } from '../../../shared/types/hr'
import { hrApiClient } from '../../../shared/lib/hrApiClient'
import { Button, FieldError, Input, Select, Textarea, type SelectOption } from '../../../shared/ui'
import {
  getHrEntityFormConfig,
  type HrEntityFormField,
  type HrEntityRelationLabel,
} from '../config/hrEntityFormConfig'
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

interface RelationSelectState {
  isLoading: boolean
  options: SelectOption[]
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

function getRelationOptionLabel(record: HrRecord, label: HrEntityRelationLabel): string {
  if (label === 'employeeName') {
    const fullName = [record.last_name, record.first_name]
      .map((part) => String(part ?? '').trim())
      .filter(Boolean)
      .join(' ')
    const code = String(record.employee_code ?? '').trim()

    if (fullName && code) {
      return `${fullName} · ${code}`
    }

    return fullName || code || String(record.id ?? '')
  }

  return String(record.name ?? record.id ?? '')
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
  const config = useMemo(() => getHrEntityFormConfig(entity), [entity])
  const schema = getHrEntitySchema(entity)
  const relationFields = useMemo(
    () => config.fields.filter((field) => field.type === 'relation' && field.relation),
    [config.fields],
  )
  const [relationSelects, setRelationSelects] = useState<Record<string, RelationSelectState>>({})
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

  useEffect(() => {
    let isActive = true

    relationFields.forEach((field) => {
      const relation = field.relation

      if (!relation) {
        return
      }

      setRelationSelects((current) => ({
        ...current,
        [field.name]: {
          isLoading: true,
          options: current[field.name]?.options ?? [],
        },
      }))

      hrApiClient
        .list({
          entity: relation.entity,
          page: 1,
          pageSize: 50000,
          orderBy: relation.orderBy,
          orderDirection: 'asc',
        })
        .then((result) => {
          if (!isActive) {
            return
          }

          const options = result.items
            .map((record) => ({
              value: String(record.id ?? ''),
              label: getRelationOptionLabel(record, relation.label),
            }))
            .filter((option) => option.value !== '')

          setRelationSelects((current) => ({
            ...current,
            [field.name]: {
              isLoading: false,
              options,
            },
          }))
        })
        .catch(() => {
          if (!isActive) {
            return
          }

          setRelationSelects((current) => ({
            ...current,
            [field.name]: {
              isLoading: false,
              options: [],
            },
          }))
          toast.error(t('forms.toasts.relationsLoadError'))
        })
    })

    return () => {
      isActive = false
    }
  }, [relationFields, t])

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
              ) : field.type === 'relation' && field.relation ? (
                <Select
                  {...commonProps}
                  disabled={relationSelects[field.name]?.isLoading}
                  options={relationSelects[field.name]?.options ?? []}
                  placeholder={
                    relationSelects[field.name]?.isLoading
                      ? t('forms.placeholders.loadingOptions')
                      : t(field.relation.placeholderKey)
                  }
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
