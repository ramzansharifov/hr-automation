import { useTranslation } from 'react-i18next'

export function ProfilePage(): JSX.Element {
  const { t } = useTranslation()

  return (
    <div className="space-y-6">
      <h1 className="app-text text-3xl font-black tracking-tight">{t('profile.title')}</h1>

      <section className="app-surface app-border rounded-[28px] border p-7">
        <div className="flex items-center gap-5">
          <div className="app-accent flex h-16 w-16 items-center justify-center rounded-3xl text-xl font-black">
            HR
          </div>

          <div>
            <h2 className="app-text text-xl font-black">{t('profile.admin')}</h2>
            <p className="app-muted mt-1 text-sm">{t('profile.localUser')}</p>
          </div>
        </div>
      </section>
    </div>
  )
}
