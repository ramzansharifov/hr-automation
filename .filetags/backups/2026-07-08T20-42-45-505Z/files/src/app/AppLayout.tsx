import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import * as Tooltip from '@radix-ui/react-tooltip'
import { FiChevronLeft, FiChevronRight, FiDatabase } from 'react-icons/fi'
import type { AppNavigationItem } from './navigation'
import { bottomNavigationItems, navigationItems } from './navigation'

function navLinkClass(isActive: boolean, isCollapsed: boolean): string {
  return [
    'flex items-center rounded-2xl text-sm font-semibold transition',
    isCollapsed ? 'h-12 justify-center px-0' : 'gap-3 px-4 py-3',
    isActive
      ? 'bg-white text-slate-950 shadow-sm'
      : 'text-slate-400 hover:bg-white/10 hover:text-white',
  ].join(' ')
}

interface SidebarNavLinkProps {
  item: AppNavigationItem
  isCollapsed: boolean
  end?: boolean
}

function SidebarNavLink({ item, isCollapsed, end }: SidebarNavLinkProps): JSX.Element {
  const Icon = item.icon

  const link = (
    <NavLink
      to={item.path}
      end={end}
      aria-label={item.title}
      className={({ isActive }) => navLinkClass(isActive, isCollapsed)}
    >
      <Icon className="h-5 w-5 shrink-0" />
      {!isCollapsed && <span>{item.title}</span>}
    </NavLink>
  )

  if (!isCollapsed) {
    return link
  }

  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>{link}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side="right"
          align="center"
          sideOffset={10}
          className="z-50 rounded-xl bg-slate-950 px-3 py-2 text-xs font-semibold text-white shadow-xl shadow-slate-950/20"
        >
          {item.title}
          <Tooltip.Arrow className="fill-slate-950" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  )
}

export function AppLayout(): JSX.Element {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)

  return (
    <Tooltip.Provider delayDuration={180}>
      <div className="min-h-screen bg-[#f4f6fa] text-slate-950">
        <aside
          className={[
            'fixed inset-y-0 left-0 z-20 flex flex-col border-r border-white/10 bg-[#080b18] text-white transition-all duration-300',
            isSidebarCollapsed ? 'w-20' : 'w-64',
          ].join(' ')}
        >
          <div className={isSidebarCollapsed ? 'px-3 pb-5 pt-6' : 'px-5 pb-5 pt-7'}>
            <div
              className={[
                'flex items-center',
                isSidebarCollapsed ? 'flex-col gap-3' : 'justify-between gap-3',
              ].join(' ')}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-sm font-black">
                  HR
                </div>

                {!isSidebarCollapsed && (
                  <div>
                    <h1 className="text-base font-black tracking-tight">HR Automation</h1>
                    <p className="mt-0.5 text-xs text-slate-500">Кадровая система</p>
                  </div>
                )}
              </div>

              <Tooltip.Root>
                <Tooltip.Trigger asChild>
                  <button
                    type="button"
                    aria-label={isSidebarCollapsed ? 'Раскрыть меню' : 'Свернуть меню'}
                    onClick={() => setIsSidebarCollapsed((current) => !current)}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-slate-400 transition hover:bg-white/10 hover:text-white"
                  >
                    {isSidebarCollapsed ? (
                      <FiChevronRight className="h-5 w-5" />
                    ) : (
                      <FiChevronLeft className="h-5 w-5" />
                    )}
                  </button>
                </Tooltip.Trigger>

                {isSidebarCollapsed && (
                  <Tooltip.Portal>
                    <Tooltip.Content
                      side="right"
                      align="center"
                      sideOffset={10}
                      className="z-50 rounded-xl bg-slate-950 px-3 py-2 text-xs font-semibold text-white shadow-xl shadow-slate-950/20"
                    >
                      Раскрыть меню
                      <Tooltip.Arrow className="fill-slate-950" />
                    </Tooltip.Content>
                  </Tooltip.Portal>
                )}
              </Tooltip.Root>
            </div>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto px-3">
            {navigationItems.map((item) => (
              <SidebarNavLink
                key={item.path}
                item={item}
                end={item.path === '/'}
                isCollapsed={isSidebarCollapsed}
              />
            ))}
          </nav>

          <div className="space-y-1 border-t border-white/10 px-3 py-4">
            {bottomNavigationItems.map((item) => (
              <SidebarNavLink
                key={item.path}
                item={item}
                isCollapsed={isSidebarCollapsed}
              />
            ))}
          </div>
        </aside>

        <div
          className={[
            'min-h-screen transition-all duration-300',
            isSidebarCollapsed ? 'pl-20' : 'pl-64',
          ].join(' ')}
        >
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
    </Tooltip.Provider>
  )
}