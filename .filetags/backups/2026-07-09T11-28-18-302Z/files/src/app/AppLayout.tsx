import { useState } from 'react'
import {
  EMPLOYEES_VIEW_MODE_EVENT,
  getStoredEmployeesViewMode,
  setStoredEmployeesViewMode,
  type EmployeesViewMode,
} from '../features/employees/viewMode'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import * as Tooltip from '@radix-ui/react-tooltip'
import { motion } from 'framer-motion'
import { FiChevronLeft, FiChevronRight, FiDatabase, FiGrid, FiList } from 'react-icons/fi'
import { useTranslation } from 'react-i18next'
import type { AppNavigationItem } from './navigation'
import { bottomNavigationItems, navigationItems } from './navigation'
import { HRLogo } from './brand/HRLogo'

const EXPANDED_SIDEBAR_WIDTH = '276px'
const COLLAPSED_SIDEBAR_WIDTH = '84px'

const tooltipContentClass =
  'z-50 select-none rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs font-semibold text-white shadow-xl'

const sidebarDividerClass = 'h-px bg-white/10'

function getExpandedLinkClass(isActive: boolean): string {
  return [
    'group flex h-12 w-full items-center gap-3 rounded-xl border px-3 text-sm font-semibold transition-colors duration-200',
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-border)]',
    isActive
      ? 'app-accent-shadow border-[var(--accent-border)] bg-[var(--accent)] text-white'
      : 'border-transparent bg-transparent text-slate-400 hover:border-white/[0.08] hover:bg-white/[0.07] hover:text-white',
  ].join(' ')
}

function getCollapsedLinkClass(isActive: boolean): string {
  return [
    'group box-border flex h-12 w-12 shrink-0 items-center justify-center rounded-xl p-0 transition-colors duration-200',
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-border)]',
    isActive ? 'text-white' : 'text-slate-300 hover:text-white',
  ].join(' ')
}

function getCollapsedIconButtonClass(isActive: boolean): string {
  return [
    'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border p-3 shadow-sm transition-colors duration-200',
    isActive
      ? 'app-accent-shadow border-[var(--accent-border)] bg-[var(--accent)] text-white'
      : 'border-[var(--sidebar-button-border)] bg-[var(--sidebar-button)] text-slate-300 group-hover:border-[var(--sidebar-button-border-hover)] group-hover:bg-[var(--sidebar-button-hover)] group-hover:text-white',
  ].join(' ')
}
function getViewModeButtonClass(isActive: boolean): string {
  return [
    'inline-flex h-9 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-black transition',
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-border)]',
    isActive
      ? 'border-[var(--accent-border)] bg-[var(--accent)] text-white'
      : 'app-button-secondary',
  ].join(' ')
}

function getActiveNavigationItem(pathname: string): AppNavigationItem {
  const allItems = [...navigationItems, ...bottomNavigationItems]

  return (
    allItems.find((item) =>
      item.path === '/'
        ? pathname === '/'
        : pathname === item.path || pathname.startsWith(`${item.path}/`),
    ) ?? navigationItems[0]
  )
}

interface AppTopbarContent {
  titleKey: string
  descriptionKey?: string
  icon: AppNavigationItem['icon']
}

function getTopbarContent(
  pathname: string,
  fallbackItem: AppNavigationItem,
): AppTopbarContent {
  if (pathname === '/employees/new') {
    return {
      titleKey: 'employeesCreate.title',
      descriptionKey: 'employeesCreate.description',
      icon: fallbackItem.icon,
    }
  }

  if (pathname.startsWith('/employees/') && pathname !== '/employees') {
    return {
      titleKey: 'employeesDetails.title',
      icon: fallbackItem.icon,
    }
  }

  if (pathname === '/employees') {
    return {
      titleKey: 'employeesPage.title',
      descriptionKey: 'employeesPage.description',
      icon: fallbackItem.icon,
    }
  }

  if (pathname === '/departments') {
    return {
      titleKey: 'entities.departments.title',
      descriptionKey: 'entities.departments.description',
      icon: fallbackItem.icon,
    }
  }

  if (pathname === '/positions') {
    return {
      titleKey: 'entities.positions.title',
      descriptionKey: 'entities.positions.description',
      icon: fallbackItem.icon,
    }
  }

  if (pathname === '/vacations') {
    return {
      titleKey: 'entities.vacations.title',
      descriptionKey: 'entities.vacations.description',
      icon: fallbackItem.icon,
    }
  }

  if (pathname === '/payroll') {
    return {
      titleKey: 'entities.payroll.title',
      descriptionKey: 'entities.payroll.description',
      icon: fallbackItem.icon,
    }
  }

  if (pathname === '/profile') {
    return {
      titleKey: 'profile.title',
      icon: fallbackItem.icon,
    }
  }

  if (pathname === '/settings') {
    return {
      titleKey: 'settings.title',
      icon: fallbackItem.icon,
    }
  }

  return {
    titleKey: fallbackItem.titleKey,
    icon: fallbackItem.icon,
  }
}
interface SidebarItemProps {
  item: AppNavigationItem
  isCollapsed: boolean
  end?: boolean
}

function SidebarItem({ item, isCollapsed, end }: SidebarItemProps): JSX.Element {
  const Icon = item.icon
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const itemTitle = t(item.titleKey)
  const isActive =
    item.path === '/'
      ? pathname === '/'
      : pathname === item.path || pathname.startsWith(`${item.path}/`)

  const link = (
    <NavLink
      to={item.path}
      end={end}
      aria-label={itemTitle}
      className={() =>
        isCollapsed ? getCollapsedLinkClass(isActive) : getExpandedLinkClass(isActive)
      }
    >
      {isCollapsed ? (
        <span
          className={getCollapsedIconButtonClass(isActive)}
          style={{
            backgroundColor: isActive ? 'var(--accent)' : 'var(--sidebar-button)',
            borderColor: isActive ? 'var(--accent-border)' : 'var(--sidebar-button-border)',
          }}
        >
          <Icon className="h-[18px] w-[18px] shrink-0" />
        </span>
      ) : (
        <Icon className="h-[18px] w-[18px] shrink-0" />
      )}

      {!isCollapsed && <span className="truncate">{itemTitle}</span>}
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
          {itemTitle}
          <Tooltip.Arrow className="fill-slate-950" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  )
}

export function AppLayout(): JSX.Element {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [employeesViewMode, setEmployeesViewMode] =
    useState<EmployeesViewMode>(getStoredEmployeesViewMode)
  const { t } = useTranslation()
  const location = useLocation()

  const sidebarWidth = isSidebarCollapsed ? COLLAPSED_SIDEBAR_WIDTH : EXPANDED_SIDEBAR_WIDTH
  const activeNavigationItem = getActiveNavigationItem(location.pathname)
  const topbarContent = getTopbarContent(location.pathname, activeNavigationItem)
  const TopbarIcon = topbarContent.icon
  const topbarDescription = topbarContent.descriptionKey ? t(topbarContent.descriptionKey) : undefined

  function handleEmployeesViewModeChange(nextMode: EmployeesViewMode): void {
    setEmployeesViewMode(nextMode)
    setStoredEmployeesViewMode(nextMode)
    window.dispatchEvent(new CustomEvent(EMPLOYEES_VIEW_MODE_EVENT, { detail: nextMode }))
  }

  return (
    <Tooltip.Provider delayDuration={120}>
      <div className="app-page app-theme-transition app-no-shadows min-h-screen overflow-x-hidden">
        <motion.aside
          layout
          initial={{ x: -18, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="group/sidebar fixed inset-y-0 left-0 z-30 flex flex-col overflow-visible border-r border-[var(--sidebar-border)] bg-[var(--sidebar-bg)] text-white transition-[width] duration-300 ease-out"
          style={{ width: sidebarWidth }}
        >
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <button
                type="button"
                aria-label={
                  isSidebarCollapsed
                    ? t('app.sidebar.expandSidebar')
                    : t('app.sidebar.collapseSidebar')
                }
                onClick={() => setIsSidebarCollapsed((current) => !current)}
                className={[
                  'app-accent-shadow-sm absolute right-0 top-6 z-40 flex h-10 w-10 translate-x-1/2 items-center justify-center rounded-full border border-[var(--sidebar-button-border)] bg-[var(--sidebar-button)] text-slate-300 transition-all duration-200',
                  'pointer-events-none opacity-0',
                  'group-hover/sidebar:pointer-events-auto group-hover/sidebar:opacity-100',
                  'hover:border-[var(--accent-border)] hover:bg-[var(--sidebar-button-hover)] hover:text-white',
                  'focus-visible:pointer-events-auto focus-visible:opacity-100',
                  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-border)]',
                ].join(' ')}
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
                sideOffset={12}
                className={tooltipContentClass}
              >
                {isSidebarCollapsed ? t('app.sidebar.expand') : t('app.sidebar.collapse')}
                <Tooltip.Arrow className="fill-slate-950" />
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>

          <header className="px-5 py-5">
            <div
              className={[
                'flex min-w-0 items-center',
                isSidebarCollapsed ? 'justify-center' : 'gap-3',
              ].join(' ')}
            >
              <HRLogo className="h-11 w-11 shrink-0" />

              {!isSidebarCollapsed && (
                <div className="min-w-0">
                  <h1 className="truncate text-[15px] font-black tracking-tight">
                    {t('app.brand.title')}
                  </h1>
                  <p className="mt-0.5 truncate text-xs font-medium text-slate-500">
                    {t('app.brand.subtitle')}
                  </p>
                </div>
              )}
            </div>
          </header>

          <div className="px-5">
            <div className={sidebarDividerClass} />
          </div>

          <nav
            aria-label={t('app.sidebar.mainNavigation')}
            className={[
              'flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto py-5',
              isSidebarCollapsed ? 'items-center px-4' : 'px-5',
            ].join(' ')}
          >
            {navigationItems.map((item, index) => (
              <motion.div
                key={item.path}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.24, delay: index * 0.035, ease: 'easeOut' }}
                className={isSidebarCollapsed ? 'w-12' : 'w-full'}
              >
                <SidebarItem
                  item={item}
                  end={item.path === '/'}
                  isCollapsed={isSidebarCollapsed}
                />
              </motion.div>
            ))}
          </nav>

          <footer>
            <div className="px-5">
              <div className={sidebarDividerClass} />
            </div>

            <div
              className={[
                'flex flex-col gap-3 py-5',
                isSidebarCollapsed ? 'items-center px-4' : 'px-5',
              ].join(' ')}
            >
              {bottomNavigationItems.map((item, index) => (
                <motion.div
                  key={item.path}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{
                    duration: 0.24,
                    delay: (navigationItems.length + index) * 0.035,
                    ease: 'easeOut',
                  }}
                  className={isSidebarCollapsed ? 'w-12' : 'w-full'}
                >
                  <SidebarItem item={item} isCollapsed={isSidebarCollapsed} />
                </motion.div>
              ))}
            </div>
          </footer>
        </motion.aside>

        <div
          className="min-h-screen min-w-0 transition-[padding] duration-300 ease-out"
          style={{ paddingLeft: sidebarWidth }}
        >
          <header className="app-topbar sticky top-0 z-20 flex h-[85px] items-center border-b px-8 backdrop-blur-xl">
            <div className="flex w-full items-center justify-between gap-6">
              <div className="flex min-w-0 items-center gap-3">
                <span className="app-accent-soft app-accent-shadow-sm flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[var(--accent-border)]">
                  <TopbarIcon className="h-5 w-5" />
                </span>

                <div className="min-w-0">
                  <h2 className="app-text truncate text-xl font-black tracking-tight">
                    {t(topbarContent.titleKey)}
                  </h2>

                  {topbarDescription && (
                    <p className="app-muted mt-1 truncate text-xs font-semibold">
                      {topbarDescription}
                    </p>
                  )}
                </div>
              </div>

              {location.pathname === '/employees' ? (
                <div className="app-surface flex shrink-0 items-center gap-2 rounded-xl border p-1">
                  <button
                    type="button"
                    className={getViewModeButtonClass(employeesViewMode === 'table')}
                    onClick={() => handleEmployeesViewModeChange('table')}
                  >
                    <FiList className="h-4 w-4" />
                    Таблица
                  </button>
                  <button
                    type="button"
                    className={getViewModeButtonClass(employeesViewMode === 'cards')}
                    onClick={() => handleEmployeesViewModeChange('cards')}
                  >
                    <FiGrid className="h-4 w-4" />
                    Карточки
                  </button>
                </div>
              ) : (
                <div className="app-surface flex shrink-0 items-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold">
                  <FiDatabase className="app-accent-text h-4 w-4" />
                  {t('app.topbar.databaseActive')}
                </div>
              )}
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
