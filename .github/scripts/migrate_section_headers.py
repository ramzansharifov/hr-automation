from pathlib import Path


def replace(path: str, old: str, new: str, count: int = -1) -> None:
    p = Path(path)
    text = p.read_text(encoding="utf-8")
    if old not in text:
        raise SystemExit(f"Expected pattern not found in {path}: {old[:120]!r}")
    p.write_text(text.replace(old, new, count), encoding="utf-8")


replace(
    "src/pages/employees/EmployeesPage.tsx",
    'import { FiPlus } from "react-icons/fi";',
    'import { FiPlus, FiUsers } from "react-icons/fi";',
)
replace(
    "src/pages/employees/EmployeesPage.tsx",
    '      <PageHeader\n        actions={',
    '      <PageHeader\n        icon={<FiUsers />}\n        actions={',
)

replace(
    "src/pages/OrganizationHierarchyPage.tsx",
    'import { FiChevronRight, FiPlus, FiUserCheck } from "react-icons/fi";',
    'import { FiChevronRight, FiLayers, FiPlus, FiUserCheck } from "react-icons/fi";',
)
replace(
    "src/pages/OrganizationHierarchyPage.tsx",
    '      <PageHeader actions={headerActions} title={page.title} />',
    '      <PageHeader actions={headerActions} icon={<FiLayers />} title={page.title} />',
)

replace(
    "src/pages/VacationsPage.tsx",
    '      <PageHeader\n        actions={',
    '      <PageHeader\n        icon={<FiCalendar />}\n        actions={',
)

replace(
    "src/pages/FiltersPage.tsx",
    'import { UnifiedFiltersWorkspace } from "../features/filters/components/UnifiedFiltersWorkspace";\nimport { PageHeader } from "../shared/ui";',
    'import { FiFilter } from "react-icons/fi";\n\nimport { UnifiedFiltersWorkspace } from "../features/filters/components/UnifiedFiltersWorkspace";\nimport { PageHeader } from "../shared/ui";',
)
replace(
    "src/pages/FiltersPage.tsx",
    '      <PageHeader title="Фильтры" />',
    '      <PageHeader icon={<FiFilter />} title="Фильтры" />',
)

replace(
    "src/pages/DashboardPage.tsx",
    'import { StatCard } from "../shared/ui/StatCard";',
    'import { PageHeader } from "../shared/ui";\nimport { StatCard } from "../shared/ui/StatCard";',
)
replace(
    "src/pages/DashboardPage.tsx",
    '''      <section className="app-accent-gradient-panel flex flex-col gap-6 overflow-hidden rounded-[30px] border p-7 lg:flex-row lg:items-center lg:justify-between lg:p-8">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-white/65">
            HR Control Center
          </p>
          <h1 className="mt-2 max-w-3xl text-3xl font-black tracking-tight text-white sm:text-4xl">
            {t("dashboard.hero.title")}
          </h1>
          <p className="mt-3 max-w-2xl text-sm font-medium text-white/70">
            Сводка кадровых процессов и ситуаций, которые требуют внимания.
          </p>
        </div>
        <button
          className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-5 text-sm font-black text-white backdrop-blur transition hover:bg-white/15"
          onClick={() => void loadDashboard()}
          type="button"
        >
          <FiRefreshCw className={isLoading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          {t("common.actions.refresh")}
        </button>
      </section>''',
    '''      <PageHeader
        actions={
          <button
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-5 text-sm font-black text-white backdrop-blur transition hover:bg-white/15"
            onClick={() => void loadDashboard()}
            type="button"
          >
            <FiRefreshCw className={isLoading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            {t("common.actions.refresh")}
          </button>
        }
        description="Сводка кадровых процессов и ситуаций, которые требуют внимания."
        eyebrow="HR Control Center"
        icon={<FiGrid />}
        title={t("dashboard.hero.title")}
      />''',
)

replace(
    "src/pages/AuditLogPage.tsx",
    'import { Button, EmptyState, Input, LoadingState } from "../shared/ui";',
    'import { Button, EmptyState, Input, LoadingState, PageHeader } from "../shared/ui";',
)
replace(
    "src/pages/AuditLogPage.tsx",
    '''      <section className="app-accent-gradient-panel flex flex-col gap-5 rounded-[30px] border p-7 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-white">
            <FiActivity className="h-6 w-6" />
          </span>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-white/65">
              Администрирование
            </p>
            <h1 className="mt-1 text-3xl font-black tracking-tight text-white sm:text-4xl">
              Журнал действий
            </h1>
            <p className="mt-2 max-w-3xl text-sm font-medium text-white/70">
              Неизменяемая история кадровых, административных и системных операций.
            </p>
          </div>
        </div>
        <Button
          className="border-white/20 bg-white/10 text-white"
          leftIcon={<FiRefreshCw className={isLoading ? "animate-spin" : ""} />}
          onClick={() => void load()}
          variant="ghost"
        >
          Обновить
        </Button>
      </section>''',
    '''      <PageHeader
        actions={
          <Button
            className="border-white/20 bg-white/10 text-white"
            leftIcon={<FiRefreshCw className={isLoading ? "animate-spin" : ""} />}
            onClick={() => void load()}
            variant="ghost"
          >
            Обновить
          </Button>
        }
        description="Неизменяемая история кадровых, административных и системных операций."
        eyebrow="Администрирование"
        icon={<FiActivity />}
        title="Журнал действий"
      />''',
)

replace(
    "src/pages/SettingsPage.tsx",
    'import { Button, ConfirmDialog, LoadingState } from "../shared/ui";',
    'import { Button, ConfirmDialog, LoadingState, PageHeader } from "../shared/ui";',
)
replace(
    "src/pages/SettingsPage.tsx",
    '''      <section className="app-accent-gradient-panel flex items-center gap-4 overflow-hidden rounded-[28px] border p-6 sm:p-7">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-white backdrop-blur">
          <FiSettings className="h-6 w-6" />
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-3xl font-black tracking-tight text-white sm:text-4xl">
            {t("settings.title")}
          </h1>
          <p className="mt-2 text-sm font-medium text-white/70">
            Личные параметры интерфейса{canManageSystem ? " и системные инструменты администратора" : ""}.
          </p>
          <span className="mt-3 inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-bold text-white/80">
            {t(`settings.appearance.theme.palette.${resolvedTheme}`)}
          </span>
        </div>
      </section>''',
    '''      <PageHeader
        description={
          <>Личные параметры интерфейса{canManageSystem ? " и системные инструменты администратора" : ""}.</>
        }
        icon={<FiSettings />}
        meta={
          <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-bold text-white/80">
            {t(`settings.appearance.theme.palette.${resolvedTheme}`)}
          </span>
        }
        title={t("settings.title")}
      />''',
)

replace(
    "src/pages/ProfilePage.tsx",
    "import { useTranslation } from 'react-i18next'",
    "import { useTranslation } from 'react-i18next'\n\nimport { PageHeader } from '../shared/ui'",
)
replace(
    "src/pages/ProfilePage.tsx",
    '''      <section className="app-accent-gradient-panel flex items-center gap-4 overflow-hidden rounded-[28px] border p-6 sm:p-7">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-white backdrop-blur">
          <FiUser className="h-6 w-6" />
        </span>
        <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
          {t('profile.title')}
        </h1>
      </section>''',
    '''      <PageHeader icon={<FiUser />} title={t('profile.title')} />''',
)

replace(
    "src/pages/access/AccessControlPage.tsx",
    '  LoadingState,\n  Select,',
    '  LoadingState,\n  PageHeader,\n  Select,',
)
replace(
    "src/pages/access/AccessControlPage.tsx",
    '''      <header className="app-surface app-border flex flex-col gap-5 rounded-[28px] border p-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <span className="app-accent-soft flex h-12 w-12 items-center justify-center rounded-2xl border">
              <FiShield className="h-6 w-6" />
            </span>
            <div>
              <h1 className="app-text text-2xl font-black tracking-tight sm:text-3xl">
                Роли и пользователи
              </h1>
              <p className="app-muted mt-1 text-sm">
                Встроенный системный администратор хранится отдельно от сотрудников. Остальные учётные записи всегда связаны с сотрудником.
              </p>
            </div>
          </div>
        </div>
        <Button
          leftIcon={<FiPlus className="h-4 w-4" />}
          onClick={activeTab === "users" ? openCreateUser : openCreateRole}
        >
          {activeTab === "users" ? "Добавить пользователя" : "Создать роль"}
        </Button>
      </header>''',
    '''      <PageHeader
        actions={
          <Button
            className="border-white/20 shadow-xl hover:opacity-90"
            leftIcon={<FiPlus className="h-4 w-4" />}
            onClick={activeTab === "users" ? openCreateUser : openCreateRole}
            style={{ background: "#ffffff", color: "#0f172a" }}
            variant="ghost"
          >
            {activeTab === "users" ? "Добавить пользователя" : "Создать роль"}
          </Button>
        }
        description="Встроенный системный администратор хранится отдельно от сотрудников. Остальные учётные записи всегда связаны с сотрудником."
        icon={<FiShield />}
        title="Роли и пользователи"
      />''',
)

replace(
    "src/pages/EntityPage.tsx",
    "import { useTranslation } from 'react-i18next'",
    "import { useTranslation } from 'react-i18next'\nimport { FiDatabase } from 'react-icons/fi'",
)
replace(
    "src/pages/EntityPage.tsx",
    "import { getAppLocale } from '../shared/i18n'",
    "import { getAppLocale } from '../shared/i18n'\nimport { PageHeader } from '../shared/ui'",
)
replace(
    "src/pages/EntityPage.tsx",
    '''      <section className="flex items-end justify-between gap-6">
        <div>
          <h1 className="app-text text-3xl font-black tracking-tight">
            {config.title}
          </h1>
          <p className="app-muted mt-2 max-w-2xl text-sm font-medium">
            {config.description}
          </p>
        </div>
      </section>''',
    '''      <PageHeader
        description={config.description}
        icon={<FiDatabase />}
        title={config.title}
      />''',
)

p = Path("src/shared/ui/Dialog.tsx")
text = p.read_text(encoding="utf-8")
text = text.replace(
    'app-dialog-body min-h-0 flex-1 overflow-y-auto overscroll-contain p-6 [&>form>.sticky]:static [&>form>.sticky]:mx-0 [&>form>.sticky]:mb-0 [&>form>.sticky]:mt-6 [&>form>.sticky]:px-0 [&>form>.sticky]:pb-0',
    'app-dialog-body min-h-0 flex-1 overflow-y-auto overscroll-contain p-6',
)
p.write_text(text, encoding="utf-8")

leftovers = []
for p in Path("src/pages").rglob("*.tsx"):
    text = p.read_text(encoding="utf-8")
    if 'app-accent-gradient-panel' in text or '<header className=' in text:
        leftovers.append(str(p))

print("Page-local header candidates left:")
for item in leftovers:
    print(" -", item)
