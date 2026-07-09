import { useEffect, useState, type ReactNode } from 'react'
import * as Tabs from '@radix-ui/react-tabs'
import type { TFunction } from 'i18next'
import { FiCalendar, FiMail, FiMapPin, FiPhone, FiUser } from 'react-icons/fi'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { toast } from 'react-toastify'
import { EmptyState, LoadingState } from '../../shared/ui'
import { getAppLocale } from '../../shared/i18n'
import { formatCurrency, formatDate, humanizeStatus } from '../../shared/lib/format'
import { hrApiClient } from '../../shared/lib/hrApiClient'
import type { HrRecord } from '../../shared/types/hr'
import { getRecordLabel } from '../../features/employees/lib/employeeRelations'

export function EmployeeDetailsPage(): JSX.Element {
  const { i18n, t } = useTranslation()
  const locale = getAppLocale(i18n.language)
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

        if (!isActive) return

        setEmployee(record)

        const departmentId = toNumber(record?.department_id)
        const positionId = toNumber(record?.position_id)

        const [department, position] = await Promise.all([
          departmentId ? hrApiClient.getById({ entity: 'departments', id: departmentId }) : Promise.resolve(null),
          positionId ? hrApiClient.getById({ entity: 'positions', id: positionId }) : Promise.resolve(null),
        ])

        if (!isActive) return

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

  const fullName = [
    getString(employee.last_name),
    getString(employee.first_name),
    getString(employee.middle_name),
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <section className="app-surface app-shadow overflow-hidden rounded-[32px] border">
      <Tabs.Root defaultValue="card">
        <div className="app-border-soft border-b px-6 pt-5 sm:px-8">
          <Tabs.List className="flex flex-wrap gap-2" aria-label={t('employeesDetails.title')}>
            <Tabs.Trigger className={detailsTabTriggerClass} value="card">
              {t('employeesDetails.card.title')}
            </Tabs.Trigger>

            <Tabs.Trigger className={detailsTabTriggerClass} value="company">
              {t('employeesDetails.sections.company')}
            </Tabs.Trigger>

            <Tabs.Trigger className={detailsTabTriggerClass} value="notes">
              {t('employeesDetails.sections.notes')}
            </Tabs.Trigger>
          </Tabs.List>
        </div>

        <div className="p-5 sm:p-8">
          <Tabs.Content value="card" className="outline-none">
            <EmployeePassportCard
              employee={employee}
              fullName={fullName}
              locale={locale}
              t={t}
            />
          </Tabs.Content>

          <Tabs.Content value="company" className="outline-none">
            <InfoPanel
              eyebrow={t('employeesDetails.sections.company')}
              title={fullName || t('employeesDetails.title')}
            >
              <InfoField label={t('forms.fields.departmentId')} value={valueOrEmpty(departmentName, t)} />
              <InfoField label={t('forms.fields.positionId')} value={valueOrEmpty(positionName, t)} />
              <InfoField label={t('forms.fields.status')} value={humanizeStatus(employee.status, t)} />
              <InfoField label={t('forms.fields.hireDate')} value={formatDate(employee.hire_date, locale)} />
              <InfoField label={t('forms.fields.salary')} value={formatCurrency(employee.salary, locale)} />
            </InfoPanel>
          </Tabs.Content>

          <Tabs.Content value="notes" className="outline-none">
            <InfoPanel
              eyebrow={t('employeesDetails.sections.notes')}
              title={t('forms.fields.note')}
            >
              <InfoField label={t('forms.fields.note')} value={valueOrEmpty(getString(employee.note), t)} wide />
            </InfoPanel>
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

interface EmployeePassportCardProps {
  employee: HrRecord
  fullName: string
  locale: string
  t: TFunction
}

function EmployeePassportCard({
  employee,
  fullName,
  locale,
  t,
}: EmployeePassportCardProps): JSX.Element {
  const initials = getInitials(fullName)
  const address = composeAddress(employee, t)

  return (
    <article className="mx-auto max-w-7xl overflow-hidden rounded-[36px] border border-slate-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
      <div className="grid min-h-[560px] xl:grid-cols-[380px_minmax(0,1fr)]">
        <aside className="relative overflow-hidden bg-gradient-to-br from-violet-600 via-blue-700 to-indigo-950 p-8 text-white">
          <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10" />
          <div className="absolute -bottom-24 -right-12 h-72 w-72 rounded-full bg-white/10" />
          <div className="absolute bottom-16 left-10 h-2 w-24 rounded-full bg-white/70 shadow-[0_0_24px_rgba(255,255,255,0.9)]" />
          <div className="absolute bottom-20 left-7 h-48 w-48 rounded-full border border-white/15" />
          <div className="absolute bottom-24 left-11 h-40 w-40 rounded-full bg-white/10" />

          <div className="relative z-10 flex h-full min-h-[500px] flex-col items-center justify-center text-center">
            <div className="flex h-44 w-44 items-center justify-center rounded-full border border-white/20 bg-white/15 text-6xl font-black shadow-[0_24px_60px_rgba(15,23,42,0.28)] backdrop-blur">
              {initials}
            </div>

            <div className="mt-12 h-px w-24 bg-white/70 shadow-[0_0_18px_rgba(255,255,255,0.9)]" />

            <p className="mt-10 text-lg font-black uppercase tracking-[0.34em]">
              Сотрудник
            </p>

            <p className="mt-5 text-sm font-black uppercase tracking-[0.38em] text-blue-100/70">
              HR Automation
            </p>
          </div>
        </aside>

        <div className="p-7 sm:p-10 xl:p-12">
          <div className="flex items-center gap-5">
            <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[24px] bg-blue-50 text-blue-700 shadow-sm">
              <FiUser className="h-10 w-10" />
            </span>

            <h2 className="app-text text-3xl font-black tracking-tight sm:text-4xl">
              {fullName || t('employeesDetails.title')}
            </h2>
          </div>

          <div className="my-10 h-px bg-slate-200" />

          <div className="grid gap-6 xl:grid-cols-2">
            <CardInfoBox
              icon={<FiPhone className="h-8 w-8" />}
              label={t('forms.fields.phone')}
              value={valueOrEmpty(getString(employee.phone), t)}
            />

            <CardInfoBox
              icon={<FiMail className="h-8 w-8" />}
              label={t('forms.fields.email')}
              value={valueOrEmpty(getString(employee.email), t)}
            />

            <CardInfoBox
              icon={<FiMapPin className="h-8 w-8" />}
              label={t('forms.fields.address')}
              value={address}
              wide
            />

            <CardInfoBox
              icon={<FiUser className="h-8 w-8" />}
              label={t('forms.fields.gender')}
              value={humanizeStatus(employee.gender, t)}
            />

            <CardInfoBox
              icon={<FiCalendar className="h-8 w-8" />}
              label={t('forms.fields.birthDate')}
              value={formatDate(employee.birth_date, locale)}
            />
          </div>
        </div>
      </div>
    </article>
  )
}

interface CardInfoBoxProps {
  icon: ReactNode
  label: string
  value: string
  wide?: boolean
}

function CardInfoBox({ icon, label, value, wide = false }: CardInfoBoxProps): JSX.Element {
  return (
    <div
      className={[
        'flex min-h-[132px] items-center gap-6 rounded-[26px] border border-slate-200 bg-white p-6 shadow-[0_14px_40px_rgba(15,23,42,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_50px_rgba(15,23,42,0.09)]',
        wide ? 'xl:col-span-2' : '',
      ].join(' ')}
    >
      <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[22px] bg-blue-50 text-blue-700">
        {icon}
      </span>

      <div className="min-w-0">
        <p className="app-muted text-base font-black">{label}</p>
        <p className="app-text mt-3 whitespace-pre-line break-words text-xl font-black leading-relaxed">
          {value}
        </p>
      </div>
    </div>
  )
}

interface InfoPanelProps {
  children: ReactNode
  eyebrow: string
  title: string
}

function InfoPanel({ children, eyebrow, title }: InfoPanelProps): JSX.Element {
  return (
    <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
      <div>
        <p className="app-accent-text text-xs font-black uppercase tracking-[0.24em]">
          {eyebrow}
        </p>
        <h2 className="app-text mt-3 text-2xl font-black">{title}</h2>
      </div>

      <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {children}
      </div>
    </section>
  )
}

interface InfoFieldProps {
  label: string
  value: string
  wide?: boolean
}

function InfoField({ label, value, wide = false }: InfoFieldProps): JSX.Element {
  return (
    <div
      className={[
        'rounded-[24px] border border-slate-200 bg-slate-50/80 p-5 transition hover:bg-white hover:shadow-sm',
        wide ? 'md:col-span-2' : '',
      ].join(' ')}
    >
      <p className="app-muted text-xs font-black uppercase tracking-wide">{label}</p>
      <p className="app-text mt-2 min-h-5 break-words text-sm font-black">{value}</p>
    </div>
  )
}

function composeAddress(employee: HrRecord, t: TFunction): string {
  const parts = [
    getString(employee.address_country),
    getString(employee.address_city),
    getString(employee.address_street),
    getString(employee.address_house) ? `дом ${getString(employee.address_house)}` : '',
    getString(employee.address_apartment) ? `кв. ${getString(employee.address_apartment)}` : '',
  ].filter(Boolean)

  const detailedAddress = getString(employee.address)

  if (parts.length > 0 && detailedAddress) {
    return `${parts.join(', ')}\n${detailedAddress}`
  }

  if (parts.length > 0) {
    return parts.join(', ')
  }

  return valueOrEmpty(detailedAddress, t)
}

function getInitials(value: string): string {
  const parts = value
    .split(' ')
    .map((part) => part.trim())
    .filter(Boolean)

  const initials = parts
    .slice(0, 2)
    .map((part) => Array.from(part)[0])
    .join('')
    .toUpperCase()

  return initials || 'HR'
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