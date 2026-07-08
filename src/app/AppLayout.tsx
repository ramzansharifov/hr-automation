import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import * as Tooltip from '@radix-ui/react-tooltip'
import { FiChevronLeft, FiChevronRight, FiDatabase } from 'react-icons/fi'
import type { AppNavigationItem } from './navigation'
import { bottomNavigationItems, navigationItems } from './navigation'

function getExpandedLinkClass(isActive: boolean): string {
  return [
    'group flex h-12 items-center gap-3 rounded-2xl px-3 text-sm font-bold transition-all duration-200',
    isActive
      ? 'bg-blue-600 text-white shadow-lg shadow-blue-950/25'
      : 'text-slate-400 hover:bg-white/[0.07] hover:text-white',
  ].join(' ')
}

function getCollapsedLinkClass(isActive: boolean): string {
  return [
    'group mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border transition-all duration-200',
    isActive
      ? 'border-blue-500 bg-blue-600 text-white shadow-lg shadow-blue-950/25'
      : 'border-white/[0.06] bg-white/[0.035] text-slate-400 hover:border-white/10 hover:bg-white/[0.09] hover:text-white',
  ].join(' ')
}

interface SidebarItemProps {
  item: AppNavigationItem
  isCollapsed: boolean
  end?: boolean
}

function SidebarItem({ item, isCollapsed, end }: SidebarItemProps): JSX.Element {
  const Icon = item.icon

  const link = (
    <NavLink
      to={item.path}
      end={end}
      aria-label={item.title}
      className={({ isActive }) =>
        isCollapsed ? getCollapsedLinkClass(isActive) : getExpandedLinkClass(isActive)
      }
    >
      <Icon className="h-[19px] w-[19px] shrink-0" />

      {!isCollapsed && <span className="truncate">{item.title}</span>}
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
          sideOffset={12}
          className="z-50 select-none rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs font-bold text-white shadow-2xl"
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
    <Tooltip.Provider delayDuration={120}>
      <div className="min-h-screen bg-[#f5f7fb] text-slate-950">
        <aside
          className={[
            'fixed inset-y-0 left-0 z-30 flex flex-col border-r border-white/10 bg-[#070a17] text-white transition-[width] duration-300 ease-out',
            isSidebarCollapsed ? 'w-[88px]' : 'w-[264px]',
          ].join(' ')}
        >
          <div className={isSidebarCollapsed ? 'px-4 pb-5 pt-5' : 'px-4 pb-5 pt-5'}>
            <div
              className={[
                'flex items-center',
                isSidebarCollapsed ? 'justify-center' : 'justify-between gap-3',
              ].join(' ')}
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-blue-600 text-sm font-black tracking-tight shadow-lg shadow-blue-950/30">
                  HR
                </div>

                {!isSidebarCollapsed && (
                  <div className="min-w-0">
                    <h1 className="truncate text-[15px] font-black tracking-tight">
                      HR Automation
                    </h1>
                    <p className="mt-0.5 truncate text-xs font-medium text-slate-500">
                      Кадровая система
                    </p>
                  </div>
                )}
              </div>
            </div>

            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <button
                  type="button"
                  aria-label={isSidebarCollapsed ? 'Раскрыть сайдбар' : 'Свернуть сайдбар'}
                  onClick={() => setIsSidebarCollapsed((current) => !current)}
                  className="absolute right-[-14px] top-8 z-40 flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-md transition hover:bg-slate-50 hover:text-blue-600"
                >
                  {isSidebarCollapsed ? (
                    <FiChevronRight className="h-4 w-4" />
                  ) : (
                    <FiChevronLeft className="h-4 w-4" />
                  )}
                </button>
              </Tooltip.Trigger>

              <Tooltip.Portal>
                <Tooltip.Content
                  side="right"
                  align="center"
                  sideOffset={14}
                  className="z-50 select-none rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs font-bold text-white shadow-2xl"
                >
                  {isSidebarCollapsed ? 'Раскрыть' : 'Свернуть'}
                  <Tooltip.Arrow className="fill-slate-950" />
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
          </div>

          <div className={isSidebarCollapsed ? 'px-4' : 'px-4'}>
            <div className="h-px bg-white/10" />
          </div>

          <nav className={isSidebarCollapsed ? 'flex-1 space-y-3 px-4 py-5' : 'flex-1 space-y-2 px-4 py-5'}>
            {navigationItems.map((item) => (
              <SidebarItem
                key={item.path}
                item={item}
                end={item.path === '/'}
                isCollapsed={isSidebarCollapsed}
              />
            ))}
          </nav>

          <div className={isSidebarCollapsed ? 'px-4' : 'px-4'}>
            <div className="h-px bg-white/10" />
          </div>

          <div className={isSidebarCollapsed ? 'space-y-3 px-4 py-5' : 'space-y-2 px-4 py-5'}>
            {bottomNavigationItems.map((item) => (
              <SidebarItem key={item.path} item={item} isCollapsed={isSidebarCollapsed} />
            ))}
          </div>
        </aside>

        <div
          className={[
            'min-h-screen transition-[padding] duration-300 ease-out',
            isSidebarCollapsed ? 'pl-[88px]' : 'pl-[264px]',
          ].join(' ')}
        >
          <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/85 px-8 py-4 backdrop-blur-xl">
            <div className="flex items-center justify-between gap-6">
              <h2 className="text-xl font-black tracking-tight text-slate-950">
                Панель управления
              </h2>

              <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 shadow-sm">
                <FiDatabase className="h-4 w-4 text-blue-600" />
                SQLite активен
              </div>
            </div>
          </header>

          <main className="px-8 py-7">
            <Outlet />
          </main>
        </div>
      </div>
    </Tooltip.Provider>
  )
}