import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import * as Tooltip from '@radix-ui/react-tooltip'
import { FiChevronLeft, FiChevronRight, FiDatabase } from 'react-icons/fi'
import type { AppNavigationItem } from './navigation'
import { bottomNavigationItems, navigationItems } from './navigation'

const EXPANDED_SIDEBAR_WIDTH = '276px'
const COLLAPSED_SIDEBAR_WIDTH = '84px'

const tooltipContentClass =
  'z-50 select-none rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs font-semibold text-white shadow-xl'

function getExpandedLinkClass(isActive: boolean): string {
  return [
    'group flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors duration-200',
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400',
    isActive
      ? 'bg-blue-600 text-white shadow-sm shadow-blue-950/30'
      : 'text-slate-400 hover:bg-white/[0.07] hover:text-white',
  ].join(' ')
}

function getCollapsedLinkClass(isActive: boolean): string {
  return [
    'group flex h-11 w-11 items-center justify-center rounded-xl border transition-colors duration-200',
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400',
    isActive
      ? 'border-blue-500 bg-blue-600 text-white shadow-md shadow-blue-950/35'
      : 'border-[#1b2540] bg-[#0d1427] text-slate-300 hover:border-[#2a3859] hover:bg-[#151f36] hover:text-white',
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
      <Icon className="h-[18px] w-[18px] shrink-0" />
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
          className={tooltipContentClass}
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
  const sidebarWidth = isSidebarCollapsed ? COLLAPSED_SIDEBAR_WIDTH : EXPANDED_SIDEBAR_WIDTH

  return (
    <Tooltip.Provider delayDuration={120}>
      <div className="min-h-screen overflow-x-hidden bg-[#f5f7fb] text-slate-950">
        <aside
          className="fixed inset-y-0 left-0 z-30 flex flex-col overflow-hidden border-r border-[#151c31] bg-[#070a17] text-white transition-[width] duration-300 ease-out"
          style={{ width: sidebarWidth }}
        >
          <div className={isSidebarCollapsed ? 'px-4 pb-4 pt-5' : 'px-5 pb-5 pt-5'}>
            <div
              className={[
                'flex items-center',
                isSidebarCollapsed ? 'flex-col gap-3' : 'justify-between gap-4',
              ].join(' ')}
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-sm font-black tracking-tight text-white shadow-md shadow-blue-950/35">
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

              <button
                type="button"
                aria-label={isSidebarCollapsed ? 'Раскрыть сайдбар' : 'Свернуть сайдбар'}
                onClick={() => setIsSidebarCollapsed((current) => !current)}
                className={[
                  'flex shrink-0 items-center justify-center rounded-xl border border-[#1b2540] bg-[#0d1427] text-slate-300 shadow-sm transition-colors duration-200',
                  'hover:border-[#2a3859] hover:bg-[#151f36] hover:text-white',
                  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400',
                  isSidebarCollapsed ? 'h-9 w-9' : 'h-10 w-10',
                ].join(' ')}
              >
                {isSidebarCollapsed ? (
                  <FiChevronRight className="h-4 w-4" />
                ) : (
                  <FiChevronLeft className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <div className={isSidebarCollapsed ? 'px-4' : 'px-5'}>
            <div className="h-px bg-[#151c31]" />
          </div>

          <nav
            aria-label="Main navigation"
            className={[
              'min-h-0 flex-1 overflow-y-auto',
              isSidebarCollapsed
                ? 'flex flex-col items-center gap-3 px-4 py-5'
                : 'space-y-1.5 px-5 py-5',
            ].join(' ')}
          >
            {navigationItems.map((item) => (
              <SidebarItem
                key={item.path}
                item={item}
                end={item.path === '/'}
                isCollapsed={isSidebarCollapsed}
              />
            ))}
          </nav>

          <div className={isSidebarCollapsed ? 'px-4' : 'px-5'}>
            <div className="h-px bg-[#151c31]" />
          </div>

          <div
            className={[
              isSidebarCollapsed
                ? 'flex flex-col items-center gap-3 px-4 py-5'
                : 'space-y-1.5 px-5 py-5',
            ].join(' ')}
          >
            {bottomNavigationItems.map((item) => (
              <SidebarItem key={item.path} item={item} isCollapsed={isSidebarCollapsed} />
            ))}
          </div>
        </aside>

        <div
          className="min-h-screen min-w-0 transition-[padding] duration-300 ease-out"
          style={{ paddingLeft: sidebarWidth }}
        >
          <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/85 px-8 py-4 backdrop-blur-xl">
            <div className="flex items-center justify-between gap-6">
              <h2 className="truncate text-xl font-black tracking-tight text-slate-950">
                Панель управления
              </h2>

              <div className="flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 shadow-sm">
                <FiDatabase className="h-4 w-4 text-blue-600" />
                SQLite активен
              </div>
            </div>
          </header>

          <main className="min-w-0 px-8 py-7">
            <Outlet />
          </main>
        </div>
      </div>
    </Tooltip.Provider>
  )
}
