import { FiShield, FiUser } from 'react-icons/fi'
import { useTranslation } from 'react-i18next'

import { PageHeader } from '../shared/ui'

export function ProfilePage(): JSX.Element {
  const { t } = useTranslation()

  return (
    <div className="space-y-6">
      <PageHeader icon={<FiUser />} title={t('profile.title')} />

      <section className="app-surface app-border overflow-hidden rounded-[28px] border">
        <div className="flex flex-col gap-6 p-7 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-5">
            <div className="app-accent-gradient-panel flex h-20 w-20 items-center justify-center rounded-[24px] border text-2xl font-black text-white">
              HR
            </div>
            <h2 className="app-text text-2xl font-black">{t('profile.admin')}</h2>
          </div>

          <span className="app-accent-soft inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-black">
            <FiShield className="h-4 w-4" />
            HR Manager
          </span>
        </div>
      </section>
    </div>
  )
}
