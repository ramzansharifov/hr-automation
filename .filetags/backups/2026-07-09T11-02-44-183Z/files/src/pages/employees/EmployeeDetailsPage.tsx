import { useEffect, useState, type ReactNode } from 'react'
import * as Tabs from '@radix-ui/react-tabs'
import { motion } from 'framer-motion'
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
import { HRLogo } from '../../app/brand/HRLogo'

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
    <motion.section
      key={employeeId}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.38, ease: 'easeOut' }}
      className="app-surface app-shadow overflow-hidden rounded-[32px] border"
    >
      <Tabs.Root defaultValue="card">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, delay: 0.08, ease: 'easeOut' }}
          className="app-border-soft border-b px-6 pt-5 sm:px-8"
        >
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
        </motion.div>

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
    </motion.section>
  )
}

const detailsTabTriggerClass = [
  'app-tab-trigger relative -mb-px rounded-t-2xl border border-transparent px-5 py-3 text-sm font-black transition',
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-border)]',
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
  const address = composeAddress(employee, t)

  return (
    <motion.article
      initial={{ opacity: 0, scale: 0.985, y: 18 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.42, delay: 0.12, ease: 'easeOut' }}
      className="app-surface app-shadow-lg mx-auto max-w-7xl overflow-hidden rounded-[36px] border"
    >
      <div className="grid min-h-[560px] xl:grid-cols-[380px_minmax(0,1fr)]">
        <motion.aside
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.42, delay: 0.18, ease: 'easeOut' }}
          className="app-accent-gradient-panel relative overflow-hidden p-8 text-white"
        >
          <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10" />
          <div className="absolute -bottom-24 -right-12 h-72 w-72 rounded-full bg-white/10" />
          <div className="app-accent-glow-line absolute bottom-16 left-10 h-2 w-24 rounded-full" />
          <div className="absolute bottom-20 left-7 h-48 w-48 rounded-full border border-white/15" />
          <div className="absolute bottom-24 left-11 h-40 w-40 rounded-full bg-white/10" />

          <div className="relative z-10 flex h-full min-h-[500px] flex-col items-center justify-center text-center">
            <div className="relative flex h-44 w-44 items-center justify-center">
              <div className="absolute inset-4 rounded-full bg-white/20 blur-2xl" />
              <HRLogo className="app-accent-drop-shadow relative h-40 w-40" />
            </div>

            <div className="app-accent-glow-line mt-12 h-px w-24" />

            <p className="mt-10 text-lg font-black uppercase tracking-[0.34em]">
              Сотрудник
            </p>

            <p className="mt-5 text-sm font-black uppercase tracking-[0.38em] text-white/70">
              HR Automation
            </p>
          </div>
        </motion.aside>

        <div className="p-7 sm:p-10 xl:p-12">
          <motion.div
            initial={{ opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.34, delay: 0.26, ease: 'easeOut' }}
            className="flex items-center gap-5"
          >
            <span className="app-accent-soft app-accent-shadow-sm flex h-20 w-20 shrink-0 items-center justify-center rounded-[24px]">
              <FiUser className="h-10 w-10" />
            </span>

            <h2 className="app-text text-3xl font-black tracking-tight sm:text-4xl">
              {fullName || t('employeesDetails.title')}
            </h2>
          </motion.div>

          <motion.div
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{ scaleX: 1, opacity: 1 }}
            transition={{ duration: 0.36, delay: 0.32, ease: 'easeOut' }}
            className="my-10 h-px origin-left bg-[var(--color-border)]"
          />

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
    </motion.article>
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
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: 'easeOut' }}
      whileHover={{ y: -3 }}
      className={[
        'app-surface app-shadow app-hover-accent-shadow flex min-h-[132px] items-center gap-6 rounded-[26px] border p-6 transition',
        wide ? 'xl:col-span-2' : '',
      ].join(' ')}
    >
      <span className="app-accent-soft app-accent-shadow-sm flex h-16 w-16 shrink-0 items-center justify-center rounded-[22px]">
        {icon}
      </span>

      <div className="min-w-0">
        <p className="app-muted text-base font-black">{label}</p>
        <p className="app-text mt-3 whitespace-pre-line break-words text-xl font-black leading-relaxed">
          {value}
        </p>
      </div>
    </motion.div>
  )
}

interface InfoPanelProps {
  children: ReactNode
  eyebrow: string
  title: string
}

function InfoPanel({ children, eyebrow, title }: InfoPanelProps): JSX.Element {
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.34, ease: 'easeOut' }}
      className="app-surface app-shadow rounded-[30px] border p-6 sm:p-7"
    >
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.26, delay: 0.08, ease: 'easeOut' }}
      >
        <p className="app-accent-text text-xs font-black uppercase tracking-[0.24em]">
          {eyebrow}
        </p>
        <h2 className="app-text mt-3 text-2xl font-black">{title}</h2>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.14, ease: 'easeOut' }}
        className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-3"
      >
        {children}
      </motion.div>
    </motion.section>
  )
}

interface InfoFieldProps {
  label: string
  value: string
  wide?: boolean
}

function InfoField({ label, value, wide = false }: InfoFieldProps): JSX.Element {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: 'easeOut' }}
      whileHover={{ y: -2 }}
      className={[
        'app-surface-muted app-border rounded-[24px] border p-5 transition hover:bg-[var(--color-surface-hover)]',
        wide ? 'md:col-span-2' : '',
      ].join(' ')}
    >
      <p className="app-muted text-xs font-black uppercase tracking-wide">{label}</p>
      <p className="app-text mt-2 min-h-5 break-words text-sm font-black">{value}</p>
    </motion.div>
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