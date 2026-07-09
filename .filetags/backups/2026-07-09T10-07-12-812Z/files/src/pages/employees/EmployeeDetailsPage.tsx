import { useEffect, useState, type ReactNode } from 'react'
import * as Tabs from '@radix-ui/react-tabs'
import type { TFunction } from 'i18next'
import { FiRefreshCw } from 'react-icons/fi'
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
  const [isCardFlipped, setIsCardFlipped] = useState(false)

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
              isFlipped={isCardFlipped}
              locale={locale}
              onFlip={() => setIsCardFlipped((current) => !current)}
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
  isFlipped: boolean
  locale: string
  onFlip: () => void
  t: TFunction
}

function EmployeePassportCard({
  employee,
  fullName,
  isFlipped,
  locale,
  onFlip,
  t,
}: EmployeePassportCardProps): JSX.Element {
  const initials = getInitials(fullName)
  const flipLabel = isFlipped
    ? t('employeesDetails.card.flipToPersonal')
    : t('employeesDetails.card.flipToAddress')

  return (
    <div className="mx-auto max-w-6xl">
      <div className="relative min-h-[720px] [perspective:1600px] sm:min-h-[620px] xl:min-h-[520px]">
        <div
          className={[
            'relative min-h-[720px] transition-transform duration-500 [transform-style:preserve-3d] sm:min-h-[620px] xl:min-h-[520px]',
            isFlipped ? '[transform:rotateY(180deg)]' : '',
          ].join(' ')}
        >
          <article className="absolute inset-0 overflow-hidden rounded-[34px] border border-slate-200 bg-white shadow-sm [backface-visibility:hidden]">
            <div className="grid h-full min-h-[720px] sm:min-h-[620px] xl:min-h-[520px] xl:grid-cols-[340px_minmax(0,1fr)]">
              <PassportVisualPanel
                badge={t('employeesDetails.card.frontSide')}
                initials={initials}
                title={fullName || t('employeesDetails.title')}
              />

              <div className="relative p-6 sm:p-8">
                <FlipButton label={flipLabel} onClick={onFlip} />

                <div className="pr-14">
                  <p className="app-accent-text text-xs font-black uppercase tracking-[0.24em]">
                    {t('employeesDetails.card.title')}
                  </p>
                  <h3 className="app-text mt-3 text-2xl font-black">
                    {t('employeesDetails.sections.personal')}
                  </h3>
                </div>

                <div className="mt-7 grid gap-4 md:grid-cols-2">
                  <InfoField label={t('forms.fields.lastName')} value={valueOrEmpty(getString(employee.last_name), t)} />
                  <InfoField label={t('forms.fields.firstName')} value={valueOrEmpty(getString(employee.first_name), t)} />
                  <InfoField label={t('forms.fields.middleName')} value={valueOrEmpty(getString(employee.middle_name), t)} />
                  <InfoField label={t('forms.fields.birthDate')} value={formatDate(employee.birth_date, locale)} />
                  <InfoField label={t('forms.fields.gender')} value={humanizeStatus(employee.gender, t)} />
                  <InfoField label={t('forms.fields.phone')} value={valueOrEmpty(getString(employee.phone), t)} />
                  <InfoField label={t('forms.fields.email')} value={valueOrEmpty(getString(employee.email), t)} wide />
                </div>
              </div>
            </div>
          </article>

          <article className="absolute inset-0 overflow-hidden rounded-[34px] border border-slate-200 bg-white shadow-sm [backface-visibility:hidden] [transform:rotateY(180deg)]">
            <div className="grid h-full min-h-[720px] sm:min-h-[620px] xl:min-h-[520px] xl:grid-cols-[minmax(0,1fr)_340px]">
              <div className="relative p-6 sm:p-8">
                <FlipButton label={flipLabel} onClick={onFlip} />

                <div className="pr-14">
                  <p className="app-accent-text text-xs font-black uppercase tracking-[0.24em]">
                    {t('employeesDetails.card.backSide')}
                  </p>
                  <h3 className="app-text mt-3 text-2xl font-black">
                    {t('employeesDetails.sections.address')}
                  </h3>
                </div>

                <div className="mt-7 grid gap-4 md:grid-cols-2">
                  <InfoField label={t('forms.fields.addressCountry')} value={valueOrEmpty(getString(employee.address_country), t)} />
                  <InfoField label={t('forms.fields.addressCity')} value={valueOrEmpty(getString(employee.address_city), t)} />
                  <InfoField label={t('forms.fields.addressStreet')} value={valueOrEmpty(getString(employee.address_street), t)} />
                  <InfoField label={t('forms.fields.addressHouse')} value={valueOrEmpty(getString(employee.address_house), t)} />
                  <InfoField label={t('forms.fields.addressApartment')} value={valueOrEmpty(getString(employee.address_apartment), t)} />
                  <InfoField label={t('forms.fields.address')} value={valueOrEmpty(getString(employee.address), t)} wide />
                </div>
              </div>

              <PassportVisualPanel
                badge={t('employeesDetails.card.backSide')}
                initials={initials}
                title={fullName || t('employeesDetails.title')}
                reversed
              />
            </div>
          </article>
        </div>
      </div>
    </div>
  )
}

interface PassportVisualPanelProps {
  badge: string
  initials: string
  reversed?: boolean
  title: string
}

function PassportVisualPanel({
  badge,
  initials,
  reversed = false,
  title,
}: PassportVisualPanelProps): JSX.Element {
  return (
    <aside
      className={[
        'relative overflow-hidden p-7 text-white',
        reversed
          ? 'bg-gradient-to-br from-slate-950 via-slate-900 to-blue-700'
          : 'bg-gradient-to-br from-blue-600 via-blue-700 to-slate-950',
      ].join(' ')}
    >
      <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-white/10" />
      <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-white/10" />
      <div className="absolute bottom-0 right-0 h-40 w-40 bg-white/5 blur-3xl" />

      <div className="relative z-10 flex h-full flex-col justify-between gap-10">
        <div>
          <div className="flex h-20 w-20 items-center justify-center rounded-[28px] bg-white/15 text-2xl font-black shadow-xl shadow-blue-950/25 backdrop-blur">
            {initials}
          </div>

          <p className="mt-9 text-xs font-black uppercase tracking-[0.28em] text-blue-100">
            {badge}
          </p>

          <h2 className="mt-4 text-4xl font-black leading-tight tracking-tight">
            {title}
          </h2>
        </div>

        <div className="rounded-[28px] border border-white/15 bg-white/10 p-5 backdrop-blur">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-blue-100">
            HR Automation
          </p>
          <p className="mt-2 text-lg font-black">
            Кадровая карточка
          </p>
        </div>
      </div>
    </aside>
  )
}

interface FlipButtonProps {
  label: string
  onClick: () => void
}

function FlipButton({ label, onClick }: FlipButtonProps): JSX.Element {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="absolute right-5 top-5 inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-blue-600 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400"
    >
      <FiRefreshCw className="h-5 w-5" />
    </button>
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