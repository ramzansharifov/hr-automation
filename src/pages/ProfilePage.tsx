export function ProfilePage(): JSX.Element {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-black tracking-tight text-slate-950">Профиль</h1>

      <section className="rounded-[28px] border border-slate-200 bg-white p-7 shadow-sm">
        <div className="flex items-center gap-5">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-blue-600 text-xl font-black text-white">
            HR
          </div>

          <div>
            <h2 className="text-xl font-black text-slate-950">Администратор</h2>
            <p className="mt-1 text-sm text-slate-500">Локальный пользователь системы</p>
          </div>
        </div>
      </section>
    </div>
  )
}