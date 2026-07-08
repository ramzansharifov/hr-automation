export function ProfilePage(): JSX.Element {
  return (
    <div className="space-y-6">
      <h1 className="app-text text-3xl font-black tracking-tight">Профиль</h1>

      <section className="app-surface app-shadow rounded-[28px] border p-7">
        <div className="flex items-center gap-5">
          <div className="app-accent flex h-16 w-16 items-center justify-center rounded-3xl text-xl font-black">
            HR
          </div>

          <div>
            <h2 className="app-text text-xl font-black">Администратор</h2>
            <p className="app-muted mt-1 text-sm">Локальный пользователь системы</p>
          </div>
        </div>
      </section>
    </div>
  )
}
