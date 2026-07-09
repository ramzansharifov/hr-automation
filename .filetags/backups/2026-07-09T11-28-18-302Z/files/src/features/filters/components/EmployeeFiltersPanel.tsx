import type { FormEvent } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { FiRotateCcw, FiSearch } from 'react-icons/fi'
import { useTranslation } from 'react-i18next'
import { toast } from 'react-toastify'
import type { HrFilterCondition } from '../../../shared/types/hr'
import { Button, Input, Select, type SelectOption } from '../../../shared/ui'
import { loadEmployeeRelationOptions } from '../../employees/lib/employeeRelations'

export interface EmployeeFilterValues {
  last_name: string
  first_name: string
  middle_name: string
  phone: string
  email: string
  department_id: string
  position_id: string
  status: string
  gender: string
}

interface EmployeeFiltersPanelProps {
  className?: string
  onFiltersChange: (filters: Record<string, HrFilterCondition> | undefined) => void
}

const emptyFilters: EmployeeFilterValues = {
  last_name: '',
  first_name: '',
  middle_name: '',
  phone: '',
  email: '',
  department_id: '',
  position_id: '',
  status: '',
  gender: '',
}

const textFilterKeys: Array<
  keyof Pick<
    EmployeeFilterValues,
    'last_name' | 'first_name' | 'middle_name' | 'phone' | 'email'
  >
> = ['last_name', 'first_name', 'middle_name', 'phone', 'email']

const selectFilterKeys: Array<
  keyof Pick<
    EmployeeFilterValues,
    'department_id' | 'position_id' | 'status' | 'gender'
  >
> = ['department_id', 'position_id', 'status', 'gender']

export function EmployeeFiltersPanel({
  className = '',
  onFiltersChange,
}: EmployeeFiltersPanelProps): JSX.Element {
  const { t } = useTranslation()
  const [draftFilters, setDraftFilters] = useState<EmployeeFilterValues>(emptyFilters)
  const [departments, setDepartments] = useState<SelectOption[]>([])
  const [positions, setPositions] = useState<SelectOption[]>([])
  const [isRelationsLoading, setIsRelationsLoading] = useState(true)

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

  function updateFilter(name: keyof EmployeeFilterValues, value: string): void {
    setDraftFilters((current) => ({
      ...current,
      [name]: value,
    }))
  }

  function handleSearch(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    onFiltersChange(buildEmployeeFilters(draftFilters))
  }

  function handleClear(): void {
    setDraftFilters(emptyFilters)
    onFiltersChange(undefined)
  }

  return (
    <aside
      className={[
        'app-surface app-shadow flex h-[80vh] flex-col rounded-[28px] border 2xl:sticky 2xl:top-6',
        className,
      ].join(' ')}
    >
      <div className="app-border-soft border-b px-5 py-4">
        <h3 className="app-text text-base font-black">Фильтры</h3>
        <p className="app-muted mt-1 text-xs font-semibold">
          Поиск и отбор сотрудников
        </p>
      </div>

      <form className="flex min-h-0 flex-1 flex-col gap-3 p-5" onSubmit={handleSearch}>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
          <FilterInput
            placeholder={t('forms.fields.lastName')}
            value={draftFilters.last_name}
            onChange={(value) => updateFilter('last_name', value)}
          />
          <FilterInput
            placeholder={t('forms.fields.firstName')}
            value={draftFilters.first_name}
            onChange={(value) => updateFilter('first_name', value)}
          />
          <FilterInput
            placeholder={t('forms.fields.middleName')}
            value={draftFilters.middle_name}
            onChange={(value) => updateFilter('middle_name', value)}
          />
          <FilterInput
            placeholder={t('forms.fields.phone')}
            value={draftFilters.phone}
            onChange={(value) => updateFilter('phone', value)}
          />
          <FilterInput
            placeholder={t('forms.fields.email')}
            value={draftFilters.email}
            onChange={(value) => updateFilter('email', value)}
          />

          <FilterSelect
            disabled={isRelationsLoading}
            options={departments}
            placeholder={t('forms.fields.departmentId')}
            value={draftFilters.department_id}
            onValueChange={(value) => updateFilter('department_id', value)}
          />
          <FilterSelect
            disabled={isRelationsLoading}
            options={positions}
            placeholder={t('forms.fields.positionId')}
            value={draftFilters.position_id}
            onValueChange={(value) => updateFilter('position_id', value)}
          />
          <FilterSelect
            options={statusOptions}
            placeholder={t('forms.fields.status')}
            value={draftFilters.status}
            onValueChange={(value) => updateFilter('status', value)}
          />
          <FilterSelect
            options={genderOptions}
            placeholder={t('forms.fields.gender')}
            value={draftFilters.gender}
            onValueChange={(value) => updateFilter('gender', value)}
          />
        </div>

        <div className="app-border-soft -mx-5 -mb-5 mt-auto flex gap-3 border-t bg-[var(--color-surface)] p-5">
          <Button
            aria-label={t('employeesPage.filters.searchButton')}
            className="h-11 flex-1 rounded-2xl p-0"
            title={t('employeesPage.filters.searchButton')}
            type="submit"
            variant="primary"
          >
            <FiSearch className="h-5 w-5" />
          </Button>
          <Button
            aria-label={t('employeesPage.filters.clearButton')}
            className="h-11 flex-1 rounded-2xl p-0"
            onClick={handleClear}
            title={t('employeesPage.filters.clearButton')}
            type="button"
            variant="secondary"
          >
            <FiRotateCcw className="h-5 w-5" />
          </Button>
        </div>
      </form>
    </aside>
  )
}

function buildEmployeeFilters(
  values: EmployeeFilterValues,
): Record<string, HrFilterCondition> | undefined {
  const filters: Record<string, HrFilterCondition> = {}

  textFilterKeys.forEach((key) => {
    const value = values[key].trim()

    if (value) {
      filters[key] = {
        operator: 'contains',
        value,
      }
    }
  })

  selectFilterKeys.forEach((key) => {
    const value = values[key]

    if (value) {
      filters[key] = {
        operator: 'equals',
        value:
          key === 'department_id' || key === 'position_id'
            ? Number(value)
            : value,
      }
    }
  })

  return Object.keys(filters).length > 0 ? filters : undefined
}

interface FilterInputProps {
  onChange: (value: string) => void
  placeholder: string
  value: string
}

function FilterInput({
  onChange,
  placeholder,
  value,
}: FilterInputProps): JSX.Element {
  return (
    <Input
      aria-label={placeholder}
      placeholder={placeholder}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  )
}

interface FilterSelectProps {
  disabled?: boolean
  onValueChange: (value: string) => void
  options: SelectOption[]
  placeholder: string
  value: string
}

function FilterSelect({
  disabled = false,
  onValueChange,
  options,
  placeholder,
  value,
}: FilterSelectProps): JSX.Element {
  const { t } = useTranslation()

  return (
    <Select
      allowEmpty
      ariaLabel={placeholder}
      disabled={disabled}
      emptyOptionLabel={t('forms.placeholders.emptyOption')}
      onValueChange={onValueChange}
      options={options}
      placeholder={placeholder}
      value={value}
    />
  )
}