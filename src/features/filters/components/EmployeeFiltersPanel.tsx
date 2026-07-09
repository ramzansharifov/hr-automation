import type { FormEvent } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { FiRotateCcw, FiSearch } from 'react-icons/fi'
import { useTranslation } from 'react-i18next'
import { toast } from 'react-toastify'
import { Button, Input, Select, type SelectOption } from '../../../shared/ui'
import { loadEmployeeRelationOptions } from '../../employees/lib/employeeRelations'
import {
  clearStoredEmployeeFilterValues,
  emptyEmployeeFilters,
  getStoredEmployeeFilterValues,
  setStoredEmployeeFilterValues,
  type EmployeeFilterValues,
} from '../employeeFiltersStore'

interface EmployeeFiltersPanelProps {
  className?: string
}

export function EmployeeFiltersPanel({ className = '' }: EmployeeFiltersPanelProps): JSX.Element {
  const { t } = useTranslation()
  const [draftFilters, setDraftFilters] = useState<EmployeeFilterValues>(getStoredEmployeeFilterValues)
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
    setStoredEmployeeFilterValues(draftFilters)
    toast.success('Фильтры применены')
  }

  function handleClear(): void {
    setDraftFilters(emptyEmployeeFilters)
    clearStoredEmployeeFilterValues()
    toast.success('Фильтры очищены')
  }

  return (
    <section
      className={[
        'app-surface app-shadow mx-auto max-w-5xl overflow-hidden rounded-[28px] border',
        className,
      ].join(' ')}
    >
      <div className="app-border-soft border-b px-6 py-5">
        <h1 className="app-text text-2xl font-black">Фильтры</h1>
        <p className="app-muted mt-2 text-sm font-semibold">
          Настрой поиск сотрудников. После применения вернись в раздел «Сотрудники».
        </p>
      </div>

      <form className="space-y-6 p-6" onSubmit={handleSearch}>
        <div>
          <h2 className="app-text text-base font-black">Личные данные</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
              options={genderOptions}
              placeholder={t('forms.fields.gender')}
              value={draftFilters.gender}
              onValueChange={(value) => updateFilter('gender', value)}
            />
          </div>
        </div>

        <div>
          <h2 className="app-text text-base font-black">Данные по компании</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
          </div>
        </div>

        <div className="app-border-soft flex flex-col gap-3 border-t pt-5 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="secondary"
            onClick={handleClear}
            leftIcon={<FiRotateCcw className="h-4 w-4" />}
          >
            Очистить
          </Button>
          <Button
            type="submit"
            variant="primary"
            leftIcon={<FiSearch className="h-4 w-4" />}
          >
            Применить фильтры
          </Button>
        </div>
      </form>
    </section>
  )
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