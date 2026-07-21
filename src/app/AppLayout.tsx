import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import * as Tooltip from "@radix-ui/react-tooltip";
import { motion } from "framer-motion";
import {
  FiChevronLeft,
  FiChevronRight,
  FiLogOut,
  FiUser,
} from "react-icons/fi";
import { useTranslation } from "react-i18next";

import { useAuth } from "../features/auth/AuthContext";
import type { AppNavigationItem } from "./navigation";
import { bottomNavigationItems, navigationItems } from "./navigation";
import { HRLogo } from "./brand/HRLogo";
import { GlobalSearch } from "./GlobalSearch";

const EXPANDED_SIDEBAR_WIDTH = "252px";
const COLLAPSED_SIDEBAR_WIDTH = "76px";
const tooltipContentClass =
  "z-50 select-none rounded-xl border border-slate-700/80 bg-slate-950 px-3 py-2 text-xs font-semibold text-white shadow-2xl";

function expandedLinkClass(isActive: boolean): string {
  return [
    "group relative flex h-11 w-full items-center gap-3 overflow-hidden rounded-2xl px-3 text-sm font-bold transition-all duration-200",
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-border)]",
    isActive
      ? "bg-gradient-to-r from-[var(--accent)] to-[var(--accent-hover)] text-white shadow-[0_12px_28px_color-mix(in_srgb,var(--accent)_24%,transparent)]"
      : "text-slate-400 hover:bg-white/[0.055] hover:text-white",
  ].join(" ");
}

function collapsedLinkClass(isActive: boolean): string {
  return [
    "group flex h-11 w-11 items-center justify-center rounded-2xl transition-all duration-200",
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-border)]",
    isActive
      ? "bg-gradient-to-br from-[var(--accent-border)] to-[var(--accent-hover)] text-white shadow-lg"
      : "text-slate-400 hover:bg-white/[0.06] hover:text-white",
  ].join(" ");
}

function SidebarItem({
  item,
  isCollapsed,
  end,
}: {
  item: AppNavigationItem;
  isCollapsed: boolean;
  end?: boolean;
}): JSX.Element {
  const Icon = item.icon;
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const title = t(item.titleKey);
  const isActive =
    item.path === "/"
      ? pathname === "/"
      : pathname === item.path || pathname.startsWith(`${item.path}/`);

  const link = (
    <NavLink
      aria-label={title}
      className={
        isCollapsed ? collapsedLinkClass(isActive) : expandedLinkClass(isActive)
      }
      end={end}
      to={item.path}
    >
      <Icon className="h-[18px] w-[18px] shrink-0" />
      {!isCollapsed && <span className="truncate">{title}</span>}
    </NavLink>
  );

  if (!isCollapsed) return link;

  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>{link}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          align="center"
          className={tooltipContentClass}
          side="right"
          sideOffset={12}
        >
          {title}
          <Tooltip.Arrow className="fill-slate-950" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

export function AppLayout(): JSX.Element {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const { t } = useTranslation();
  const { hasPermission, logout, session } = useAuth();
  const visibleNavigationItems = navigationItems.filter((item) =>
    hasPermission(item.permissionCode),
  );
  const visibleBottomItems = bottomNavigationItems.filter((item) =>
    hasPermission(item.permissionCode),
  );
  const canSearch = [
    "employees.view",
    "organization.view",
    "recruitment.view",
  ].some(hasPermission);
  const sidebarWidth = isSidebarCollapsed
    ? COLLAPSED_SIDEBAR_WIDTH
    : EXPANDED_SIDEBAR_WIDTH;
  const primaryRole = session.roles[0]?.name ?? "Пользователь";

  return (
    <Tooltip.Provider delayDuration={120}>
      <div className="app-page app-theme-transition min-h-screen overflow-x-hidden">
        <motion.aside
          animate={{ x: 0, opacity: 1 }}
          className="group/sidebar fixed inset-y-0 left-0 z-30 flex flex-col overflow-visible border-r border-[var(--sidebar-border)] bg-[var(--sidebar-bg)] text-white transition-[width] duration-300 ease-out"
          initial={{ x: -14, opacity: 0 }}
          layout
          style={{ width: sidebarWidth }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <button
                aria-label={
                  isSidebarCollapsed
                    ? t("app.sidebar.expandSidebar")
                    : t("app.sidebar.collapseSidebar")
                }
                className="absolute right-0 top-6 z-40 flex h-9 w-9 translate-x-1/2 items-center justify-center rounded-full border border-[var(--sidebar-button-border)] bg-[var(--sidebar-bg)] text-slate-400 opacity-0 shadow-xl transition group-hover/sidebar:opacity-100 hover:border-[var(--accent-border)] hover:text-white focus-visible:opacity-100"
                onClick={() => setIsSidebarCollapsed((current) => !current)}
                type="button"
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
                align="center"
                className={tooltipContentClass}
                side="right"
                sideOffset={12}
              >
                {isSidebarCollapsed
                  ? t("app.sidebar.expand")
                  : t("app.sidebar.collapse")}
                <Tooltip.Arrow className="fill-slate-950" />
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>

          <header className={isSidebarCollapsed ? "px-4 py-5" : "px-5 py-5"}>
            <div
              className={[
                "flex min-w-0 items-center",
                isSidebarCollapsed ? "justify-center" : "gap-3",
              ].join(" ")}
            >
              <HRLogo className="h-10 w-10 shrink-0" />
              {!isSidebarCollapsed && (
                <h1 className="truncate text-[15px] font-black tracking-tight">
                  {t("app.brand.title")}
                </h1>
              )}
            </div>
          </header>

          <div className="mx-5 h-px bg-white/[0.08]" />

          <nav
            aria-label={t("app.sidebar.mainNavigation")}
            className={[
              "flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto py-4",
              isSidebarCollapsed ? "items-center px-3" : "px-4",
            ].join(" ")}
          >
            {visibleNavigationItems.map((item, index) => (
              <motion.div
                animate={{ opacity: 1, x: 0 }}
                className={isSidebarCollapsed ? "w-11" : "w-full"}
                initial={{ opacity: 0, x: -8 }}
                key={item.path}
                transition={{ duration: 0.2, delay: index * 0.025 }}
              >
                <SidebarItem
                  end={item.path === "/"}
                  isCollapsed={isSidebarCollapsed}
                  item={item}
                />
              </motion.div>
            ))}
          </nav>

          <footer className={isSidebarCollapsed ? "px-3 pb-4" : "px-4 pb-4"}>
            <div className="mb-3 h-px bg-white/[0.08]" />
            <div className="space-y-1.5">
              {visibleBottomItems.map((item) => (
                <SidebarItem
                  isCollapsed={isSidebarCollapsed}
                  item={item}
                  key={item.path}
                />
              ))}
            </div>
          </footer>
        </motion.aside>

        <div
          className="min-h-screen min-w-0 transition-[padding] duration-300 ease-out"
          style={{ paddingLeft: sidebarWidth }}
        >
          <header className="app-topbar sticky top-0 z-20 flex h-[74px] items-center border-b px-6 backdrop-blur-2xl lg:px-8">
            <div className="mx-auto flex w-full max-w-[1680px] items-center justify-between gap-5">
              {canSearch ? <GlobalSearch /> : <div />}

              <div className="flex shrink-0 items-center gap-2">
                <div className="app-surface app-border flex min-w-0 items-center gap-2 rounded-2xl border px-2.5 py-2 shadow-none">
                  <span className="app-accent-soft flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border">
                    <FiUser className="h-[18px] w-[18px]" />
                  </span>
                  <span className="hidden min-w-0 pr-2 sm:block">
                    <span className="app-text block max-w-52 truncate text-sm font-black">
                      {session.employeeName}
                    </span>
                    <span className="app-muted block max-w-52 truncate text-[11px] font-bold">
                      {primaryRole}
                    </span>
                  </span>
                </div>
                <button
                  aria-label="Выйти из системы"
                  className="app-button-secondary app-border flex h-11 w-11 items-center justify-center rounded-2xl border transition"
                  onClick={() => void logout()}
                  title="Выйти"
                  type="button"
                >
                  <FiLogOut className="h-[18px] w-[18px]" />
                </button>
              </div>
            </div>
          </header>

          <main className="mx-auto min-w-0 max-w-[1680px] px-6 py-6 lg:px-8 lg:py-7">
            <Outlet />
          </main>
        </div>
      </div>
    </Tooltip.Provider>
  );
}
