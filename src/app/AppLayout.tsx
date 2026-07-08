import { NavLink, Outlet } from 'react-router-dom'
import { FiDatabase, FiShield } from 'react-icons/fi'
import { navigationItems } from './navigation'

export function AppLayout(): JSX.Element {
  const today = new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date())

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950">
      <aside className="fixed inset-y-0 left-0 z-20 flex w-72 flex-col border-r border-slate-200 bg-slate-950 text-white">
        <div className="border-b border-white/10 p-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500 text-xl font-black">
            HR
          </div>

          <h1 className="mt-4 text-xl font-bold">HR Automation</h1>
          <p className="mt-1 text-sm text-slate-400">Автоматизация отдела кадров</p>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-4">
          {navigationItems.map((item) => {
            const Icon = item.icon

            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) =>
                  [
                    'group flex items-start gap-3 rounded-2xl px-4 py-3 text-sm transition',
                    isActive
                      ? 'bg-blue-500 text-white shadow-lg shadow-blue-950/20'
                      : 'text-slate-300 hover:bg-white/10 hover:text-white',
                  ].join(' ')
                }
              >
                <Icon className="mt-0.5 h-5 w-5 shrink-0" />
                <span>
                  <span className="block font-semibold">{item.title}</span>
                  <span className="mt-0.5 block text-xs text-current opacity-70">
                    {item.description}
                  </span>
                </span>
              </NavLink>
            )
          })}
        </nav>

        <div className="border-t border-white/10 p-4">
          <div className="rounded-2xl bg-white/10 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <FiShield className="h-4 w-4" />
              Локальная база
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-400">
              Данные хранятся в SQLite через Electron backend.
            </p>
          </div>
        </div>
      </aside>

      <div className="min-h-screen pl-72">
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/85 px-8 py-4 backdrop-blur">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">{today}</p>
              <h2 className="text-2xl font-bold tracking-tight text-slate-950">
                Панель управления
              </h2>
            </div>

            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              <FiDatabase className="h-4 w-4 text-blue-600" />
              SQLite backend активен
            </div>
          </div>
        </header>

        <main className="p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}