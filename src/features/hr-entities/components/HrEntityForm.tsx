import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useMemo, useState } from 'react'
import { Controller, useForm, type Resolver } from 'react-hook-form'
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
  if (field.name === 'accrual_month') {
    return 'month'
  }

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
    return fullName || String(record.id ?? '')
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
  const visibleFields = useMemo(
    () =>
      config.fields.filter(
        (field) => !(entity === 'vacations' && field.name === 'days_count'),
      ),
    [config.fields, entity],
  )
  const schema = getHrEntitySchema(entity)
  const relationFields = useMemo(
    () => visibleFields.filter((field) => field.type === 'relation' && field.relation),
    [visibleFields],
  )
  const [relationSelects, setRelationSelects] = useState<Record<string, RelationSelectState>>({})
  const {
    formState: { errors },
    control,
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

      loadRelationRecords(relation.entity, relation.orderBy)
        .then((records) => {
          if (!isActive) {
            return
          }

          const options = records
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
        {visibleFields.map((field) => {
          const error = errors[field.name]?.message
          const errorMessage = typeof error === 'string' ? t(error) : undefined
          const label = t(field.labelKey)
          const placeholder = field.placeholderKey ? t(field.placeholderKey) : label
          const fieldId = `${entity}-${field.name}`
          const relation = field.type === 'relation' ? field.relation : undefined

          return (
            <label
              key={field.name}
              className={field.type === 'textarea' ? 'block md:col-span-2' : 'block'}
              htmlFor={fieldId}
            >
              <span className="app-text mb-2 block text-sm font-bold">
                {label}
                {field.required && <span className="text-rose-500"> *</span>}
              </span>

              {field.type === 'textarea' ? (
                <Textarea
                  id={fieldId}
                  invalid={Boolean(errorMessage)}
                  placeholder={placeholder}
                  {...register(field.name)}
                />
              ) : field.type === 'select' ? (
                <Controller
                  control={control}
                  name={field.name}
                  render={({ field: controllerField }) => (
                    <Select
                      allowEmpty={!field.required}
                      emptyOptionLabel={t('forms.placeholders.emptyOption')}
                      id={fieldId}
                      invalid={Boolean(errorMessage)}
                      name={controllerField.name}
                      onBlur={controllerField.onBlur}
                      onValueChange={controllerField.onChange}
                      options={(field.options ?? []).map((option) => ({
                        value: option.value,
                        label: t(option.labelKey),
                      }))}
                      placeholder={t('forms.placeholders.select')}
                      value={controllerField.value}
                    />
                  )}
                />
              ) : field.type === 'relation' && relation ? (
                <Controller
                  control={control}
                  name={field.name}
                  render={({ field: controllerField }) => (
                    <Select
                      allowEmpty={!field.required}
                      disabled={relationSelects[field.name]?.isLoading}
                      emptyOptionLabel={t('forms.placeholders.emptyOption')}
                      id={fieldId}
                      invalid={Boolean(errorMessage)}
                      name={controllerField.name}
                      onBlur={controllerField.onBlur}
                      onValueChange={controllerField.onChange}
                      options={relationSelects[field.name]?.options ?? []}
                      placeholder={
                        relationSelects[field.name]?.isLoading
                          ? t('forms.placeholders.loadingOptions')
                          : t(relation.placeholderKey)
                      }
                      value={controllerField.value}
                    />
                  )}
                />
              ) : (
                <Input
                  id={fieldId}
                  invalid={Boolean(errorMessage)}
                  min={field.type === 'number' ? 0 : undefined}
                  placeholder={placeholder}
                  type={getInputType(field)}
                  {...register(field.name)}
                />
              )}

              <FieldError message={errorMessage} />
            </label>
          )
        })}
      </div>

      <div className="app-surface app-border-soft sticky bottom-0 -mx-6 -mb-6 flex justify-end gap-3 border-t px-6 py-5">
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

async function loadRelationRecords(
  entity: HrEntityKey,
  orderBy: string,
): Promise<HrRecord[]> {
  const records: HrRecord[] = []
  let page = 1
  let totalPages = 1

  do {
    const result = await hrApiClient.list({
      entity,
      page,
      pageSize: 100,
      orderBy,
      orderDirection: 'asc',
    })

    records.push(...result.items)
    totalPages = Math.max(result.totalPages, 1)
    page += 1
  } while (page <= totalPages)

  return records
}
