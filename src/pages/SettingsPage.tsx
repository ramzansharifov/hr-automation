export function SettingsPage(): JSX.Element {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-black tracking-tight text-slate-950">Настройки</h1>

      <section className="rounded-[28px] border border-slate-200 bg-white p-7 shadow-sm">
        <h2 className="text-xl font-black text-slate-950">Система</h2>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl bg-slate-50 p-5">
            <p className="text-sm font-bold text-slate-950">База данных</p>
            <p className="mt-2 text-sm text-slate-500">SQLite подключена через Electron backend.</p>
          </div>

          <div className="rounded-2xl bg-slate-50 p-5">
            <p className="text-sm font-bold text-slate-950">Интерфейс</p>
            <p className="mt-2 text-sm text-slate-500">Светлая лаконичная тема.</p>
          </div>
        </div>
      </section>
    </div>
  )
}