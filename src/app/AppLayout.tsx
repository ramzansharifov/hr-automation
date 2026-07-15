import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import * as Separator from "@radix-ui/react-separator";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from "framer-motion";
import { FiChevronLeft, FiChevronRight, FiUser } from "react-icons/fi";
import { useTranslation } from "react-i18next";

import type { AppNavigationItem } from "./navigation";
import { bottomNavigationItems, navigationItems } from "./navigation";
import { HRLogo } from "./brand/HRLogo";
import { GlobalSearch } from "./GlobalSearch";
import {
  ScrollArea,
  Tooltip,
  TooltipProvider,
} from "../shared/ui";

const EXPANDED_SIDEBAR_WIDTH = "252px";
const COLLAPSED_SIDEBAR_WIDTH = "76px";

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
      className={isCollapsed ? collapsedLinkClass(isActive) : expandedLinkClass(isActive)}
      end={end}
      to={item.path}
    >
      <Icon className="h-[18px] w-[18px] shrink-0 transition-transform duration-200 group-hover:scale-110" />
      {!isCollapsed && <span className="truncate">{title}</span>}
    </NavLink>
  );

  if (!isCollapsed) return link;

  return (
    <Tooltip content={title} side="right" sideOffset={12}>
      {link}
    </Tooltip>
  );
}

export function AppLayout(): JSX.Element {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const { t } = useTranslation();
  const location = useLocation();
  const reduceMotion = useReducedMotion();
  const sidebarWidth = isSidebarCollapsed
    ? COLLAPSED_SIDEBAR_WIDTH
    : EXPANDED_SIDEBAR_WIDTH;

  return (
    <TooltipProvider delayDuration={120}>
      <div className="app-page app-theme-transition min-h-screen overflow-x-hidden">
        <motion.aside
          animate={{ x: 0, opacity: 1 }}
          className="group/sidebar fixed inset-y-0 left-0 z-30 flex flex-col overflow-visible border-r border-[var(--sidebar-border)] bg-[var(--sidebar-bg)] text-white transition-[width] duration-300 ease-out"
          initial={reduceMotion ? false : { x: -14, opacity: 0 }}
          layout={!reduceMotion}
          style={{ width: sidebarWidth }}
          transition={{ duration: reduceMotion ? 0 : 0.3, ease: "easeOut" }}
        >
          <Tooltip
            content={
              isSidebarCollapsed
                ? t("app.sidebar.expand")
                : t("app.sidebar.collapse")
            }
            side="right"
            sideOffset={12}
          >
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
          </Tooltip>

          <header className={isSidebarCollapsed ? "px-4 py-5" : "px-5 py-5"}>
            <div
              className={[
                "flex min-w-0 items-center",
                isSidebarCollapsed ? "justify-center" : "gap-3",
              ].join(" ")}
            >
              <HRLogo className="h-10 w-10 shrink-0" />
              {!isSidebarCollapsed && (
                <motion.h1
                  animate={{ opacity: 1, x: 0 }}
                  className="truncate text-[15px] font-black tracking-tight"
                  initial={reduceMotion ? false : { opacity: 0, x: -6 }}
                >
                  {t("app.brand.title")}
                </motion.h1>
              )}
            </div>
          </header>

          <Separator.Root
            className="mx-5 h-px bg-white/[0.08]"
            decorative
            orientation="horizontal"
          />

          <ScrollArea className="min-h-0 flex-1">
            <nav
              aria-label={t("app.sidebar.mainNavigation")}
              className={[
                "flex min-h-full flex-col gap-1.5 py-4",
                isSidebarCollapsed ? "items-center px-3" : "px-4",
              ].join(" ")}
            >
              {navigationItems.map((item, index) => (
                <motion.div
                  animate={{ opacity: 1, x: 0 }}
                  className={isSidebarCollapsed ? "w-11" : "w-full"}
                  initial={reduceMotion ? false : { opacity: 0, x: -8 }}
                  key={item.path}
                  transition={{
                    duration: reduceMotion ? 0 : 0.2,
                    delay: reduceMotion ? 0 : index * 0.025,
                  }}
                >
                  <SidebarItem
                    end={item.path === "/"}
                    isCollapsed={isSidebarCollapsed}
                    item={item}
                  />
                </motion.div>
              ))}
            </nav>
          </ScrollArea>

          <footer className={isSidebarCollapsed ? "px-3 pb-4" : "px-4 pb-4"}>
            <Separator.Root
              className="mb-3 h-px bg-white/[0.08]"
              decorative
              orientation="horizontal"
            />
            <div className="space-y-1.5">
              {bottomNavigationItems.map((item) => (
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
              <GlobalSearch />

              <motion.div
                className="app-surface app-border flex shrink-0 items-center gap-2 rounded-2xl border px-2.5 py-2 shadow-none"
                whileHover={reduceMotion ? undefined : { y: -1 }}
                transition={{ duration: 0.16 }}
              >
                <span className="app-accent-soft flex h-9 w-9 items-center justify-center rounded-xl border">
                  <FiUser className="h-[18px] w-[18px]" />
                </span>
                <span className="app-text hidden pr-2 text-sm font-black sm:block">
                  Администратор
                </span>
              </motion.div>
            </div>
          </header>

          <main className="mx-auto min-w-0 max-w-[1680px] px-6 py-6 lg:px-8 lg:py-7">
            <AnimatePresence initial={false} mode="wait">
              <motion.div
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={
                  reduceMotion
                    ? { opacity: 1 }
                    : { opacity: 0, y: -6, filter: "blur(3px)" }
                }
                initial={
                  reduceMotion
                    ? false
                    : { opacity: 0, y: 10, filter: "blur(4px)" }
                }
                key={location.pathname}
                transition={{
                  duration: reduceMotion ? 0 : 0.22,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
