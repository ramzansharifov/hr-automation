import { useEffect, useState } from 'react'
import * as Tabs from '@radix-ui/react-tabs'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'react-toastify'
import { Button, EmptyState, LoadingState } from '../../shared/ui'
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
    <section className="app-surface app-shadow overflow-hidden rounded-[32px] border">
      <Tabs.Root defaultValue="card">
        <div className="app-border-soft flex flex-col gap-4 border-b px-6 pt-5 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
          <Tabs.List className="flex flex-wrap gap-2" aria-label={t('employeesDetails.title')}>
            <Tabs.Trigger className={detailsTabTriggerClass} value="card">
              {t('employeesDetails.sections.card')}
            </Tabs.Trigger>
            <Tabs.Trigger className={detailsTabTriggerClass} value="personal">
              {t('employeesDetails.sections.personal')}
            </Tabs.Trigger>
            <Tabs.Trigger className={detailsTabTriggerClass} value="address">
              {t('employeesDetails.sections.address')}
            </Tabs.Trigger>
            <Tabs.Trigger className={detailsTabTriggerClass} value="company">
              {t('employeesDetails.sections.company')}
            </Tabs.Trigger>
            <Tabs.Trigger className={detailsTabTriggerClass} value="notes">
              {t('employeesDetails.sections.notes')}
            </Tabs.Trigger>
          </Tabs.List>

          <Button type="button" onClick={() => navigate('/employees')} variant="secondary">
            {t('employeesDetails.backToList')}
          </Button>
        </div>

        <div className="p-6 sm:p-8">
          <Tabs.Content value="card" className="outline-none">
            <div className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-sm">
              <div className="grid lg:grid-cols-[320px_minmax(0,1fr)]">
                <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700 to-slate-950 p-7 text-white">
                  <div className="absolute -right-16 -top-16 h-44 w-44 rounded-full bg-white/10" />
                  <div className="absolute -bottom-20 -left-20 h-56 w-56 rounded-full bg-white/10" />

                  <div className="relative z-10 flex h-full min-h-[360px] flex-col justify-between">
                    <div>
                      <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-white/15 text-xl font-black shadow-xl shadow-blue-950/20">
                        HR
                      </div>

                      <p className="mt-8 text-xs font-black uppercase tracking-[0.28em] text-blue-100">
                        {t('employeesDetails.sections.card')}
                      </p>
                      <h2 className="mt-3 text-3xl font-black leading-tight tracking-tight">
                        {fullName || t('employeesDetails.title')}
                      </h2>
                    </div>

                    <div className="rounded-3xl border border-white/15 bg-white/10 p-4 backdrop-blur">
                      <p className="text-xs font-black uppercase tracking-[0.24em] text-blue-100">
                        ID сотрудника
                      </p>
                      <p className="mt-2 text-2xl font-black">#{employeeId}</p>
                    </div>
                  </div>
                </div>

                <div className="p-6 sm:p-7">
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <PassportField label={t('forms.fields.status')} value={humanizeStatus(employee.status, t)} />
                    <PassportField label={t('forms.fields.departmentId')} value={valueOrEmpty(departmentName, t)} />
                    <PassportField label={t('forms.fields.positionId')} value={valueOrEmpty(positionName, t)} />
                    <PassportField label={t('forms.fields.phone')} value={valueOrEmpty(getString(employee.phone), t)} />
                    <PassportField label={t('forms.fields.email')} value={valueOrEmpty(getString(employee.email), t)} />
                    <PassportField label={t('forms.fields.gender')} value={humanizeStatus(employee.gender, t)} />
                    <PassportField label={t('forms.fields.birthDate')} value={formatDate(employee.birth_date, locale)} />
                    <PassportField label={t('forms.fields.hireDate')} value={formatDate(employee.hire_date, locale)} />
                    <PassportField label={t('forms.fields.salary')} value={formatCurrency(employee.salary, locale)} />
                  </div>
                </div>
              </div>
            </div>
          </Tabs.Content>

          <Tabs.Content value="personal" className="outline-none">
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
          </Tabs.Content>

          <Tabs.Content value="address" className="outline-none">
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
          </Tabs.Content>

          <Tabs.Content value="company" className="outline-none">
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
          </Tabs.Content>

          <Tabs.Content value="notes" className="outline-none">
            <EmployeeInfoSection
              title={t('employeesDetails.sections.notes')}
              items={[
                { label: t('forms.fields.note'), value: valueOrEmpty(getString(employee.note), t) },
              ]}
            />
          </Tabs.Content>
        </div>
      </Tabs.Root>
    </section>
  )
}

const detailsTabTriggerClass = [
  'relative -mb-px rounded-t-2xl px-5 py-3 text-sm font-black transition',
  'text-slate-500 hover:bg-slate-50 hover:text-slate-900',
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400',
  'data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-sm data-[state=active]:shadow-blue-600/20',
].join(' ')

interface PassportFieldProps {
  label: string
  value: string
}

function PassportField({ label, value }: PassportFieldProps): JSX.Element {
  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-5">
      <p className="app-muted text-xs font-black uppercase tracking-wide">{label}</p>
      <p className="app-text mt-2 min-h-5 break-words text-sm font-black">{value}</p>
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
