import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'react-toastify'
import { Button, EmptyState, LoadingState, PageHeader } from '../../shared/ui'
import { getAppLocale } from '../../shared/i18n'
import { formatCurrency, formatDate, humanizeStatus } from '../../shared/lib/format'
import { hrApiClient } from '../../shared/lib/hrApiClient'
import type { HrRecord } from '../../shared/types/hr'
import { EmployeeInfoSection } from '../../features/employees/components/EmployeeInfoSection'
import { getRecordLabel } from '../../features/employees/lib/employeeRelations'

export function EmployeeDetailsPage(): JSX.Element {
  const { i18n, t } = useTranslation()
  const locale = getAppLocale(i18n.language)
  const navigate = useNavigate()
  const params = useParams()
  const employeeId = Number(params.id)
  const [employee, setEmployee] = useState<HrRecord | null>(null)
  const [departmentName, setDepartmentName] = useState('')
  const [positionName, setPositionName] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    let isActive = true

    async function loadEmployee(): Promise<void> {
      if (!Number.isFinite(employeeId)) {
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      setHasError(false)

      try {
        const record = await hrApiClient.getById({ entity: 'employees', id: employeeId })

        if (!isActive) {
          return
        }

        setEmployee(record)

        const departmentId = toNumber(record?.department_id)
        const positionId = toNumber(record?.position_id)
        const [department, position] = await Promise.all([
          departmentId ? hrApiClient.getById({ entity: 'departments', id: departmentId }) : Promise.resolve(null),
          positionId ? hrApiClient.getById({ entity: 'positions', id: positionId }) : Promise.resolve(null),
        ])

        if (!isActive) {
          return
        }

        setDepartmentName(getRecordLabel(department))
        setPositionName(getRecordLabel(position))
      } catch {
        if (isActive) {
          setHasError(true)
          toast.error(t('employeesDetails.toasts.loadError'))
        }
      } finally {
        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    void loadEmployee()

    return () => {
      isActive = false
    }
  }, [employeeId, t])

  if (isLoading) {
    return <LoadingState label={t('common.table.loading')} />
  }

  if (hasError || !employee) {
    return (
      <EmptyState
        title={t('employeesDetails.notFoundTitle')}
        description={t('employeesDetails.notFoundDescription')}
      />
    )
  }

  const fullName = [getString(employee.last_name), getString(employee.first_name), getString(employee.middle_name)]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('employeesDetails.title')}
        description={fullName}
        actions={
          <Button type="button" onClick={() => navigate('/employees')} variant="secondary">
            {t('employeesDetails.backToList')}
          </Button>
        }
      />

      <section className="app-surface app-shadow rounded-[28px] border p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h1 className="app-text text-3xl font-black">{fullName}</h1>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <SummaryPill label={t('forms.fields.status')} value={humanizeStatus(employee.status, t)} />
            <SummaryPill label={t('forms.fields.departmentId')} value={valueOrEmpty(departmentName, t)} />
            <SummaryPill label={t('forms.fields.positionId')} value={valueOrEmpty(positionName, t)} />
          </div>
        </div>
      </section>

      <EmployeeInfoSection
        title={t('employeesDetails.sections.personal')}
        items={[
          { label: t('forms.fields.lastName'), value: valueOrEmpty(getString(employee.last_name), t) },
          { label: t('forms.fields.firstName'), value: valueOrEmpty(getString(employee.first_name), t) },
          { label: t('forms.fields.middleName'), value: valueOrEmpty(getString(employee.middle_name), t) },
          { label: t('forms.fields.birthDate'), value: formatDate(employee.birth_date, locale) },
          { label: t('forms.fields.gender'), value: humanizeStatus(employee.gender, t) },
          { label: t('forms.fields.phone'), value: valueOrEmpty(getString(employee.phone), t) },
          { label: t('forms.fields.email'), value: valueOrEmpty(getString(employee.email), t) },
        ]}
      />

      <EmployeeInfoSection
        title={t('employeesDetails.sections.address')}
        items={[
          { label: t('forms.fields.addressCountry'), value: valueOrEmpty(getString(employee.address_country), t) },
          { label: t('forms.fields.addressCity'), value: valueOrEmpty(getString(employee.address_city), t) },
          { label: t('forms.fields.addressStreet'), value: valueOrEmpty(getString(employee.address_street), t) },
          { label: t('forms.fields.addressHouse'), value: valueOrEmpty(getString(employee.address_house), t) },
          { label: t('forms.fields.addressApartment'), value: valueOrEmpty(getString(employee.address_apartment), t) },
          { label: t('forms.fields.address'), value: valueOrEmpty(getString(employee.address), t) },
        ]}
      />

      <EmployeeInfoSection
        title={t('employeesDetails.sections.company')}
        items={[
          { label: t('forms.fields.departmentId'), value: valueOrEmpty(departmentName, t) },
          { label: t('forms.fields.positionId'), value: valueOrEmpty(positionName, t) },
          { label: t('forms.fields.hireDate'), value: formatDate(employee.hire_date, locale) },
          { label: t('forms.fields.status'), value: humanizeStatus(employee.status, t) },
          { label: t('forms.fields.salary'), value: formatCurrency(employee.salary, locale) },
        ]}
      />

      <EmployeeInfoSection
        title={t('employeesDetails.sections.notes')}
        items={[
          { label: t('forms.fields.note'), value: valueOrEmpty(getString(employee.note), t) },
        ]}
      />
    </div>
  )
}

interface SummaryPillProps {
  label: string
  value: string
}

function SummaryPill({ label, value }: SummaryPillProps): JSX.Element {
  return (
    <div className="app-surface-muted rounded-2xl px-4 py-3">
      <p className="app-muted text-xs font-black uppercase tracking-wide">{label}</p>
      <p className="app-text mt-1 text-sm font-black">{value}</p>
    </div>
  )
}

function getString(value: unknown): string {
  if (value === null || value === undefined) {
    return ''
  }

  return String(value)
}

function toNumber(value: unknown): number | null {
  const numberValue = typeof value === 'number' ? value : Number(value)

  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : null
}

function valueOrEmpty(value: string, t: (key: string) => string): string {
  return value.trim() || t('employeesDetails.emptyValue')
}
