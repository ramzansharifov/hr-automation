import * as RadixSwitch from "@radix-ui/react-switch";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import {
  FiAlertTriangle,
  FiArrowLeft,
  FiCheckCircle,
  FiChevronDown,
  FiChevronRight,
  FiLock,
  FiSave,
  FiSearch,
  FiShield,
  FiSliders,
} from "react-icons/fi";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";

import { useAuth } from "../../features/auth/AuthContext";
import {
  getDependentPermissionCodes,
  getPermissionRiskLevel,
  legacyPermissionCodes,
  normalizePermissionDependencies,
  permissionDependencies,
} from "../../shared/access/permissionRules";
import { hrApiClient } from "../../shared/lib/hrApiClient";
import type {
  AccessPermission,
  AccessRoleSummary,
  SaveAccessRoleParams,
} from "../../shared/types/access";
import {
  Button,
  ConfirmDialog,
  EmptyState,
  Input,
  LoadingState,
  PageHeader,
  Textarea,
} from "../../shared/ui";
import { getErrorMessage } from "./accessControlData";
import {
  rolePermissionSections,
  type RolePermissionSectionDefinition,
} from "./rolePermissionSections";

type PermissionFilter = "all" | "selected" | "unselected";
type PendingPermissionChange =
  | { kind: "permission"; code: string; checked: boolean }
  | { kind: "section"; sectionKey: string; checked: boolean }
  | null;

const permissionFilters: Array<{ value: PermissionFilter; label: string }> = [
  { value: "all", label: "Все" },
  { value: "selected", label: "Выбранные" },
  { value: "unselected", label: "Не выбранные" },
];

export function AccessRoleFormPage(): JSX.Element {
  const navigate = useNavigate();
  const params = useParams();
  const { session } = useAuth();
  const roleId = params.id ? Number(params.id) : null;
  const isEditMode = roleId !== null;
  const isSuperadmin =
    session.employeeId === 0 ||
    session.roles.some((item) => item.systemKey === "superadmin");

  const [permissions, setPermissions] = useState<AccessPermission[]>([]);
  const [roles, setRoles] = useState<AccessRoleSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [permissionCodes, setPermissionCodes] = useState<string[]>([]);
  const [permissionSearch, setPermissionSearch] = useState("");
  const [permissionFilter, setPermissionFilter] = useState<PermissionFilter>("all");
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [pendingChange, setPendingChange] = useState<PendingPermissionChange>(null);
  const [baselineSnapshot, setBaselineSnapshot] = useState("");
  const [baselineReady, setBaselineReady] = useState(false);
  const allowNavigationRef = useRef(false);

  useEffect(() => {
    let active = true;
    async function load(): Promise<void> {
      setIsLoading(true);
      try {
        const [permissionData, roleData] = await Promise.all([
          hrApiClient.listAccessPermissions(),
          hrApiClient.listAccessRoles(),
        ]);
        if (!active) return;

        setPermissions(permissionData);
        setRoles(roleData);
        if (isEditMode) {
          const currentRole = roleData.find((item) => item.id === roleId);
          if (currentRole) {
            const cleanCodes = currentRole.permissionCodes.filter(
              (code) => !legacyPermissionCodes.has(code),
            );
            setName(currentRole.name);
            setDescription(currentRole.description);
            setPermissionCodes(cleanCodes);
            setBaselineSnapshot(
              serializeRoleDraft(currentRole.name, currentRole.description, cleanCodes),
            );
          }
        } else {
          setBaselineSnapshot(serializeRoleDraft("", "", []));
        }
        setBaselineReady(true);
      } catch (error) {
        toast.error(getErrorMessage(error, "Не удалось загрузить данные роли"));
      } finally {
        if (active) setIsLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [isEditMode, roleId]);

  const role = isEditMode
    ? roles.find((item) => item.id === roleId) ?? null
    : null;
  const permissionMap = useMemo(
    () => new Map(permissions.map((permission) => [permission.code, permission])),
    [permissions],
  );
  const delegableCodes = useMemo(() => {
    const result = new Set<string>();
    for (const permission of permissions) {
      if (legacyPermissionCodes.has(permission.code)) continue;
      const requiredCodes = normalizePermissionDependencies([permission.code]).filter(
        (code) => !legacyPermissionCodes.has(code),
      );
      if (
        isSuperadmin ||
        requiredCodes.every((code) => session.permissionScopes[code] === "global")
      ) {
        result.add(permission.code);
      }
    }
    return result;
  }, [isSuperadmin, permissions, session.permissionScopes]);

  const visibleSections = useMemo(
    () =>
      rolePermissionSections.map((section) => ({
        ...section,
        permissions: section.permissionCodes
          .map((code) => permissionMap.get(code))
          .filter((permission): permission is AccessPermission => Boolean(permission)),
      })),
    [permissionMap],
  );

  const normalizedSelectedCodes = useMemo(
    () => permissionCodes.filter((code) => permissionMap.has(code)),
    [permissionCodes, permissionMap],
  );
  const selectedCount = normalizedSelectedCodes.length;
  const enabledSections = visibleSections.filter((section) =>
    section.permissions.some((permission) => permissionCodes.includes(permission.code)),
  ).length;
  const nonDelegableSelected = normalizedSelectedCodes.filter(
    (code) => !delegableCodes.has(code),
  );
  const editorLocked = isEditMode && !isSuperadmin && nonDelegableSelected.length > 0;
  const currentSnapshot = serializeRoleDraft(name, description, normalizedSelectedCodes);
  const isDirty = baselineReady && currentSnapshot !== baselineSnapshot;
  const canSave =
    !isSaving &&
    !editorLocked &&
    Boolean(name.trim()) &&
    selectedCount > 0 &&
    (!isEditMode || isDirty);

  const renderedSections = useMemo(() => {
    const search = permissionSearch.trim().toLocaleLowerCase();
    return visibleSections
      .map((section) => ({
        section,
        visiblePermissions: section.permissions.filter((permission) => {
          const selected = permissionCodes.includes(permission.code);
          if (permissionFilter === "selected" && !selected) return false;
          if (permissionFilter === "unselected" && selected) return false;
          if (!search) return true;
          return [permission.name, permission.description, permission.code, section.title]
            .join(" ")
            .toLocaleLowerCase()
            .includes(search);
        }),
      }))
      .filter((item) => item.visiblePermissions.length > 0);
  }, [permissionCodes, permissionFilter, permissionSearch, visibleSections]);

  useEffect(() => {
    if (!isDirty || allowNavigationRef.current) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent): void => {
      event.preventDefault();
      event.returnValue = "";
    };
    const handleDocumentClick = (event: MouseEvent): void => {
      if (allowNavigationRef.current || event.defaultPrevented) return;
      const target = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(target instanceof HTMLAnchorElement)) return;
      if (target.target === "_blank" || target.hasAttribute("download")) return;
      const href = target.getAttribute("href") ?? "";
      if (!href || href.startsWith("http://") || href.startsWith("https://")) return;
      if (!window.confirm("Есть несохранённые изменения роли. Покинуть страницу без сохранения?")) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
      } else {
        allowNavigationRef.current = true;
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("click", handleDocumentClick, true);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("click", handleDocumentClick, true);
    };
  }, [isDirty]);

  function applyPermissionToggle(code: string, checked: boolean): void {
    setPermissionCodes((current) => {
      const next = new Set(current);
      if (checked) {
        addPermissionWithDependencies(next, code, permissionMap, delegableCodes);
      } else {
        removePermissionAndDependents(next, code);
      }
      return [...next];
    });
  }

  function requestPermissionToggle(code: string, checked: boolean): void {
    if (editorLocked || !delegableCodes.has(code)) return;
    if (checked && getPermissionRiskLevel(code) === "critical") {
      setPendingChange({ kind: "permission", code, checked });
      return;
    }
    if (!checked && getDependentPermissionCodes(permissionCodes, code).length > 0) {
      setPendingChange({ kind: "permission", code, checked });
      return;
    }
    applyPermissionToggle(code, checked);
  }

  function applySectionToggle(
    section: RolePermissionSectionDefinition,
    checked: boolean,
  ): void {
    setPermissionCodes((current) => {
      const next = new Set(current);
      const availableCodes = section.permissionCodes.filter(
        (code) => permissionMap.has(code) && delegableCodes.has(code),
      );
      if (checked) {
        availableCodes.forEach((code) =>
          addPermissionWithDependencies(next, code, permissionMap, delegableCodes),
        );
      } else {
        availableCodes.forEach((code) => removePermissionAndDependents(next, code));
      }
      return [...next];
    });
  }

  function requestSectionToggle(
    section: RolePermissionSectionDefinition,
    checked: boolean,
  ): void {
    if (editorLocked) return;
    const availableCodes = section.permissionCodes.filter(
      (code) => permissionMap.has(code) && delegableCodes.has(code),
    );
    if (checked) {
      const addsCritical = availableCodes.some(
        (code) =>
          !permissionCodes.includes(code) && getPermissionRiskLevel(code) === "critical",
      );
      if (addsCritical) {
        setPendingChange({ kind: "section", sectionKey: section.key, checked });
        return;
      }
    } else if (availableCodes.some((code) => permissionCodes.includes(code))) {
      setPendingChange({ kind: "section", sectionKey: section.key, checked });
      return;
    }
    applySectionToggle(section, checked);
  }

  function confirmPendingChange(): void {
    if (!pendingChange) return;
    if (pendingChange.kind === "permission") {
      applyPermissionToggle(pendingChange.code, pendingChange.checked);
    } else {
      const section = rolePermissionSections.find(
        (item) => item.key === pendingChange.sectionKey,
      );
      if (section) applySectionToggle(section, pendingChange.checked);
    }
    setPendingChange(null);
  }

  function toggleSectionCollapsed(sectionKey: string): void {
    setCollapsedSections((current) => {
      const next = new Set(current);
      if (next.has(sectionKey)) next.delete(sectionKey);
      else next.add(sectionKey);
      return next;
    });
  }

  function navigateBack(): void {
    if (
      isDirty &&
      !window.confirm("Есть несохранённые изменения роли. Покинуть страницу без сохранения?")
    ) {
      return;
    }
    allowNavigationRef.current = true;
    navigate(isEditMode && roleId ? `/roles/${roleId}` : "/roles");
  }

  async function saveRole(): Promise<void> {
    if (!name.trim()) {
      toast.error("Укажите название роли");
      return;
    }
    if (selectedCount === 0) {
      toast.error("Выберите хотя бы одно разрешение");
      return;
    }
    if (editorLocked) {
      toast.error("Эта роль содержит разрешения выше текущего уровня доступа");
      return;
    }

    setIsSaving(true);
    try {
      const saveParams: SaveAccessRoleParams = {
        id: roleId ?? undefined,
        name: name.trim(),
        description: description.trim(),
        permissionCodes: normalizedSelectedCodes,
      };
      const saved = await hrApiClient.saveAccessRole(saveParams);
      toast.success(isEditMode ? "Роль обновлена" : "Роль создана");
      allowNavigationRef.current = true;
      navigate(`/roles/${saved.id}`);
    } catch (error) {
      toast.error(getErrorMessage(error, "Не удалось сохранить роль"));
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) return <LoadingState label="Загрузка разрешений..." />;

  if (isEditMode && (!role || !Number.isInteger(roleId) || Number(roleId) < 1)) {
    return (
      <section className="app-surface app-border overflow-hidden rounded-[28px] border">
        <EmptyState
          description="Вернитесь к списку ролей и выберите существующую пользовательскую роль."
          title="Роль не найдена"
        />
      </section>
    );
  }

  if (role?.isSystem) {
    return (
      <section className="app-surface app-border overflow-hidden rounded-[28px] border">
        <EmptyState
          description="Системные роли защищены от изменения. Их разрешения можно просмотреть на странице роли."
          title="Системную роль нельзя редактировать"
        />
      </section>
    );
  }

  const pendingInfo = getPendingChangeInfo(
    pendingChange,
    permissionCodes,
    permissionMap,
    delegableCodes,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <div className="flex flex-wrap gap-3">
            <Button
              className="border-white/20 bg-white/10 text-white"
              leftIcon={<FiArrowLeft className="h-4 w-4" />}
              onClick={navigateBack}
              variant="ghost"
            >
              Назад
            </Button>
            <Button
              className="border-white/20 shadow-xl hover:opacity-90"
              disabled={!canSave}
              leftIcon={<FiSave className="h-4 w-4" />}
              onClick={() => void saveRole()}
              style={{ background: "#ffffff", color: "#0f172a" }}
              variant="ghost"
            >
              {isSaving ? "Сохранение..." : "Сохранить роль"}
            </Button>
          </div>
        }
        description="Настройте роль по реальным разделам приложения и отдельным действиям внутри каждого раздела."
        eyebrow="Управление доступом"
        icon={<FiShield />}
        title={isEditMode ? `Редактирование · ${role?.name ?? "Роль"}` : "Новая роль"}
      />

      {editorLocked && (
        <section className="rounded-[24px] border border-amber-300/60 bg-amber-50/80 p-5 text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/30 dark:text-amber-100">
          <div className="flex items-start gap-3">
            <FiLock className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-black">Редактирование этой роли ограничено</p>
              <p className="mt-1 text-sm leading-6 opacity-85">
                Роль содержит разрешения, которыми ваша учётная запись не обладает глобально. Чтобы администратор не мог понизить или перераспределить более высокий доступ, сохранение и переключатели заблокированы.
              </p>
            </div>
          </div>
        </section>
      )}

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="app-surface app-border rounded-[28px] border p-6">
          <div className="grid gap-5">
            <label className="grid gap-2">
              <span className="app-text text-sm font-black">Название роли</span>
              <Input
                disabled={editorLocked}
                maxLength={100}
                onChange={(event) => setName(event.target.value)}
                placeholder="Например, HR-менеджер"
                value={name}
              />
            </label>
            <label className="grid gap-2">
              <span className="app-text text-sm font-black">Описание</span>
              <Textarea
                disabled={editorLocked}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Кому предназначена роль и за что отвечает"
                value={description}
              />
            </label>
          </div>
        </div>

        <aside className="app-surface app-border rounded-[28px] border p-6">
          <div className="flex items-center gap-3">
            <span className="app-accent-soft flex h-11 w-11 items-center justify-center rounded-2xl border">
              <FiSliders className="h-5 w-5" />
            </span>
            <div>
              <p className="app-text font-black">Доступ роли</p>
              <p className="app-muted mt-1 text-xs">Определяется только разрешениями</p>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <SummaryValue label="Разрешений" value={selectedCount} />
            <SummaryValue label="Разделов" value={enabledSections} />
          </div>
          <p className="app-muted mt-4 text-xs leading-5">
            Технически необходимые разрешения включаются автоматически. Администратор может делегировать только те разрешения, которыми сам обладает глобально.
          </p>
          {isDirty && (
            <p className="mt-3 text-xs font-black text-amber-600 dark:text-amber-300">
              Есть несохранённые изменения
            </p>
          )}
        </aside>
      </section>

      <section className="app-surface app-border rounded-[28px] border p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative min-w-0 flex-1 lg:max-w-xl">
            <FiSearch className="app-muted pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2" />
            <Input
              aria-label="Поиск разрешений"
              className="pl-10"
              onChange={(event) => setPermissionSearch(event.target.value)}
              placeholder="Поиск по действию, описанию или коду"
              value={permissionSearch}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {permissionFilters.map((filter) => (
              <Button
                key={filter.value}
                onClick={() => setPermissionFilter(filter.value)}
                size="sm"
                variant={permissionFilter === filter.value ? "primary" : "secondary"}
              >
                {filter.label}
              </Button>
            ))}
          </div>
        </div>
      </section>

      {["Основное", "Администрирование", "Профиль и настройки"].map((group) => {
        const sections = renderedSections.filter(
          ({ section }) => section.group === group,
        );
        if (sections.length === 0) return null;
        return (
          <section className="space-y-4" key={group}>
            <div className="px-1">
              <p className="app-accent-text text-xs font-black uppercase tracking-[0.16em]">
                {group}
              </p>
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              {sections.map(({ section, visiblePermissions }) => {
                const delegableSectionCodes = section.permissionCodes.filter(
                  (code) => permissionMap.has(code) && delegableCodes.has(code),
                );
                const activeCount = section.permissions.filter((permission) =>
                  permissionCodes.includes(permission.code),
                ).length;
                const allDelegableEnabled =
                  delegableSectionCodes.length > 0 &&
                  delegableSectionCodes.every((code) => permissionCodes.includes(code));
                const partiallyEnabled =
                  activeCount > 0 && activeCount < section.permissions.length;
                const collapsed = collapsedSections.has(section.key);

                return (
                  <article
                    className="app-surface app-border overflow-hidden rounded-[28px] border"
                    key={section.key}
                  >
                    <header className="app-surface-muted app-border-soft flex items-start justify-between gap-4 border-b p-5">
                      <button
                        className="min-w-0 flex-1 text-left"
                        onClick={() => toggleSectionCollapsed(section.key)}
                        type="button"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          {collapsed ? (
                            <FiChevronRight className="app-muted h-4 w-4" />
                          ) : (
                            <FiChevronDown className="app-muted h-4 w-4" />
                          )}
                          <h2 className="app-text text-lg font-black">{section.title}</h2>
                          <span className="app-muted text-xs font-bold">
                            {activeCount}/{section.permissions.length}
                          </span>
                          {partiallyEnabled && (
                            <span className="rounded-full border border-amber-300/60 bg-amber-50 px-2 py-0.5 text-[10px] font-black text-amber-700 dark:border-amber-700/50 dark:bg-amber-950/30 dark:text-amber-300">
                              Частично
                            </span>
                          )}
                        </div>
                        <p className="app-muted mt-1 text-sm leading-5">{section.description}</p>
                      </button>
                      <Button
                        disabled={editorLocked || delegableSectionCodes.length === 0}
                        onClick={(event: ReactMouseEvent<HTMLButtonElement>) => {
                          event.stopPropagation();
                          requestSectionToggle(section, !allDelegableEnabled);
                        }}
                        size="sm"
                        variant="secondary"
                      >
                        {allDelegableEnabled
                          ? "Снять доступные"
                          : delegableSectionCodes.length < section.permissions.length
                            ? "Выбрать доступные"
                            : "Выбрать все"}
                      </Button>
                    </header>

                    {!collapsed && (
                      <div className="divide-y divide-[var(--color-border-soft)]">
                        {visiblePermissions.map((permission) => {
                          const checked = permissionCodes.includes(permission.code);
                          const delegable = delegableCodes.has(permission.code);
                          const dependencies = (permissionDependencies[permission.code] ?? [])
                            .map((code) => permissionMap.get(code))
                            .filter((item): item is AccessPermission => Boolean(item));
                          const requiredBy = checked
                            ? getDependentPermissionCodes(permissionCodes, permission.code)
                                .map((code) => permissionMap.get(code))
                                .filter((item): item is AccessPermission => Boolean(item))
                            : [];
                          const risk = getPermissionRiskLevel(permission.code);

                          return (
                            <div
                              className="flex items-start justify-between gap-5 px-5 py-4"
                              key={permission.code}
                              title={
                                delegable
                                  ? undefined
                                  : "Недоступно для делегирования: у вашей учётной записи нет этого разрешения в глобальной области"
                              }
                            >
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="app-text text-sm font-black">{permission.name}</p>
                                  {checked && (
                                    <FiCheckCircle className="h-4 w-4 shrink-0 text-emerald-500" />
                                  )}
                                  {risk && <RiskBadge risk={risk} />}
                                  {!delegable && !isSuperadmin && (
                                    <span className="app-surface-muted app-border app-muted inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-black">
                                      <FiLock className="h-3 w-3" /> Недоступно
                                    </span>
                                  )}
                                </div>
                                <p className="app-muted mt-1 text-xs leading-5">
                                  {permission.description}
                                </p>
                                {dependencies.length > 0 && (
                                  <p className="mt-2 text-[11px] font-semibold text-sky-700 dark:text-sky-300">
                                    Требует: {dependencies.map((item) => item.name).join(" · ")}
                                  </p>
                                )}
                                {requiredBy.length > 0 && (
                                  <p className="mt-1 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                                    Необходимо для: {requiredBy.map((item) => item.name).join(" · ")}
                                  </p>
                                )}
                                <code className="app-muted mt-2 block truncate text-[10px] font-bold">
                                  {permission.code}
                                </code>
                              </div>
                              <PermissionSwitch
                                checked={checked}
                                disabled={editorLocked || !delegable}
                                label={permission.name}
                                onCheckedChange={(nextChecked) =>
                                  requestPermissionToggle(permission.code, nextChecked)
                                }
                              />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}

      {renderedSections.length === 0 && (
        <section className="app-surface app-border overflow-hidden rounded-[28px] border">
          <EmptyState
            description="Измените поисковый запрос или фильтр разрешений."
            title="Разрешения не найдены"
          />
        </section>
      )}

      <ConfirmDialog
        cancelLabel="Отмена"
        confirmLabel={pendingInfo.confirmLabel}
        description={pendingInfo.description}
        onConfirm={confirmPendingChange}
        onOpenChange={(open) => !open && setPendingChange(null)}
        open={Boolean(pendingChange)}
        title={pendingInfo.title}
      />
    </div>
  );
}

function addPermissionWithDependencies(
  selected: Set<string>,
  code: string,
  permissionMap: Map<string, AccessPermission>,
  delegableCodes: Set<string>,
  visiting = new Set<string>(),
): boolean {
  if (!permissionMap.has(code) || !delegableCodes.has(code)) return false;
  if (selected.has(code)) return true;
  if (visiting.has(code)) return false;

  visiting.add(code);
  for (const dependency of permissionDependencies[code] ?? []) {
    if (
      !addPermissionWithDependencies(
        selected,
        dependency,
        permissionMap,
        delegableCodes,
        visiting,
      )
    ) {
      visiting.delete(code);
      return false;
    }
  }
  visiting.delete(code);
  selected.add(code);
  return true;
}

function removePermissionAndDependents(selected: Set<string>, code: string): void {
  if (!selected.has(code)) return;
  selected.delete(code);

  for (const [dependentCode, dependencies] of Object.entries(permissionDependencies)) {
    if (dependencies.includes(code) && selected.has(dependentCode)) {
      removePermissionAndDependents(selected, dependentCode);
    }
  }
}

function getPendingChangeInfo(
  pendingChange: PendingPermissionChange,
  selectedCodes: string[],
  permissionMap: Map<string, AccessPermission>,
  delegableCodes: Set<string>,
): { title: string; description: string; confirmLabel: string } {
  if (!pendingChange) {
    return { title: "Подтвердить изменение", description: "", confirmLabel: "Продолжить" };
  }

  if (pendingChange.kind === "permission") {
    const permission = permissionMap.get(pendingChange.code);
    if (pendingChange.checked) {
      return {
        title: `Включить «${permission?.name ?? pendingChange.code}»?`,
        description:
          "Это критическое разрешение. Оно позволяет выполнять действие с повышенным влиянием на данные или безопасность системы. Технические зависимости будут включены автоматически.",
        confirmLabel: "Включить",
      };
    }
    const dependents = getDependentPermissionCodes(selectedCodes, pendingChange.code)
      .map((code) => permissionMap.get(code)?.name ?? code);
    return {
      title: `Отключить «${permission?.name ?? pendingChange.code}»?`,
      description: dependents.length
        ? `Вместе с ним будут отключены зависящие разрешения: ${dependents.join(", ")}.`
        : "Разрешение будет отключено.",
      confirmLabel: "Отключить",
    };
  }

  const section = rolePermissionSections.find((item) => item.key === pendingChange.sectionKey);
  if (pendingChange.checked) {
    const criticalNames = (section?.permissionCodes ?? [])
      .filter(
        (code) =>
          delegableCodes.has(code) &&
          !selectedCodes.includes(code) &&
          getPermissionRiskLevel(code) === "critical",
      )
      .map((code) => permissionMap.get(code)?.name ?? code);
    return {
      title: `Включить разрешения раздела «${section?.title ?? ""}»?`,
      description: criticalNames.length
        ? `Будут включены в том числе критические действия: ${criticalNames.join(", ")}. Необходимые зависимости также добавятся автоматически.`
        : "Будут включены все доступные для делегирования разрешения раздела.",
      confirmLabel: "Включить",
    };
  }

  const selectedInSection = (section?.permissionCodes ?? []).filter(
    (code) => delegableCodes.has(code) && selectedCodes.includes(code),
  );
  const affected = new Set<string>(selectedInSection);
  selectedInSection.forEach((code) =>
    getDependentPermissionCodes(selectedCodes, code).forEach((dependent) =>
      affected.add(dependent),
    ),
  );
  return {
    title: `Снять разрешения раздела «${section?.title ?? ""}»?`,
    description: `Будет отключено разрешений: ${affected.size}. Зависимые действия в других разделах также могут быть сняты автоматически.`,
    confirmLabel: "Снять",
  };
}

function serializeRoleDraft(
  name: string,
  description: string,
  permissionCodes: string[],
): string {
  return JSON.stringify({
    name,
    description,
    permissionCodes: [...new Set(permissionCodes)].sort(),
  });
}

function PermissionSwitch({
  checked,
  disabled = false,
  label,
  onCheckedChange,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onCheckedChange: (checked: boolean) => void;
}): JSX.Element {
  return (
    <RadixSwitch.Root
      aria-label={label}
      checked={checked}
      className="relative h-7 w-12 shrink-0 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-hover)] shadow-inner outline-none transition data-[disabled]:cursor-not-allowed data-[disabled]:opacity-40 data-[state=checked]:border-[var(--accent-border)] data-[state=checked]:bg-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent-border)] focus-visible:ring-offset-2"
      disabled={disabled}
      onCheckedChange={onCheckedChange}
    >
      <RadixSwitch.Thumb className="block h-5 w-5 translate-x-1 rounded-full bg-white shadow-md transition-transform duration-200 data-[state=checked]:translate-x-6" />
    </RadixSwitch.Root>
  );
}

function RiskBadge({ risk }: { risk: "elevated" | "critical" }): JSX.Element {
  const critical = risk === "critical";
  return (
    <span
      className={[
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-black",
        critical
          ? "border-rose-300/70 bg-rose-50 text-rose-700 dark:border-rose-700/50 dark:bg-rose-950/30 dark:text-rose-300"
          : "border-amber-300/70 bg-amber-50 text-amber-700 dark:border-amber-700/50 dark:bg-amber-950/30 dark:text-amber-300",
      ].join(" ")}
    >
      <FiAlertTriangle className="h-3 w-3" />
      {critical ? "Критическое" : "Повышенный риск"}
    </span>
  );
}

function SummaryValue({ label, value }: { label: string; value: number }): JSX.Element {
  return (
    <div className="app-surface-muted app-border rounded-2xl border p-4">
      <p className="app-text text-2xl font-black">{value}</p>
      <p className="app-muted mt-1 text-xs font-bold">{label}</p>
    </div>
  );
}
