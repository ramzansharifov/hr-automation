import { NavLink, Outlet } from 'react-router-dom'
import { FiDatabase } from 'react-icons/fi'
import { bottomNavigationItems, navigationItems } from './navigation'

function navLinkClass(isActive: boolean): string {
  return [
    'flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition',
    isActive
      ? 'bg-white text-slate-950 shadow-sm'
      : 'text-slate-400 hover:bg-white/10 hover:text-white',
  ].join(' ')
}

export function AppLayout(): JSX.Element {
  return (
    <div className="min-h-screen bg-[#f4f6fa] text-slate-950">
      <aside className="fixed inset-y-0 left-0 z-20 flex w-64 flex-col border-r border-white/10 bg-[#080b18] text-white">
        <div className="px-5 pb-5 pt-7">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-sm font-black">
              HR
            </div>

            <div>
              <h1 className="text-base font-black tracking-tight">HR Automation</h1>
              <p className="mt-0.5 text-xs text-slate-500">Кадровая система</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3">
          {navigationItems.map((item) => {
            const Icon = item.icon

            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) => navLinkClass(isActive)}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span>{item.title}</span>
              </NavLink>
            )
          })}
        </nav>

        <div className="space-y-1 border-t border-white/10 px-3 py-4">
          {bottomNavigationItems.map((item) => {
            const Icon = item.icon

            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => navLinkClass(isActive)}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span>{item.title}</span>
              </NavLink>
            )
          })}
        </div>
      </aside>

      <div className="min-h-screen pl-64">
        <header className="sticky top-0 z-10 border-b border-slate-200/70 bg-white/80 px-8 py-5 backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-black tracking-tight text-slate-950">
                Панель управления
              </h2>
            </div>

            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 shadow-sm">
              <FiDatabase className="h-4 w-4 text-blue-600" />
              SQLite активен
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