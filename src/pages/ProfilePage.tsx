import { FiShield, FiUser } from 'react-icons/fi'
import { useTranslation } from 'react-i18next'

export function ProfilePage(): JSX.Element {
  const { t } = useTranslation()

  return (
    <div className="space-y-6">
      <section className="app-accent-gradient-panel flex items-center gap-4 overflow-hidden rounded-[28px] border p-6 sm:p-7">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-white backdrop-blur">
          <FiUser className="h-6 w-6" />
        </span>
        <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
          {t('profile.title')}
        </h1>
      </section>

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
