import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  useForm,
  type FieldErrors,
  type Resolver,
} from 'react-hook-form'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { FiCheck } from 'react-icons/fi'
import { toast } from 'react-toastify'

import { Button, type SelectOption } from '../../shared/ui'
import { getAppLocale } from '../../shared/i18n'
import { formatCurrency, formatDate, humanizeStatus } from '../../shared/lib/format'
import { hrApiClient } from '../../shared/lib/hrApiClient'
import { EmployeeInfoSection } from '../../features/employees/components/EmployeeInfoSection'
import {
  mapEmployeeFormValuesToRecord,
  normalizeEmail,
  normalizeEmployeeFormValues,
  normalizePersonName,
  normalizePhone,
} from '../../features/employees/lib/employeeFormatters'
import { loadEmployeeRelationOptions } from '../../features/employees/lib/employeeRelations'
import { employeeDefaultValues, type EmployeeFormValues } from '../../features/employees/types'
import {
  EmployeeAddressFormSection,
  EmployeeCompanyFormSection,
  EmployeePersonalFormSection,
} from '../../features/employees/forms/EmployeeFormSections'
import { employeeCreateSchema } from '../../features/employees/forms/employeeFormValidation'



const steps = [
  {
    key: 'personal',
    titleKey: 'employeesCreate.steps.personal',
    fields: ['last_name', 'first_name', 'middle_name', 'birth_date', 'gender', 'phone', 'email'],
  },
  {
    key: 'address',
    titleKey: 'employeesCreate.steps.address',
    fields: [
      'address_country',
      'address_city',
      'address_street',
      'address_house',
      'address_apartment',
      'address',
    ],
  },
  {
    key: 'company',
    titleKey: 'employeesCreate.steps.company',
    fields: ['department_id', 'position_id', 'hire_date', 'status', 'salary', 'note'],
  },
  {
    key: 'review',
    titleKey: 'employeesCreate.steps.review',
    fields: [],
  },
] satisfies Array<{
  key: string
  titleKey: string
  fields: Array<keyof EmployeeFormValues>
}>

export function EmployeeCreatePage(): JSX.Element {
  const { i18n, t } = useTranslation()
  const locale = getAppLocale(i18n.language)
  const navigate = useNavigate()
  const [activeStep, setActiveStep] = useState(0)
  const [departments, setDepartments] = useState<SelectOption[]>([])
  const [positions, setPositions] = useState<SelectOption[]>([])
  const [isRelationsLoading, setIsRelationsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const {
    control,
    formState: { errors },
    getValues,
    handleSubmit,
    register,
    setValue,
    trigger,
    watch,
  } = useForm<EmployeeFormValues>({
    defaultValues: employeeDefaultValues,
    resolver: zodResolver(employeeCreateSchema) as Resolver<EmployeeFormValues>,
  })
  const watchedValues = watch()

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

  async function handleNext(): Promise<void> {
    if (activeStep >= steps.length - 1 || isSubmitting) {
      return
    }

    const currentStep = steps[activeStep]
    const isStepValid = await trigger(currentStep.fields)

    if (!isStepValid) {
      return
    }

    setActiveStep((current) => Math.min(current + 1, steps.length - 1))
  }

  function handleBack(): void {
    if (activeStep === 0) {
      navigate('/employees')
      return
    }

    setActiveStep((current) => Math.max(current - 1, 0))
  }

  async function handleFinalCreate(): Promise<void> {
    if (activeStep !== steps.length - 1 || isSubmitting) {
      return
    }

    await handleSubmit(handleCreate, handleCreateInvalid)()
  }

  function handleCreateInvalid(formErrors: FieldErrors<EmployeeFormValues>): void {
    const invalidStepIndex = steps.findIndex((step) =>
      step.fields.some((field) => Boolean(formErrors[field])),
    )

    if (invalidStepIndex >= 0) {
      setActiveStep(invalidStepIndex)
    }

    toast.error(t('employeesCreate.toasts.validationError'))
  }

  async function handleCreate(values: EmployeeFormValues): Promise<void> {
    if (activeStep !== steps.length - 1 || isSubmitting) {
      return
    }

    setIsSubmitting(true)

    try {
      const normalizedValues = normalizeEmployeeFormValues(values)
      const created = await hrApiClient.create({
        entity: 'employees',
        data: mapEmployeeFormValuesToRecord(normalizedValues),
      })
      const id = Number(created.id)

      toast.success(t('employeesCreate.toasts.created'))

      if (Number.isFinite(id)) {
        navigate(`/employees/${id}`)
      } else {
        navigate('/employees')
      }
    } catch (error) {
      console.error('Employee create error:', error)
      toast.error(t('employeesCreate.toasts.createError'))
    } finally {
      setIsSubmitting(false)
    }
  }

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

  const normalizedReviewValues = normalizeEmployeeFormValues(watchedValues)

  return (
      <div
        className="app-surface app-shadow overflow-hidden rounded-[32px] border"
      >
        <section className="border-b app-border-soft p-6 sm:p-7">
          <StepProgress activeStep={activeStep} t={t} />
        </section>

        <div className="border-b app-border-soft p-6 sm:p-8">

        {activeStep === 0 && (
          <EmployeePersonalFormSection
            control={control}
            errors={errors}
            genderOptions={genderOptions}
            normalizeField={normalizeField}
            register={register}
            t={t}
          />
        )}

        {activeStep === 1 && (
          <EmployeeAddressFormSection
            control={control}
            errors={errors}
            register={register}
            t={t}
          />
        )}

        {activeStep === 2 && (
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

        {activeStep === 3 && (
          <div className="space-y-5">
            <EmployeeInfoSection
              title={t('employeesDetails.sections.personal')}
              items={[
                { label: t('forms.fields.lastName'), value: valueOrEmpty(normalizedReviewValues.last_name, t) },
                { label: t('forms.fields.firstName'), value: valueOrEmpty(normalizedReviewValues.first_name, t) },
                { label: t('forms.fields.middleName'), value: valueOrEmpty(normalizedReviewValues.middle_name, t) },
                { label: t('forms.fields.birthDate'), value: formatDate(normalizedReviewValues.birth_date, locale) },
                { label: t('forms.fields.gender'), value: humanizeStatus(normalizedReviewValues.gender, t) },
                { label: t('forms.fields.phone'), value: valueOrEmpty(normalizedReviewValues.phone, t) },
                { label: t('forms.fields.email'), value: valueOrEmpty(normalizedReviewValues.email, t) },
              ]}
            />
            <EmployeeInfoSection
              title={t('employeesDetails.sections.address')}
              items={[
                { label: t('forms.fields.addressCountry'), value: valueOrEmpty(normalizedReviewValues.address_country, t) },
                { label: t('forms.fields.addressCity'), value: valueOrEmpty(normalizedReviewValues.address_city, t) },
                { label: t('forms.fields.addressStreet'), value: valueOrEmpty(normalizedReviewValues.address_street, t) },
                { label: t('forms.fields.addressHouse'), value: valueOrEmpty(normalizedReviewValues.address_house, t) },
                { label: t('forms.fields.addressApartment'), value: valueOrEmpty(normalizedReviewValues.address_apartment, t) },
                { label: t('forms.fields.address'), value: valueOrEmpty(normalizedReviewValues.address, t) },
              ]}
            />
            <EmployeeInfoSection
              title={t('employeesDetails.sections.company')}
              items={[
                { label: t('forms.fields.departmentId'), value: optionLabel(departments, normalizedReviewValues.department_id, t) },
                { label: t('forms.fields.positionId'), value: optionLabel(positions, normalizedReviewValues.position_id, t) },
                { label: t('forms.fields.hireDate'), value: formatDate(normalizedReviewValues.hire_date, locale) },
                { label: t('forms.fields.status'), value: humanizeStatus(normalizedReviewValues.status, t) },
                { label: t('forms.fields.salary'), value: formatCurrency(normalizedReviewValues.salary, locale) },
                { label: t('forms.fields.note'), value: valueOrEmpty(normalizedReviewValues.note, t) },
              ]}
            />
          </div>
        )}

        </div>

        <footer className="flex flex-col gap-3 bg-[var(--color-surface)] p-5 sm:flex-row sm:justify-end sm:p-6">
          <Button type="button" onClick={() => navigate('/employees')} variant="ghost">
            {t('employeesCreate.actions.cancel')}
          </Button>
          <Button type="button" onClick={handleBack} variant="secondary">
            {t('employeesCreate.actions.back')}
          </Button>
          {activeStep < steps.length - 1 ? (
            <Button type="button" onClick={() => void handleNext()} variant="primary">
              {t('employeesCreate.actions.next')}
            </Button>
          ) : (
            <Button
              disabled={isSubmitting}
              type="button"
              onClick={() => void handleFinalCreate()}
              variant="primary"
            >
              {t('employeesCreate.actions.create')}
            </Button>
          )}
        </footer>
      </div>
  )
}

interface StepProgressProps {
  activeStep: number
  t: TFunction
}

function StepProgress({ activeStep, t }: StepProgressProps): JSX.Element {
  return (
    <ol className="grid gap-5 md:grid-cols-4">
      {steps.map((step, index) => {
        const isCompleted = index < activeStep
        const isActive = index === activeStep

        return (
          <li key={step.key} className="relative min-w-0">
            {index < steps.length - 1 && (
              <span
                className={[
                  'absolute left-1/2 top-5 hidden h-0.5 w-full -translate-y-1/2 transition-colors duration-300 md:block',
                  isCompleted ? 'bg-[var(--accent)]' : 'bg-[var(--color-border)]',
                ].join(' ')}
              />
            )}

            <div className="relative z-10 flex flex-col items-center text-center">
              <span
                aria-current={isActive ? 'step' : undefined}
                className={[
                  'flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-black transition-all duration-300',
                  isCompleted
                    ? 'border-[var(--accent)] bg-[var(--accent)] text-white shadow-lg'
                    : isActive
                      ? 'border-[var(--accent)] bg-[var(--color-surface)] text-[var(--accent)] shadow-sm ring-4 ring-[var(--accent-ring)]'
                      : 'border-[var(--color-border)] bg-[var(--color-surface-muted)] text-[var(--color-text-muted)]',
                ].join(' ')}
              >
                <AnimatePresence mode="wait" initial={false}>
                  {isCompleted ? (
                    <motion.span
                      key="check"
                      className="flex items-center justify-center"
                      initial={{ opacity: 0, rotate: -45, scale: 0.35 }}
                      animate={{ opacity: 1, rotate: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.35 }}
                      transition={{ duration: 0.22, ease: 'easeOut' }}
                    >
                      <FiCheck className="h-5 w-5" />
                    </motion.span>
                  ) : (
                    <motion.span
                      key="number"
                      initial={{ opacity: 0, scale: 0.75 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.75 }}
                      transition={{ duration: 0.18, ease: 'easeOut' }}
                    >
                      {index + 1}
                    </motion.span>
                  )}
                </AnimatePresence>
              </span>

              <span
                className={[
                  'mt-3 max-w-32 text-xs font-black leading-tight transition-colors duration-300',
                  isCompleted || isActive ? 'app-accent-text' : 'app-muted',
                ].join(' ')}
              >
                {t(step.titleKey)}
              </span>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
function optionLabel(options: SelectOption[], value: string, t: TFunction): string {
  return options.find((option) => option.value === value)?.label ?? valueOrEmpty(value, t)
}

function valueOrEmpty(value: string, t: TFunction): string {
  return value.trim() || t('employeesDetails.emptyValue')
}
