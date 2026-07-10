import type { FormEvent } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { FiEdit2, FiTrash2 } from 'react-icons/fi'
import { useTranslation } from 'react-i18next'
import { toast } from 'react-toastify'
import type { TFunction } from 'i18next'
import type { HrRecord } from '../../../shared/types/hr'
import { hrApiClient } from '../../../shared/lib/hrApiClient'
import { formatDate } from '../../../shared/lib/format'
import {
  Button,
  ConfirmDialog,
  EmptyState,
  FieldError,
  Input,
  LoadingState,
  Select,
  Textarea,
  type SelectOption,
} from '../../../shared/ui'

interface EmployeeRelatedRecordsProps {
  employeeId: number
  locale: string
}

interface EducationFormValues {
  education_type: string
  education_degree: string
  institution_name: string
  speciality: string
  started_at: string
  ended_at: string
  document_number: string
  note: string
}

interface ExperienceFormValues {
  company_name: string
  position_name: string
  started_at: string
  ended_at: string
  is_current: string
  responsibilities: string
  note: string
}

const educationDefaults: EducationFormValues = {
  education_type: 'university',
  education_degree: 'bachelor',
  institution_name: '',
  speciality: '',
  started_at: '',
  ended_at: '',
  document_number: '',
  note: '',
}

const experienceDefaults: ExperienceFormValues = {
  company_name: '',
  position_name: '',
  started_at: '',
  ended_at: '',
  is_current: '0',
  responsibilities: '',
  note: '',
}

export function EmployeeEducationPanel({
  employeeId,
  locale,
}: EmployeeRelatedRecordsProps): JSX.Element {
  const { t } = useTranslation()
  const [records, setRecords] = useState<HrRecord[]>([])
  const [formValues, setFormValues] = useState<EducationFormValues>(educationDefaults)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<HrRecord | null>(null)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const educationTypeOptions = useMemo<SelectOption[]>(
    () => [
      { value: 'school', label: t('employeesDetails.education.types.school') },
      { value: 'university', label: t('employeesDetails.education.types.university') },
    ],
    [t],
  )
  const educationDegreeOptions = useMemo<SelectOption[]>(
    () => [
      { value: 'bachelor', label: t('employeesDetails.education.degrees.bachelor') },
      { value: 'specialist', label: t('employeesDetails.education.degrees.specialist') },
      { value: 'master', label: t('employeesDetails.education.degrees.master') },
      { value: 'postgraduate', label: t('employeesDetails.education.degrees.postgraduate') },
      { value: 'phd', label: t('employeesDetails.education.degrees.phd') },
    ],
    [t],
  )

  const loadEducationRecords = useCallback(async (): Promise<void> => {
    setIsLoading(true)

    try {
      const result = await hrApiClient.list({
        entity: 'employee_education',
        page: 1,
        pageSize: 100,
        filters: {
          employee_id: {
            operator: 'equals',
            value: employeeId,
          },
        },
        orderBy: 'started_at',
        orderDirection: 'desc',
      })

      setRecords(result.items)
    } catch {
      toast.error(t('employeesDetails.education.toasts.loadError'))
    } finally {
      setIsLoading(false)
    }
  }, [employeeId, t])

  useEffect(() => {
    void loadEducationRecords()
  }, [loadEducationRecords])

  function updateField(name: keyof EducationFormValues, value: string): void {
    setFormValues((current) => ({
      ...current,
      [name]: value,
      ...(name === 'education_type' && value === 'school' ? { education_degree: '' } : {}),
      ...(name === 'education_type' && value === 'university' && !current.education_degree
        ? { education_degree: 'bachelor' }
        : {}),
    }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()

    const validationError = validateEducation(formValues, t)

    if (validationError) {
      setError(validationError)
      return
    }

    setError('')
    setIsSubmitting(true)

    try {
      const data = mapEducationFormToRecord(employeeId, formValues)

      if (editingId) {
        await hrApiClient.update({
          entity: 'employee_education',
          id: editingId,
          data,
        })
      } else {
        await hrApiClient.create({
          entity: 'employee_education',
          data,
        })
      }

      toast.success(t(editingId ? 'forms.toasts.updated' : 'forms.toasts.created'))
      resetForm()
      await loadEducationRecords()
    } catch {
      toast.error(t(editingId ? 'forms.toasts.updateError' : 'forms.toasts.createError'))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDelete(): Promise<void> {
    const id = getRecordId(deleteTarget)

    if (!id) {
      return
    }

    setIsSubmitting(true)

    try {
      await hrApiClient.delete({
        entity: 'employee_education',
        id,
      })
      toast.success(t('forms.toasts.deleted'))
      setDeleteTarget(null)
      await loadEducationRecords()
    } catch {
      toast.error(t('forms.toasts.deleteError'))
    } finally {
      setIsSubmitting(false)
    }
  }

  function startEdit(record: HrRecord): void {
    const id = getRecordId(record)

    if (!id) {
      return
    }

    setEditingId(id)
    setError('')
    setFormValues({
      education_type: getString(record.education_type) || 'university',
      education_degree: getString(record.education_degree),
      institution_name: getString(record.institution_name),
      speciality: getString(record.speciality),
      started_at: getString(record.started_at),
      ended_at: getString(record.ended_at),
      document_number: getString(record.document_number),
      note: getString(record.note),
    })
  }

  function resetForm(): void {
    setEditingId(null)
    setError('')
    setFormValues(educationDefaults)
  }

  const isUniversity = formValues.education_type === 'university'

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
      <form className="app-surface app-shadow rounded-[30px] border p-5" onSubmit={handleSubmit}>
        <FormTitle
          title={t(editingId ? 'employeesDetails.education.editTitle' : 'employeesDetails.education.formTitle')}
          description={t('employeesDetails.education.description')}
        />

        <div className="mt-5 grid gap-4">
          <SelectField
            label={t('forms.fields.educationType')}
            onValueChange={(value) => updateField('education_type', value)}
            options={educationTypeOptions}
            placeholder={t('forms.placeholders.select')}
            value={formValues.education_type}
          />

          {isUniversity && (
            <SelectField
              label={t('forms.fields.educationDegree')}
              onValueChange={(value) => updateField('education_degree', value)}
              options={educationDegreeOptions}
              placeholder={t('forms.placeholders.select')}
              value={formValues.education_degree}
            />
          )}

          <TextField
            label={t(isUniversity ? 'forms.fields.universityName' : 'forms.fields.schoolName')}
            onChange={(value) => updateField('institution_name', value)}
            required
            value={formValues.institution_name}
          />

          {isUniversity && (
            <TextField
              label={t('forms.fields.speciality')}
              onChange={(value) => updateField('speciality', value)}
              value={formValues.speciality}
            />
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label={t('forms.fields.startedAt')}
              onChange={(value) => updateField('started_at', value)}
              type="date"
              value={formValues.started_at}
            />
            <TextField
              label={t('forms.fields.endedAt')}
              onChange={(value) => updateField('ended_at', value)}
              type="date"
              value={formValues.ended_at}
            />
          </div>

          <TextField
            label={t('forms.fields.documentNumber')}
            onChange={(value) => updateField('document_number', value)}
            value={formValues.document_number}
          />
          <TextareaField
            label={t('forms.fields.note')}
            onChange={(value) => updateField('note', value)}
            value={formValues.note}
          />
        </div>

        <FieldError message={error} />

        <div className="mt-5 flex justify-end gap-3">
          {editingId && (
            <Button type="button" variant="secondary" onClick={resetForm}>
              {t('common.actions.cancel')}
            </Button>
          )}
          <Button disabled={isSubmitting} type="submit" variant="primary">
            {t(editingId ? 'common.actions.save' : 'common.actions.create')}
          </Button>
        </div>
      </form>

      <RecordsList
        emptyTitle={t('employeesDetails.education.emptyTitle')}
        isLoading={isLoading}
        loadingLabel={t('common.table.loading')}
        records={records}
        renderRecord={(record) => (
          <EducationRecordCard
            locale={locale}
            onDelete={() => setDeleteTarget(record)}
            onEdit={() => startEdit(record)}
            record={record}
            t={t}
          />
        )}
      />

      <ConfirmDialog
        cancelLabel={t('common.actions.cancel')}
        confirmLabel={t('common.actions.delete')}
        description={t('forms.delete.description')}
        isLoading={isSubmitting}
        onConfirm={() => void handleDelete()}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null)
          }
        }}
        open={Boolean(deleteTarget)}
        title={t('forms.delete.title')}
      />
    </div>
  )
}

export function EmployeeExperiencePanel({
  employeeId,
  locale,
}: EmployeeRelatedRecordsProps): JSX.Element {
  const { t } = useTranslation()
  const [records, setRecords] = useState<HrRecord[]>([])
  const [formValues, setFormValues] = useState<ExperienceFormValues>(experienceDefaults)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<HrRecord | null>(null)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const loadExperienceRecords = useCallback(async (): Promise<void> => {
    setIsLoading(true)

    try {
      const result = await hrApiClient.list({
        entity: 'employee_experience',
        page: 1,
        pageSize: 100,
        filters: {
          employee_id: {
            operator: 'equals',
            value: employeeId,
          },
        },
        orderBy: 'started_at',
        orderDirection: 'desc',
      })

      setRecords(result.items)
    } catch {
      toast.error(t('employeesDetails.experience.toasts.loadError'))
    } finally {
      setIsLoading(false)
    }
  }, [employeeId, t])

  useEffect(() => {
    void loadExperienceRecords()
  }, [loadExperienceRecords])

  function updateField(name: keyof ExperienceFormValues, value: string): void {
    setFormValues((current) => ({
      ...current,
      [name]: value,
      ...(name === 'is_current' && value === '1' ? { ended_at: '' } : {}),
    }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()

    const validationError = validateExperience(formValues, t)

    if (validationError) {
      setError(validationError)
      return
    }

    setError('')
    setIsSubmitting(true)

    try {
      const data = mapExperienceFormToRecord(employeeId, formValues)

      if (editingId) {
        await hrApiClient.update({
          entity: 'employee_experience',
          id: editingId,
          data,
        })
      } else {
        await hrApiClient.create({
          entity: 'employee_experience',
          data,
        })
      }

      toast.success(t(editingId ? 'forms.toasts.updated' : 'forms.toasts.created'))
      resetForm()
      await loadExperienceRecords()
    } catch {
      toast.error(t(editingId ? 'forms.toasts.updateError' : 'forms.toasts.createError'))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDelete(): Promise<void> {
    const id = getRecordId(deleteTarget)

    if (!id) {
      return
    }

    setIsSubmitting(true)

    try {
      await hrApiClient.delete({
        entity: 'employee_experience',
        id,
      })
      toast.success(t('forms.toasts.deleted'))
      setDeleteTarget(null)
      await loadExperienceRecords()
    } catch {
      toast.error(t('forms.toasts.deleteError'))
    } finally {
      setIsSubmitting(false)
    }
  }

  function startEdit(record: HrRecord): void {
    const id = getRecordId(record)

    if (!id) {
      return
    }

    setEditingId(id)
    setError('')
    setFormValues({
      company_name: getString(record.company_name),
      position_name: getString(record.position_name),
      started_at: getString(record.started_at),
      ended_at: getString(record.ended_at),
      is_current: String(Number(record.is_current ?? 0)),
      responsibilities: getString(record.responsibilities),
      note: getString(record.note),
    })
  }

  function resetForm(): void {
    setEditingId(null)
    setError('')
    setFormValues(experienceDefaults)
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
      <form className="app-surface app-shadow rounded-[30px] border p-5" onSubmit={handleSubmit}>
        <FormTitle
          title={t(editingId ? 'employeesDetails.experience.editTitle' : 'employeesDetails.experience.formTitle')}
          description={t('employeesDetails.experience.description')}
        />

        <div className="mt-5 grid gap-4">
          <TextField
            label={t('forms.fields.companyName')}
            onChange={(value) => updateField('company_name', value)}
            required
            value={formValues.company_name}
          />
          <TextField
            label={t('forms.fields.experiencePositionName')}
            onChange={(value) => updateField('position_name', value)}
            required
            value={formValues.position_name}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label={t('forms.fields.startedAt')}
              onChange={(value) => updateField('started_at', value)}
              type="date"
              value={formValues.started_at}
            />
            <TextField
              disabled={formValues.is_current === '1'}
              label={t('forms.fields.endedAt')}
              onChange={(value) => updateField('ended_at', value)}
              type="date"
              value={formValues.ended_at}
            />
          </div>

          <label className="app-surface-muted flex items-center gap-3 rounded-2xl border px-4 py-3">
            <input
              checked={formValues.is_current === '1'}
              className="h-4 w-4 accent-[var(--accent)]"
              onChange={(event) => updateField('is_current', event.target.checked ? '1' : '0')}
              type="checkbox"
            />
            <span className="app-text text-sm font-bold">{t('forms.fields.isCurrent')}</span>
          </label>

          <TextareaField
            label={t('forms.fields.responsibilities')}
            onChange={(value) => updateField('responsibilities', value)}
            value={formValues.responsibilities}
          />
          <TextareaField
            label={t('forms.fields.note')}
            onChange={(value) => updateField('note', value)}
            value={formValues.note}
          />
        </div>

        <FieldError message={error} />

        <div className="mt-5 flex justify-end gap-3">
          {editingId && (
            <Button type="button" variant="secondary" onClick={resetForm}>
              {t('common.actions.cancel')}
            </Button>
          )}
          <Button disabled={isSubmitting} type="submit" variant="primary">
            {t(editingId ? 'common.actions.save' : 'common.actions.create')}
          </Button>
        </div>
      </form>

      <RecordsList
        emptyTitle={t('employeesDetails.experience.emptyTitle')}
        isLoading={isLoading}
        loadingLabel={t('common.table.loading')}
        records={records}
        renderRecord={(record) => (
          <ExperienceRecordCard
            locale={locale}
            onDelete={() => setDeleteTarget(record)}
            onEdit={() => startEdit(record)}
            record={record}
            t={t}
          />
        )}
      />

      <ConfirmDialog
        cancelLabel={t('common.actions.cancel')}
        confirmLabel={t('common.actions.delete')}
        description={t('forms.delete.description')}
        isLoading={isSubmitting}
        onConfirm={() => void handleDelete()}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null)
          }
        }}
        open={Boolean(deleteTarget)}
        title={t('forms.delete.title')}
      />
    </div>
  )
}

interface FormTitleProps {
  description: string
  title: string
}

function FormTitle({ description, title }: FormTitleProps): JSX.Element {
  return (
    <div>
      <h2 className="app-text text-xl font-black">{title}</h2>
      <p className="app-muted mt-2 text-sm">{description}</p>
    </div>
  )
}

interface TextFieldProps {
  disabled?: boolean
  label: string
  onChange: (value: string) => void
  required?: boolean
  type?: string
  value: string
}

function TextField({
  disabled = false,
  label,
  onChange,
  required = false,
  type = 'text',
  value,
}: TextFieldProps): JSX.Element {
  return (
    <label className="block">
      <span className="app-text mb-2 block text-sm font-bold">
        {label}
        {required && <span className="text-rose-500"> *</span>}
      </span>
      <Input
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        type={type}
        value={value}
      />
    </label>
  )
}

interface TextareaFieldProps {
  label: string
  onChange: (value: string) => void
  value: string
}

function TextareaField({ label, onChange, value }: TextareaFieldProps): JSX.Element {
  return (
    <label className="block">
      <span className="app-text mb-2 block text-sm font-bold">{label}</span>
      <Textarea onChange={(event) => onChange(event.target.value)} value={value} />
    </label>
  )
}

interface SelectFieldProps {
  label: string
  onValueChange: (value: string) => void
  options: SelectOption[]
  placeholder: string
  value: string
}

function SelectField({
  label,
  onValueChange,
  options,
  placeholder,
  value,
}: SelectFieldProps): JSX.Element {
  return (
    <label className="block">
      <span className="app-text mb-2 block text-sm font-bold">{label}</span>
      <Select
        onValueChange={onValueChange}
        options={options}
        placeholder={placeholder}
        value={value}
      />
    </label>
  )
}

interface RecordsListProps {
  emptyTitle: string
  isLoading: boolean
  loadingLabel: string
  records: HrRecord[]
  renderRecord: (record: HrRecord) => JSX.Element
}

function RecordsList({
  emptyTitle,
  isLoading,
  loadingLabel,
  records,
  renderRecord,
}: RecordsListProps): JSX.Element {
  if (isLoading) {
    return <LoadingState label={loadingLabel} />
  }

  if (records.length === 0) {
    return <EmptyState title={emptyTitle} />
  }

  return <div className="space-y-3">{records.map((record) => renderRecord(record))}</div>
}

interface RecordCardProps {
  locale: string
  onDelete: () => void
  onEdit: () => void
  record: HrRecord
  t: TFunction
}

function EducationRecordCard({
  locale,
  onDelete,
  onEdit,
  record,
  t,
}: RecordCardProps): JSX.Element {
  const educationType = getString(record.education_type)
  const educationDegree = getString(record.education_degree)
  const speciality = getString(record.speciality)

  return (
    <article className="app-surface app-shadow rounded-[26px] border p-5">
      <RecordCardHeader
        onDelete={onDelete}
        onEdit={onEdit}
        deleteLabel={t('common.actions.delete')}
        editLabel={t('common.actions.edit')}
        title={valueOrEmpty(getString(record.institution_name), t)}
      />

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <MetaItem
          label={t('forms.fields.educationType')}
          value={getEducationTypeLabel(educationType, t)}
        />
        {educationType === 'university' && (
          <MetaItem
            label={t('forms.fields.educationDegree')}
            value={getEducationDegreeLabel(educationDegree, t)}
          />
        )}
        {speciality && <MetaItem label={t('forms.fields.speciality')} value={speciality} />}
        <MetaItem
          label={t('forms.fields.startedAt')}
          value={formatDate(record.started_at, locale)}
        />
        <MetaItem
          label={t('forms.fields.endedAt')}
          value={formatDate(record.ended_at, locale)}
        />
        <MetaItem
          label={t('forms.fields.documentNumber')}
          value={valueOrEmpty(getString(record.document_number), t)}
        />
      </div>

      {getString(record.note) && (
        <p className="app-muted mt-4 whitespace-pre-line text-sm">{getString(record.note)}</p>
      )}
    </article>
  )
}

function ExperienceRecordCard({
  locale,
  onDelete,
  onEdit,
  record,
  t,
}: RecordCardProps): JSX.Element {
  const isCurrent = Number(record.is_current ?? 0) === 1

  return (
    <article className="app-surface app-shadow rounded-[26px] border p-5">
      <RecordCardHeader
        onDelete={onDelete}
        onEdit={onEdit}
        deleteLabel={t('common.actions.delete')}
        editLabel={t('common.actions.edit')}
        title={valueOrEmpty(getString(record.company_name), t)}
      />

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <MetaItem
          label={t('forms.fields.experiencePositionName')}
          value={getString(record.position_name)}
        />
        <MetaItem
          label={t('forms.fields.startedAt')}
          value={formatDate(record.started_at, locale)}
        />
        <MetaItem
          label={t('forms.fields.endedAt')}
          value={isCurrent ? t('employeesDetails.experience.current') : formatDate(record.ended_at, locale)}
        />
      </div>

      {getString(record.responsibilities) && (
        <p className="app-text mt-4 whitespace-pre-line text-sm font-medium">
          {getString(record.responsibilities)}
        </p>
      )}
      {getString(record.note) && (
        <p className="app-muted mt-3 whitespace-pre-line text-sm">{getString(record.note)}</p>
      )}
    </article>
  )
}

interface RecordCardHeaderProps {
  deleteLabel: string
  editLabel: string
  onDelete: () => void
  onEdit: () => void
  title: string
}

function RecordCardHeader({
  deleteLabel,
  editLabel,
  onDelete,
  onEdit,
  title,
}: RecordCardHeaderProps): JSX.Element {
  return (
    <div className="flex items-start justify-between gap-4">
      <h3 className="app-text text-lg font-black">{title}</h3>
      <div className="flex shrink-0 gap-2">
        <Button
          aria-label={editLabel}
          className="h-10 w-10 rounded-xl p-0"
          onClick={onEdit}
          type="button"
          variant="ghost"
        >
          <FiEdit2 className="h-4 w-4" />
        </Button>
        <Button
          aria-label={deleteLabel}
          className="h-10 w-10 rounded-xl p-0 text-rose-600"
          onClick={onDelete}
          type="button"
          variant="ghost"
        >
          <FiTrash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

interface MetaItemProps {
  label: string
  value: string
}

function MetaItem({ label, value }: MetaItemProps): JSX.Element {
  return (
    <div className="app-surface-muted rounded-2xl p-4">
      <p className="app-muted text-xs font-black uppercase tracking-wide">{label}</p>
      <p className="app-text mt-1 text-sm font-black">{value}</p>
    </div>
  )
}

function validateEducation(values: EducationFormValues, t: TFunction): string {
  if (!values.institution_name.trim()) {
    return t('forms.validation.required')
  }

  if (values.education_type === 'university' && !values.education_degree.trim()) {
    return t('forms.validation.required')
  }

  return ''
}

function validateExperience(values: ExperienceFormValues, t: TFunction): string {
  if (!values.company_name.trim() || !values.position_name.trim()) {
    return t('forms.validation.required')
  }

  return ''
}

function mapEducationFormToRecord(employeeId: number, values: EducationFormValues): HrRecord {
  return {
    employee_id: employeeId,
    education_type: values.education_type,
    education_degree: values.education_type === 'university' ? nullableString(values.education_degree) : null,
    institution_name: values.institution_name.trim(),
    speciality: nullableString(values.speciality),
    started_at: nullableString(values.started_at),
    ended_at: nullableString(values.ended_at),
    document_number: nullableString(values.document_number),
    note: nullableString(values.note),
  }
}

function mapExperienceFormToRecord(employeeId: number, values: ExperienceFormValues): HrRecord {
  return {
    employee_id: employeeId,
    company_name: values.company_name.trim(),
    position_name: values.position_name.trim(),
    started_at: nullableString(values.started_at),
    ended_at: values.is_current === '1' ? null : nullableString(values.ended_at),
    is_current: Number(values.is_current),
    responsibilities: nullableString(values.responsibilities),
    note: nullableString(values.note),
  }
}

function getEducationTypeLabel(value: string, t: TFunction): string {
  if (value === 'school') {
    return t('employeesDetails.education.types.school')
  }

  if (value === 'university') {
    return t('employeesDetails.education.types.university')
  }

  return valueOrEmpty(value, t)
}

function getEducationDegreeLabel(value: string, t: TFunction): string {
  const translationKey = `employeesDetails.education.degrees.${value}`
  const translated = t(translationKey)

  return translated === translationKey ? valueOrEmpty(value, t) : translated
}

function getRecordId(record: HrRecord | null): number | null {
  const id = Number(record?.id)

  return Number.isFinite(id) && id > 0 ? id : null
}

function getString(value: unknown): string {
  if (value === null || value === undefined) {
    return ''
  }

  return String(value)
}

function nullableString(value: string): string | null {
  const trimmedValue = value.trim()

  return trimmedValue === '' ? null : trimmedValue
}

function valueOrEmpty(value: string, t: TFunction): string {
  return value.trim() || t('employeesDetails.emptyValue')
}
