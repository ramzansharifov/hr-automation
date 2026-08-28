import * as RadixSwitch from "@radix-ui/react-switch";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  FiAlertTriangle,
  FiArrowLeft,
  FiCheckCircle,
  FiGlobe,
  FiGrid,
  FiLayers,
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
  accessScopeRank,
  canScopePermissionTo,
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
  AccessScopeType,
  SaveAccessRoleParams,
} from "../../shared/types/access";
import type { HrEntityKey, HrRecord } from "../../shared/types/hr";
import {
  Button,
  ConfirmDialog,
  EmptyState,
  Input,
  LoadingState,
  PageHeader,
  SearchableSelect,
  Textarea,
  type SelectOption,
} from "../../shared/ui";
import { getErrorMessage } from "./accessControlData";
import {
  rolePermissionSections,
  type RolePermissionSectionDefinition,
} from "./rolePermissionSections";

type PermissionFilter = "all" | "selected" | "unselected";
type CustomRoleScopeType = Exclude<AccessScopeType, "self">;
type PendingPermissionChange =
  | { kind: "permission"; code: string; checked: boolean }
  | { kind: "section"; sectionKey: string; checked: boolean }
  | null;

interface DepartmentScopeOption extends SelectOption {
  enterpriseId: string;
}

interface RoleScopeSelection {
  scopeType: CustomRoleScopeType;
  enterpriseId: string;
  departmentId: string;
}

const permissionFilters: Array<{ value: PermissionFilter; label: string }> = [
  { value: "all", label: "Все" },
  { value: "selected", label: "Выбранные" },
  { value: "unselected", label: "Не выбранные" },
];

const scopeOptions: Array<{
  value: CustomRoleScopeType;
  label: string;
  description: string;
  icon: typeof FiGlobe;
}> = [
  {
    value: "global",
    label: "Вся система",
    description: "Доступ ко всем предприятиям в пределах выбранных разрешений.",
    icon: FiGlobe,
  },
  {
    value: "enterprise",
    label: "Предприятие",
    description: "Доступ только к одному выбранному предприятию.",
    icon: FiLayers,
  },
  {
    value: "department",
    label: "Отдел",
    description: "Доступ только к одному выбранному отделу.",
    icon: FiGrid,
  },
];

export function AccessRoleFormPage(): JSX.Element {
  const navigate = useNavigate();
  const params = useParams();
  const { session } = useAuth();
  const roleId = params.id ? Number(params.id) : null;
  const isEditMode = roleId !== null;
  const sessionEnterpriseId = session.enterpriseId;
  const sessionDepartmentId = session.departmentId;
  const sessionEnterpriseName = session.enterpriseName;
  const sessionDepartmentName = session.departmentName;
  const actorPermissionScopes = session.permissionScopes;
  const isSuperadmin =
    session.employeeId === 0 ||
    session.roles.some((item) => item.systemKey === "superadmin");
  const actorCreateScope = normalizeCustomRoleScope(
    actorPermissionScopes["roles.create"] ?? session.scopeType,
  );
  const initialScope = initialScopeForActor(
    actorCreateScope,
    sessionEnterpriseId,
    sessionDepartmentId,
  );

  const [permissions, setPermissions] = useState<AccessPermission[]>([]);
  const [roles, setRoles] = useState<AccessRoleSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [permissionCodes, setPermissionCodes] = useState<string[]>([]);
  const [scopeType, setScopeType] = useState<CustomRoleScopeType>(initialScope.scopeType);
  const [enterpriseId, setEnterpriseId] = useState(initialScope.enterpriseId);
  const [departmentId, setDepartmentId] = useState(initialScope.departmentId);
  const [enterpriseOptions, setEnterpriseOptions] = useState<SelectOption[]>([]);
  const [departmentOptions, setDepartmentOptions] = useState<DepartmentScopeOption[]>([]);
  const [permissionSearch, setPermissionSearch] = useState("");
  const [permissionFilter, setPermissionFilter] = useState<PermissionFilter>("all");
  const [pendingChange, setPendingChange] = useState<PendingPermissionChange>(null);
  const [baseline, setBaseline] = useState("");
  const [baselineReady, setBaselineReady] = useState(false);

  useEffect(() => {
    let active = true;

    async function load(): Promise<void> {
      setIsLoading(true);
      try {
        const [permissionData, roleData, scopeRecords] = await Promise.all([
          hrApiClient.listAccessPermissions(),
          hrApiClient.listAccessRoles(),
          isEditMode
            ? Promise.resolve({ enterprises: [] as HrRecord[], departments: [] as HrRecord[] })
            : loadRoleScopeRecords(),
        ]);
        if (!active) return;

        setPermissions(permissionData);
        setRoles(roleData);
        setEnterpriseOptions(
          scopeRecords.enterprises.map((record) => ({
            value: String(record.id),
            label: String(record.name ?? record.legal_name ?? `Предприятие #${record.id}`),
          })),
        );
        setDepartmentOptions(
          scopeRecords.departments.map((record) => ({
            value: String(record.id),
            label: String(record.name ?? `Отдел #${record.id}`),
            enterpriseId: String(record.enterprise_id ?? ""),
          })),
        );

        if (isEditMode) {
          const currentRole = roleData.find((item) => item.id === roleId);
          if (currentRole) {
            const cleanCodes = currentRole.permissionCodes.filter(
              (code) => !legacyPermissionCodes.has(code),
            );
            const currentScope = scopeFromRole(currentRole);
            setName(currentRole.name);
            setDescription(currentRole.description);
            setPermissionCodes(cleanCodes);
            setScopeType(currentScope.scopeType);
            setEnterpriseId(currentScope.enterpriseId);
            setDepartmentId(currentScope.departmentId);
            setBaseline(
              serializeRoleDraft(
                currentRole.name,
                currentRole.description,
                cleanCodes,
                currentScope,
              ),
            );
          }
        } else {
          const createScope = initialScopeForActor(
            actorCreateScope,
            sessionEnterpriseId,
            sessionDepartmentId,
          );
          setScopeType(createScope.scopeType);
          setEnterpriseId(createScope.enterpriseId);
          setDepartmentId(createScope.departmentId);
          setBaseline(serializeRoleDraft("", "", [], createScope));
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
  }, [
    actorCreateScope,
    isEditMode,
    roleId,
    sessionDepartmentId,
    sessionEnterpriseId,
  ]);

  const role = isEditMode
    ? roles.find((item) => item.id === roleId) ?? null
    : null;
  const targetScopeType = role
    ? normalizeCustomRoleScope(role.scopeType)
    : scopeType;
  const selectedDepartment = departmentOptions.find(
    (option) => option.value === departmentId,
  );
  const targetEnterpriseId =
    targetScopeType === "global"
      ? null
      : targetScopeType === "enterprise"
        ? positiveId(enterpriseId)
        : positiveId(selectedDepartment?.enterpriseId ?? role?.enterpriseId ?? enterpriseId);
  const targetDepartmentId =
    targetScopeType === "department" ? positiveId(departmentId) : null;
  const targetScopeReady =
    targetScopeType === "global" ||
    (targetScopeType === "enterprise" && Boolean(targetEnterpriseId)) ||
    (targetScopeType === "department" && Boolean(targetDepartmentId));

  const permissionMap = useMemo(
    () => new Map(permissions.map((permission) => [permission.code, permission])),
    [permissions],
  );

  const delegableCodes = useMemo(() => {
    const result = new Set<string>();
    if (!targetScopeReady) return result;

    for (const permission of permissions) {
      if (legacyPermissionCodes.has(permission.code)) continue;
      const dependencies = normalizePermissionDependencies([permission.code]).filter(
        (code) => !legacyPermissionCodes.has(code),
      );
      if (
        dependencies.every(
          (code) =>
            permissionMap.has(code) &&
            canDelegateToTarget({
              code,
              targetScopeType,
              targetEnterpriseId,
              targetDepartmentId,
              actorPermissionScopes,
              actorEnterpriseId: sessionEnterpriseId,
              actorDepartmentId: sessionDepartmentId,
              isSuperadmin,
            }),
        )
      ) {
        result.add(permission.code);
      }
    }
    return result;
  }, [
    actorPermissionScopes,
    isSuperadmin,
    permissionMap,
    permissions,
    sessionDepartmentId,
    sessionEnterpriseId,
    targetDepartmentId,
    targetEnterpriseId,
    targetScopeReady,
    targetScopeType,
  ]);

  const inaccessibleSelected = targetScopeReady
    ? permissionCodes.filter(
        (code) => !permissionMap.has(code) || !delegableCodes.has(code),
      )
    : [];
  const editorLocked = inaccessibleSelected.length > 0;
  const selectedCount = permissionCodes.filter((code) => delegableCodes.has(code)).length;
  const currentScope: RoleScopeSelection = {
    scopeType: targetScopeType,
    enterpriseId: targetScopeType === "global" ? "" : enterpriseId,
    departmentId: targetScopeType === "department" ? departmentId : "",
  };
  const currentDraft = serializeRoleDraft(name, description, permissionCodes, currentScope);
  const isDirty = baselineReady && currentDraft !== baseline;
  const canSave =
    !isSaving &&
    !editorLocked &&
    targetScopeReady &&
    Boolean(name.trim()) &&
    selectedCount > 0 &&
    (!isEditMode || isDirty);

  const selectedEnterpriseName =
    role?.enterpriseName ||
    enterpriseOptions.find((option) => option.value === enterpriseId)?.label ||
    (targetEnterpriseId === sessionEnterpriseId ? sessionEnterpriseName : "");
  const selectedDepartmentName =
    role?.departmentName ||
    selectedDepartment?.label ||
    (targetDepartmentId === sessionDepartmentId ? sessionDepartmentName : "");
  const scopeLabel = scopeLabelFor(
    targetScopeType,
    selectedEnterpriseName,
    selectedDepartmentName,
  );

  const availableScopeOptions = scopeOptions.filter(
    (option) => accessScopeRank[option.value] <= accessScopeRank[actorCreateScope],
  );
  const visibleDepartmentOptions = departmentOptions.filter(
    (option) => !enterpriseId || option.enterpriseId === enterpriseId,
  );

  const visibleSections = useMemo(() => {
    const search = permissionSearch.trim().toLocaleLowerCase();
    return rolePermissionSections
      .map((section) => ({
        section,
        permissions: section.permissionCodes
          .map((code) => permissionMap.get(code))
          .filter((item): item is AccessPermission => Boolean(item))
          .filter((permission) => {
            const selected = permissionCodes.includes(permission.code);
            if (permissionFilter === "selected" && !selected) return false;
            if (permissionFilter === "unselected" && selected) return false;
            if (!search) return true;
            return [
              permission.name,
              permission.description,
              permission.code,
              section.title,
            ]
              .join(" ")
              .toLocaleLowerCase()
              .includes(search);
          }),
      }))
      .filter((item) => item.permissions.length > 0);
  }, [permissionCodes, permissionFilter, permissionMap, permissionSearch]);

  function changeScope(nextScope: CustomRoleScopeType): void {
    if (isEditMode || nextScope === scopeType) return;
    if (accessScopeRank[nextScope] > accessScopeRank[actorCreateScope]) return;

    const compatible = permissionCodes.filter((code) =>
      normalizePermissionDependencies([code])
        .filter((dependency) => !legacyPermissionCodes.has(dependency))
        .every((dependency) => canScopePermissionTo(dependency, nextScope)),
    );
    if (compatible.length !== permissionCodes.length) {
      toast.info("Недоступные для выбранной области разрешения сняты автоматически");
    }
    setPermissionCodes(compatible);
    setScopeType(nextScope);
    setPendingChange(null);

    if (nextScope === "global") {
      setEnterpriseId("");
      setDepartmentId("");
      return;
    }
    if (actorCreateScope === "global") {
      setEnterpriseId("");
      setDepartmentId("");
      return;
    }
    setEnterpriseId(String(sessionEnterpriseId ?? ""));
    setDepartmentId(
      nextScope === "department" && actorCreateScope === "department"
        ? String(sessionDepartmentId ?? "")
        : "",
    );
  }

  function setPermission(code: string, checked: boolean): void {
    setPermissionCodes((current) => {
      const next = new Set(current);
      if (checked) addWithDependencies(next, code, permissionMap, delegableCodes);
      else removeWithDependents(next, code);
      return [...next];
    });
  }

  function requestPermissionChange(code: string, checked: boolean): void {
    if (editorLocked || !targetScopeReady || !delegableCodes.has(code)) return;
    if (
      (checked && getPermissionRiskLevel(code) === "critical") ||
      (!checked && getDependentPermissionCodes(permissionCodes, code).length > 0)
    ) {
      setPendingChange({ kind: "permission", code, checked });
      return;
    }
    setPermission(code, checked);
  }

  function setSection(section: RolePermissionSectionDefinition, checked: boolean): void {
    setPermissionCodes((current) => {
      const next = new Set(current);
      for (const code of section.permissionCodes) {
        if (!delegableCodes.has(code)) continue;
        if (checked) addWithDependencies(next, code, permissionMap, delegableCodes);
        else removeWithDependents(next, code);
      }
      return [...next];
    });
  }

  function requestSectionChange(
    section: RolePermissionSectionDefinition,
    checked: boolean,
  ): void {
    if (editorLocked || !targetScopeReady) return;
    const available = section.permissionCodes.filter((code) => delegableCodes.has(code));
    if (
      checked &&
      available.some(
        (code) =>
          !permissionCodes.includes(code) && getPermissionRiskLevel(code) === "critical",
      )
    ) {
      setPendingChange({ kind: "section", sectionKey: section.key, checked });
      return;
    }
    setSection(section, checked);
  }

  function confirmPending(): void {
    if (!pendingChange) return;
    if (pendingChange.kind === "permission") {
      setPermission(pendingChange.code, pendingChange.checked);
    } else {
      const section = rolePermissionSections.find(
        (item) => item.key === pendingChange.sectionKey,
      );
      if (section) setSection(section, pendingChange.checked);
    }
    setPendingChange(null);
  }

  async function saveRole(): Promise<void> {
    if (!name.trim()) {
      toast.error("Укажите название роли");
      return;
    }
    if (!targetScopeReady) {
      toast.error("Выберите организационную область роли");
      return;
    }
    const cleanCodes = permissionCodes.filter((code) => delegableCodes.has(code));
    if (cleanCodes.length === 0) {
      toast.error("Выберите хотя бы одно разрешение");
      return;
    }
    if (editorLocked) {
      toast.error("Роль содержит разрешения вне доступной области управления");
      return;
    }

    setIsSaving(true);
    try {
      const payload: SaveAccessRoleParams = {
        id: roleId ?? undefined,
        name: name.trim(),
        description: description.trim(),
        permissionCodes: cleanCodes,
        ...(!isEditMode
          ? {
              scopeType: targetScopeType,
              enterpriseId:
                targetScopeType === "global" ? null : targetEnterpriseId,
              departmentId:
                targetScopeType === "department" ? targetDepartmentId : null,
            }
          : {}),
      };
      const saved = await hrApiClient.saveAccessRole(payload);
      toast.success(isEditMode ? "Роль обновлена" : "Роль создана");
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
      <EmptyState
        description="Вернитесь к списку ролей и выберите существующую роль."
        title="Роль не найдена"
      />
    );
  }
  if (role?.isSystem) {
    return (
      <EmptyState
        description="Системные роли защищены от изменения."
        title="Системную роль нельзя редактировать"
      />
    );
  }

  const pendingInfo = describePendingChange(pendingChange, permissionMap, permissionCodes);

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <div className="flex flex-wrap gap-3">
            <Button
              className="border-white/20 bg-white/10 text-white"
              leftIcon={<FiArrowLeft />}
              onClick={() => navigate(isEditMode && roleId ? `/roles/${roleId}` : "/roles")}
              variant="ghost"
            >
              Назад
            </Button>
            <Button
              className="border-white/20 shadow-xl hover:opacity-90"
              disabled={!canSave}
              leftIcon={<FiSave />}
              onClick={() => void saveRole()}
              style={{ background: "#ffffff", color: "#0f172a" }}
              variant="ghost"
            >
              {isSaving ? "Сохранение..." : "Сохранить роль"}
            </Button>
          </div>
        }
        description={`Каждое действие настраивается отдельно. Область действия: ${scopeLabel}.`}
        eyebrow="Управление доступом"
        icon={<FiShield />}
        title={isEditMode ? `Редактирование · ${role?.name ?? "Роль"}` : "Новая роль"}
      />

      {editorLocked && (
        <Notice icon={<FiLock />} tone="warning" title="Редактирование роли ограничено">
          Роль содержит разрешения, которые текущий администратор не может делегировать в её области. Сохранение заблокировано для защиты от повышения привилегий.
        </Notice>
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

            <div className="app-border-soft border-t pt-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="app-text text-sm font-black">Область действия</p>
                  <p className="app-muted mt-1 text-xs leading-5">
                    Ограничивает все разрешения роли выбранной организационной областью.
                  </p>
                </div>
                {isEditMode && (
                  <span className="app-surface-muted app-border app-muted rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-wide">
                    Не изменяется
                  </span>
                )}
              </div>

              {isEditMode ? (
                <div className="app-surface-muted app-border mt-4 rounded-2xl border p-4">
                  <p className="app-text text-sm font-black">{scopeLabel}</p>
                  <p className="app-muted mt-1 text-xs">
                    Для изменения области создайте отдельную роль — это исключает скрытое расширение уже назначенного доступа.
                  </p>
                </div>
              ) : (
                <div className="mt-4 space-y-4">
                  <div className="grid gap-3 md:grid-cols-3">
                    {availableScopeOptions.map((option) => {
                      const Icon = option.icon;
                      const selected = scopeType === option.value;
                      return (
                        <button
                          className={[
                            "rounded-2xl border p-4 text-left transition",
                            selected
                              ? "app-accent-soft app-accent-border"
                              : "app-surface-muted app-border hover:border-[var(--accent-border)]",
                          ].join(" ")}
                          key={option.value}
                          onClick={() => changeScope(option.value)}
                          type="button"
                        >
                          <span className="flex items-center gap-2">
                            <Icon className="h-4 w-4" />
                            <span className="app-text text-sm font-black">{option.label}</span>
                          </span>
                          <span className="app-muted mt-2 block text-[11px] leading-5">
                            {option.description}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {scopeType !== "global" && (
                    <label className="grid gap-2">
                      <span className="app-text text-xs font-black">Предприятие</span>
                      <SearchableSelect
                        disabled={actorCreateScope !== "global"}
                        noOptionsLabel="Доступные предприятия не найдены"
                        onValueChange={(value) => {
                          setEnterpriseId(value);
                          setDepartmentId("");
                        }}
                        options={enterpriseOptions}
                        placeholder="Выберите предприятие"
                        searchPlaceholder="Поиск предприятия"
                        value={enterpriseId}
                      />
                    </label>
                  )}

                  {scopeType === "department" && (
                    <label className="grid gap-2">
                      <span className="app-text text-xs font-black">Отдел</span>
                      <SearchableSelect
                        disabled={!enterpriseId || actorCreateScope === "department"}
                        noOptionsLabel={
                          enterpriseId
                            ? "В выбранном предприятии нет доступных отделов"
                            : "Сначала выберите предприятие"
                        }
                        onValueChange={setDepartmentId}
                        options={enterpriseId ? visibleDepartmentOptions : []}
                        placeholder={enterpriseId ? "Выберите отдел" : "Сначала выберите предприятие"}
                        searchPlaceholder="Поиск отдела"
                        value={departmentId}
                      />
                    </label>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <aside className="app-surface app-border rounded-[28px] border p-6">
          <div className="flex items-center gap-3">
            <span className="app-accent-soft flex h-11 w-11 items-center justify-center rounded-2xl border">
              <FiSliders />
            </span>
            <div>
              <p className="app-text font-black">Доступ роли</p>
              <p className="app-muted mt-1 text-xs">{scopeLabel}</p>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <SummaryValue label="Разрешений" value={selectedCount} />
            <SummaryValue
              label="Разделов"
              value={
                rolePermissionSections.filter((section) =>
                  section.permissionCodes.some((code) => permissionCodes.includes(code)),
                ).length
              }
            />
          </div>
          <p className="app-muted mt-4 text-xs leading-5">
            Зависимости включаются автоматически. Выдать можно только те действия, которые сам администратор вправе делегировать в выбранную область.
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

      {!targetScopeReady && !isEditMode ? (
        <Notice icon={<FiLayers />} tone="info" title="Сначала выберите область роли">
          После выбора предприятия или отдела станут доступны только совместимые с этой областью разрешения.
        </Notice>
      ) : visibleSections.length === 0 ? (
        <EmptyState
          description="Измените поисковый запрос или фильтр разрешений."
          title="Разрешения не найдены"
        />
      ) : (
        ["Основное", "Администрирование", "Профиль и настройки"].map((group) => {
          const sections = visibleSections.filter(
            ({ section }) => section.group === group,
          );
          if (sections.length === 0) return null;
          return (
            <section className="space-y-4" key={group}>
              <p className="app-accent-text px-1 text-xs font-black uppercase tracking-[0.16em]">
                {group}
              </p>
              <div className="grid gap-4 xl:grid-cols-2">
                {sections.map(({ section, permissions: sectionPermissions }) => {
                  const availableCodes = section.permissionCodes.filter((code) =>
                    delegableCodes.has(code),
                  );
                  const allEnabled =
                    availableCodes.length > 0 &&
                    availableCodes.every((code) => permissionCodes.includes(code));
                  const enabled = section.permissionCodes.filter((code) =>
                    permissionCodes.includes(code),
                  ).length;
                  return (
                    <article
                      className="app-surface app-border overflow-hidden rounded-[28px] border"
                      key={section.key}
                    >
                      <header className="app-surface-muted app-border-soft flex items-start justify-between gap-4 border-b p-5">
                        <div>
                          <div className="flex items-center gap-2">
                            <h2 className="app-text text-lg font-black">{section.title}</h2>
                            <span className="app-muted text-xs font-bold">
                              {enabled}/{section.permissionCodes.length}
                            </span>
                          </div>
                          <p className="app-muted mt-1 text-sm leading-5">
                            {section.description}
                          </p>
                        </div>
                        <Button
                          disabled={editorLocked || availableCodes.length === 0}
                          onClick={() => requestSectionChange(section, !allEnabled)}
                          size="sm"
                          variant="secondary"
                        >
                          {allEnabled ? "Снять доступные" : "Выбрать доступные"}
                        </Button>
                      </header>
                      <div className="divide-y divide-[var(--color-border-soft)]">
                        {sectionPermissions.map((permission) => {
                          const checked = permissionCodes.includes(permission.code);
                          const delegable = delegableCodes.has(permission.code);
                          const dependencies = (permissionDependencies[permission.code] ?? [])
                            .map((code) => permissionMap.get(code)?.name ?? code);
                          const risk = getPermissionRiskLevel(permission.code);
                          return (
                            <div
                              className="flex items-start justify-between gap-5 px-5 py-4"
                              key={permission.code}
                            >
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="app-text text-sm font-black">{permission.name}</p>
                                  {checked && <FiCheckCircle className="h-4 w-4 text-emerald-500" />}
                                  {risk && <RiskBadge risk={risk} />}
                                  {!delegable && (
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
                                    Требует: {dependencies.join(" · ")}
                                  </p>
                                )}
                                <code className="app-muted mt-2 block text-[10px] font-bold">
                                  {permission.code}
                                </code>
                              </div>
                              <PermissionSwitch
                                checked={checked}
                                disabled={editorLocked || !delegable}
                                label={permission.name}
                                onCheckedChange={(checkedValue) =>
                                  requestPermissionChange(permission.code, checkedValue)
                                }
                              />
                            </div>
                          );
                        })}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })
      )}

      <ConfirmDialog
        cancelLabel="Отмена"
        confirmLabel={pendingInfo.confirmLabel}
        description={pendingInfo.description}
        onConfirm={confirmPending}
        onOpenChange={(open) => !open && setPendingChange(null)}
        open={Boolean(pendingChange)}
        title={pendingInfo.title}
      />
    </div>
  );
}

function addWithDependencies(
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
    if (!addWithDependencies(selected, dependency, permissionMap, delegableCodes, visiting)) {
      visiting.delete(code);
      return false;
    }
  }
  visiting.delete(code);
  selected.add(code);
  return true;
}

function removeWithDependents(selected: Set<string>, code: string): void {
  selected.delete(code);
  for (const [candidate, dependencies] of Object.entries(permissionDependencies)) {
    if (selected.has(candidate) && dependencies.includes(code)) {
      removeWithDependents(selected, candidate);
    }
  }
}

function canDelegateToTarget({
  code,
  targetScopeType,
  targetEnterpriseId,
  targetDepartmentId,
  actorPermissionScopes,
  actorEnterpriseId,
  actorDepartmentId,
  isSuperadmin,
}: {
  code: string;
  targetScopeType: CustomRoleScopeType;
  targetEnterpriseId: number | null;
  targetDepartmentId: number | null;
  actorPermissionScopes: Record<string, AccessScopeType>;
  actorEnterpriseId: number | null;
  actorDepartmentId: number | null;
  isSuperadmin: boolean;
}): boolean {
  if (!canScopePermissionTo(code, targetScopeType)) return false;
  if (isSuperadmin) return true;
  const actorScope = actorPermissionScopes[code];
  if (!actorScope || actorScope === "self") return false;
  if (actorScope === "global") return true;
  if (targetScopeType === "global") return false;
  if (actorScope === "enterprise") {
    return Boolean(targetEnterpriseId) && targetEnterpriseId === actorEnterpriseId;
  }
  return (
    targetScopeType === "department" &&
    Boolean(targetDepartmentId) &&
    targetDepartmentId === actorDepartmentId
  );
}

function normalizeCustomRoleScope(scope: AccessScopeType): CustomRoleScopeType {
  if (scope === "global" || scope === "enterprise" || scope === "department") {
    return scope;
  }
  return "department";
}

function initialScopeForActor(
  actorScope: CustomRoleScopeType,
  enterpriseId: number | null,
  departmentId: number | null,
): RoleScopeSelection {
  if (actorScope === "global") {
    return { scopeType: "global", enterpriseId: "", departmentId: "" };
  }
  if (actorScope === "enterprise") {
    return {
      scopeType: "enterprise",
      enterpriseId: String(enterpriseId ?? ""),
      departmentId: "",
    };
  }
  return {
    scopeType: "department",
    enterpriseId: String(enterpriseId ?? ""),
    departmentId: String(departmentId ?? ""),
  };
}

function scopeFromRole(role: AccessRoleSummary): RoleScopeSelection {
  return {
    scopeType: normalizeCustomRoleScope(role.scopeType),
    enterpriseId: String(role.enterpriseId ?? ""),
    departmentId: String(role.departmentId ?? ""),
  };
}

function scopeLabelFor(
  scope: CustomRoleScopeType,
  enterpriseName: string,
  departmentName: string,
): string {
  if (scope === "global") return "вся система";
  if (scope === "enterprise") {
    return enterpriseName ? `предприятие «${enterpriseName}»` : "предприятие не выбрано";
  }
  return departmentName ? `отдел «${departmentName}»` : "отдел не выбран";
}

function serializeRoleDraft(
  name: string,
  description: string,
  permissionCodes: string[],
  scope: RoleScopeSelection,
): string {
  return JSON.stringify({
    name,
    description,
    permissionCodes: [...new Set(permissionCodes)].sort(),
    scopeType: scope.scopeType,
    enterpriseId: scope.scopeType === "global" ? "" : scope.enterpriseId,
    departmentId: scope.scopeType === "department" ? scope.departmentId : "",
  });
}

function describePendingChange(
  pending: PendingPermissionChange,
  permissionMap: Map<string, AccessPermission>,
  selectedCodes: string[],
): { title: string; description: string; confirmLabel: string } {
  if (!pending) {
    return { title: "Подтвердить изменение", description: "", confirmLabel: "Продолжить" };
  }
  if (pending.kind === "section") {
    const section = rolePermissionSections.find((item) => item.key === pending.sectionKey);
    return {
      title: `${pending.checked ? "Включить" : "Снять"} разрешения «${section?.title ?? "раздела"}»?`,
      description: pending.checked
        ? "Будут включены доступные разрешения раздела и их обязательные зависимости, включая критические действия."
        : "Будут сняты разрешения раздела и зависящие от них действия.",
      confirmLabel: pending.checked ? "Включить" : "Снять",
    };
  }
  const permission = permissionMap.get(pending.code);
  const dependents = getDependentPermissionCodes(selectedCodes, pending.code)
    .map((code) => permissionMap.get(code)?.name ?? code);
  return {
    title: `${pending.checked ? "Включить" : "Отключить"} «${permission?.name ?? pending.code}»?`,
    description: pending.checked
      ? "Это критическое разрешение. Обязательные зависимости будут включены автоматически."
      : dependents.length
        ? `Вместе с ним будут отключены зависимые действия: ${dependents.join(", ")}.`
        : "Разрешение будет отключено.",
    confirmLabel: pending.checked ? "Включить" : "Отключить",
  };
}

async function loadRoleScopeRecords(): Promise<{
  enterprises: HrRecord[];
  departments: HrRecord[];
}> {
  const [enterprises, departments] = await Promise.all([
    loadAll("enterprises"),
    loadAll("departments"),
  ]);
  return { enterprises, departments };
}

async function loadAll(
  entity: Extract<HrEntityKey, "enterprises" | "departments">,
): Promise<HrRecord[]> {
  const records: HrRecord[] = [];
  let page = 1;
  let totalPages = 1;
  do {
    const result = await hrApiClient.list({
      entity,
      page,
      pageSize: 100,
      filters: { is_archived: { operator: "equals", value: 0 } },
      orderBy: "name",
      orderDirection: "asc",
    });
    records.push(...result.items);
    totalPages = Math.max(result.totalPages, 1);
    page += 1;
  } while (page <= totalPages);
  return records;
}

function positiveId(value: unknown): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function PermissionSwitch({
  checked,
  disabled,
  label,
  onCheckedChange,
}: {
  checked: boolean;
  disabled: boolean;
  label: string;
  onCheckedChange: (checked: boolean) => void;
}): JSX.Element {
  return (
    <RadixSwitch.Root
      aria-label={label}
      checked={checked}
      className="relative h-7 w-12 shrink-0 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-hover)] shadow-inner outline-none transition data-[disabled]:cursor-not-allowed data-[disabled]:opacity-40 data-[state=checked]:border-[var(--accent-border)] data-[state=checked]:bg-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent-border)]"
      disabled={disabled}
      onCheckedChange={onCheckedChange}
    >
      <RadixSwitch.Thumb className="block h-5 w-5 translate-x-1 rounded-full bg-white shadow-md transition-transform data-[state=checked]:translate-x-6" />
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

function Notice({
  children,
  icon,
  title,
  tone,
}: {
  children: ReactNode;
  icon: ReactNode;
  title: string;
  tone: "warning" | "info";
}): JSX.Element {
  return (
    <section
      className={
        tone === "warning"
          ? "rounded-[24px] border border-amber-300/60 bg-amber-50/80 p-5 text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/30 dark:text-amber-100"
          : "rounded-[24px] border border-sky-300/60 bg-sky-50/80 p-5 text-sky-900 dark:border-sky-700/50 dark:bg-sky-950/30 dark:text-sky-100"
      }
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 shrink-0">{icon}</span>
        <div>
          <p className="font-black">{title}</p>
          <p className="mt-1 text-sm leading-6 opacity-85">{children}</p>
        </div>
      </div>
    </section>
  );
}
