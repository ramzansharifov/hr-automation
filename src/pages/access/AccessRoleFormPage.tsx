import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  FiAlertTriangle,
  FiCheckCircle,
  FiGlobe,
  FiGrid,
  FiLayers,
  FiLock,
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
import { useAppText } from "../../shared/i18n";
import { hrApiClient } from "../../shared/lib/hrApiClient";
import type {
  AccessPermission,
  AccessRoleSummary,
  AccessScopeType,
  SaveAccessRoleParams,
} from "../../shared/types/access";
import type { HrEntityKey, HrRecord } from "../../shared/types/hr";
import {
  ActionButton,
  Button,
  ConfirmDialog,
  EmptyState,
  Input,
  LoadingState,
  PageHeader,
  SearchableSelect,
  Textarea,
  Toggle,
  type SelectOption,
} from "../../shared/ui";
import { getErrorMessage } from "./accessControlData";
import {
  accessPermissionDescription,
  accessPermissionName,
} from "./accessTranslations";
import {
  rolePermissionGroupLabel,
  rolePermissionSectionTitle,
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

const permissionFilters: PermissionFilter[] = ["all", "selected", "unselected"];

const scopeOptions: Array<{
  value: CustomRoleScopeType;
  icon: typeof FiGlobe;
}> = [
  { value: "global", icon: FiGlobe },
  { value: "enterprise", icon: FiLayers },
  { value: "department", icon: FiGrid },
];

export function AccessRoleFormPage(): JSX.Element {
  const text = useAppText();
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
            label: String(record.name ?? record.legal_name ?? text(`Предприятие #${record.id}`, `Enterprise #${record.id}`)),
          })),
        );
        setDepartmentOptions(
          scopeRecords.departments.map((record) => ({
            value: String(record.id),
            label: String(record.name ?? text(`Отдел #${record.id}`, `Department #${record.id}`)),
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
        toast.error(getErrorMessage(error, text("Не удалось загрузить данные роли", "Failed to load role data")));
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
    text,
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
    text,
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
              accessPermissionName(permission, text),
              permission.code,
              section.title,
              rolePermissionSectionTitle(section, text),
            ]
              .join(" ")
              .toLocaleLowerCase()
              .includes(search);
          }),
      }))
      .filter((item) => item.permissions.length > 0);
  }, [permissionCodes, permissionFilter, permissionMap, permissionSearch, text]);

  function changeScope(nextScope: CustomRoleScopeType): void {
    if (isEditMode || nextScope === scopeType) return;
    if (accessScopeRank[nextScope] > accessScopeRank[actorCreateScope]) return;

    const compatible = permissionCodes.filter((code) =>
      normalizePermissionDependencies([code])
        .filter((dependency) => !legacyPermissionCodes.has(dependency))
        .every((dependency) => canScopePermissionTo(dependency, nextScope)),
    );
    if (compatible.length !== permissionCodes.length) {
      toast.info(text("Недоступные для выбранной области разрешения сняты автоматически", "Permissions unavailable in the selected scope were removed automatically"));
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
      toast.error(text("Укажите название роли", "Enter a role name"));
      return;
    }
    if (!targetScopeReady) {
      toast.error(text("Выберите организационную область роли", "Select the role data scope"));
      return;
    }
    const cleanCodes = permissionCodes.filter((code) => delegableCodes.has(code));
    if (cleanCodes.length === 0) {
      toast.error(text("Выберите хотя бы одно разрешение", "Select at least one permission"));
      return;
    }
    if (editorLocked) {
      toast.error(text("Роль содержит разрешения вне доступной области управления", "The role contains permissions outside your manageable scope"));
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
      toast.success(isEditMode ? text("Роль обновлена", "Role updated") : text("Роль создана", "Role created"));
      navigate(`/roles/${saved.id}`);
    } catch (error) {
      toast.error(getErrorMessage(error, text("Не удалось сохранить роль", "Failed to save role")));
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) return <LoadingState label={text("Загрузка разрешений...", "Loading permissions...")} />;
  if (isEditMode && (!role || !Number.isInteger(roleId) || Number(roleId) < 1)) {
    return (
      <EmptyState
        description={text("Вернитесь к списку ролей и выберите существующую роль.", "Return to the role list and select an existing role.")}
        title={text("Роль не найдена", "Role not found")}
      />
    );
  }
  if (role?.isSystem) {
    return (
      <EmptyState
        description={text("Системные роли защищены от изменения.", "System roles are protected from modification.")}
        title={text("Системную роль нельзя редактировать", "System roles cannot be edited")}
      />
    );
  }

  const pendingInfo = describePendingChange(
    pendingChange,
    permissionMap,
    permissionCodes,
    text,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <div className="flex flex-wrap gap-3">
            <ActionButton
              action="back"
              onClick={() =>
                navigate(isEditMode && roleId ? `/roles/${roleId}` : "/roles")
              }
            />
            <ActionButton
              action="save"
              disabled={!canSave}
              loading={isSaving}
              onClick={() => void saveRole()}
            >
              {text("Сохранить роль", "Save role")}
            </ActionButton>
          </div>
        }
        eyebrow={text("Управление доступом", "Access control")}
        icon={<FiShield />}
        title={isEditMode ? text(`Редактирование · ${role?.name ?? "Роль"}`, `Edit · ${role?.name ?? "Role"}`) : text("Новая роль", "New role")}
      />

      {editorLocked && (
        <Notice icon={<FiLock />} tone="warning" title={text("Редактирование роли ограничено", "Role editing is restricted")}>
          {text("Роль содержит разрешения, которые текущий администратор не может делегировать в её области. Сохранение заблокировано для защиты от повышения привилегий.", "This role contains permissions the current administrator cannot delegate in its scope. Saving is blocked to prevent privilege escalation.")}
        </Notice>
      )}

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="app-surface app-border rounded-[28px] border p-6">
          <div className="grid gap-5">
            <label className="grid gap-2">
              <span className="app-text text-sm font-black">{text("Название роли", "Role name")}</span>
              <Input
                disabled={editorLocked}
                maxLength={100}
                onChange={(event) => setName(event.target.value)}
                placeholder={text("Например, HR-менеджер", "For example, HR manager")}
                value={name}
              />
            </label>
            <label className="grid gap-2">
              <span className="app-text text-sm font-black">{text("Описание", "Description")}</span>
              <Textarea
                disabled={editorLocked}
                onChange={(event) => setDescription(event.target.value)}
                placeholder={text("Кому предназначена роль и за что отвечает", "Who this role is for and what it is responsible for")}
                value={description}
              />
            </label>

            <div className="app-border-soft border-t pt-5">
              <div className="flex items-start justify-between gap-4">
                <p className="app-text text-sm font-black">Область действия</p>
                {isEditMode && (
                  <span className="app-surface-muted app-border app-meta rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-wide">
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
                            <span className="app-text text-sm font-black">{scopeOptionLabel(option.value, text)}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {scopeType !== "global" && (
                    <label className="grid gap-2">
                      <span className="app-text text-xs font-black">{text("Предприятие", "Enterprise")}</span>
                      <SearchableSelect
                        disabled={actorCreateScope !== "global"}
                        noOptionsLabel={text("Доступные предприятия не найдены", "No available enterprises found")}
                        onValueChange={(value) => {
                          setEnterpriseId(value);
                          setDepartmentId("");
                        }}
                        options={enterpriseOptions}
                        placeholder={text("Выберите предприятие", "Select enterprise")}
                        searchPlaceholder={text("Поиск предприятия", "Search enterprise")}
                        value={enterpriseId}
                      />
                    </label>
                  )}

                  {scopeType === "department" && (
                    <label className="grid gap-2">
                      <span className="app-text text-xs font-black">{text("Отдел", "Department")}</span>
                      <SearchableSelect
                        disabled={!enterpriseId || actorCreateScope === "department"}
                        noOptionsLabel={
                          enterpriseId
                            ? text("В выбранном предприятии нет доступных отделов", "No available departments in the selected enterprise")
                            : text("Сначала выберите предприятие", "Select an enterprise first")
                        }
                        onValueChange={setDepartmentId}
                        options={enterpriseId ? visibleDepartmentOptions : []}
                        placeholder={enterpriseId ? text("Выберите отдел", "Select department") : text("Сначала выберите предприятие", "Select an enterprise first")}
                        searchPlaceholder={text("Поиск отдела", "Search department")}
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
              <p className="app-text font-black">{text("Доступ роли", "Role access")}</p>
              <p className="app-muted mt-1 text-xs">{scopeLabel}</p>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <SummaryValue label={text("Разрешений", "Permissions")} value={selectedCount} />
            <SummaryValue
              label={text("Разделов", "Sections")}
              value={
                rolePermissionSections.filter((section) =>
                  section.permissionCodes.some((code) => permissionCodes.includes(code)),
                ).length
              }
            />
          </div>
          {isDirty && (
            <p className="mt-3 text-xs font-black text-amber-800 dark:text-amber-300">
              {text("Есть несохранённые изменения", "There are unsaved changes")}
            </p>
          )}
        </aside>
      </section>

      <section className="app-surface app-border rounded-[28px] border p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative min-w-0 flex-1 lg:max-w-xl">
            <FiSearch className="app-muted pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2" />
            <Input
              aria-label={text("Поиск разрешений", "Search permissions")}
              className="pl-10"
              onChange={(event) => setPermissionSearch(event.target.value)}
              placeholder={text("Поиск по действию или коду", "Search by action or code")}
              value={permissionSearch}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {permissionFilters.map((filter) => (
              <Button
                key={filter}
                onClick={() => setPermissionFilter(filter)}
                size="sm"
                variant={permissionFilter === filter ? "primary" : "secondary"}
              >
                {permissionFilterLabel(filter, text)}
              </Button>
            ))}
          </div>
        </div>
      </section>

      {!targetScopeReady && !isEditMode ? (
        <Notice icon={<FiLayers />} tone="info" title={text("Сначала выберите область роли", "Select the role scope first")}>
          {text("После выбора предприятия или отдела станут доступны только совместимые с этой областью разрешения.", "After selecting an enterprise or department, only permissions compatible with that scope will be available.")}
        </Notice>
      ) : visibleSections.length === 0 ? (
        <EmptyState
          description={text("Измените поисковый запрос или фильтр разрешений.", "Change the search query or permission filter.")}
          title={text("Разрешения не найдены", "No permissions found")}
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
                {rolePermissionGroupLabel(group as RolePermissionSectionDefinition["group"], text)}
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
                      <header className="app-surface-muted app-border-soft flex items-center justify-between gap-4 border-b p-5">
                        <div className="flex items-center gap-2">
                          <h2 className="app-text text-lg font-black">{rolePermissionSectionTitle(section, text)}</h2>
                          <span className="app-section-count">
                            {enabled}/{section.permissionCodes.length}
                          </span>
                        </div>
                        <Button
                          disabled={editorLocked || availableCodes.length === 0}
                          onClick={() => requestSectionChange(section, !allEnabled)}
                          size="sm"
                          variant="secondary"
                        >
                          {allEnabled
                            ? text("Снять доступные", "Clear available")
                            : text("Выбрать доступные", "Select available")}
                        </Button>
                      </header>
                      <div className="divide-y divide-[var(--color-border-soft)]">
                        {sectionPermissions.map((permission) => {
                          const checked = permissionCodes.includes(permission.code);
                          const delegable = delegableCodes.has(permission.code);
                          const dependencies = (permissionDependencies[permission.code] ?? []).map(
                            (code) => {
                              const dependency = permissionMap.get(code);
                              return dependency
                                ? accessPermissionName(dependency, text)
                                : code;
                            },
                          );
                          const risk = getPermissionRiskLevel(permission.code);
                          return (
                            <div
                              className="flex items-start justify-between gap-5 px-5 py-4"
                              key={permission.code}
                            >
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="app-text text-sm font-black">{accessPermissionName(permission, text)}</p>
                                  <p className="app-muted mt-1 text-xs leading-5">
                                    {accessPermissionDescription(permission, text)}
                                  </p>
                                  {checked && <FiCheckCircle className="h-4 w-4 text-emerald-500" />}
                                  {risk && <RiskBadge risk={risk} text={text} />}
                                  {!delegable && (
                                    <span className="app-surface-muted app-border app-meta inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-black">
                                      <FiLock className="h-3 w-3" /> {text("Недоступно", "Unavailable")}
                                    </span>
                                  )}
                                </div>
                                {dependencies.length > 0 && (
                                  <p className="app-permission-dependency mt-2">
                                    {text("Требует:", "Requires:")} {dependencies.join(" · ")}
                                  </p>
                                )}
                                <code className="app-permission-code mt-2 block font-mono">
                                  {permission.code}
                                </code>
                              </div>
                              <Toggle
                                ariaLabel={accessPermissionName(permission, text)}
                                checked={checked}
                                disabled={editorLocked || !delegable}
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
        cancelLabel={text("Отмена", "Cancel")}
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

function permissionFilterLabel(
  filter: PermissionFilter,
  text: (ru: string, en: string) => string,
): string {
  if (filter === "selected") return text("Выбранные", "Selected");
  if (filter === "unselected") return text("Не выбранные", "Not selected");
  return text("Все", "All");
}

function scopeOptionLabel(
  scope: CustomRoleScopeType,
  text: (ru: string, en: string) => string,
): string {
  if (scope === "enterprise") return text("Предприятие", "Enterprise");
  if (scope === "department") return text("Отдел", "Department");
  return text("Вся система", "Entire system");
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
  text: (ru: string, en: string) => string,
): string {
  if (scope === "global") return text("вся система", "entire system");
  if (scope === "enterprise") {
    return enterpriseName
      ? text(`предприятие «${enterpriseName}»`, `enterprise “${enterpriseName}”`)
      : text("предприятие не выбрано", "enterprise not selected");
  }
  return departmentName
    ? text(`отдел «${departmentName}»`, `department “${departmentName}”`)
    : text("отдел не выбран", "department not selected");
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
  text: (ru: string, en: string) => string,
): { title: string; description: string; confirmLabel: string } {
  if (!pending) {
    return {
      title: text("Подтвердить изменение", "Confirm change"),
      description: "",
      confirmLabel: text("Продолжить", "Continue"),
    };
  }
  if (pending.kind === "section") {
    const section = rolePermissionSections.find((item) => item.key === pending.sectionKey);
    return {
      title: text(
        `${pending.checked ? "Включить" : "Снять"} разрешения «${section?.title ?? "раздела"}»?`,
        `${pending.checked ? "Enable" : "Remove"} permissions for “${section ? rolePermissionSectionTitle(section, text) : "section"}”?`,
      ),
      description: pending.checked
        ? text(
            "Будут включены доступные разрешения раздела и их обязательные зависимости, включая критические действия.",
            "Available section permissions and their required dependencies, including critical actions, will be enabled.",
          )
        : text(
            "Будут сняты разрешения раздела и зависящие от них действия.",
            "Section permissions and actions that depend on them will be removed.",
          ),
      confirmLabel: pending.checked
        ? text("Включить", "Enable")
        : text("Снять", "Remove"),
    };
  }
  const permission = permissionMap.get(pending.code);
  const dependents = getDependentPermissionCodes(selectedCodes, pending.code).map(
    (code) => {
      const dependent = permissionMap.get(code);
      return dependent ? accessPermissionName(dependent, text) : code;
    },
  );
  const permissionLabel = permission
    ? accessPermissionName(permission, text)
    : pending.code;
  return {
    title: text(
      `${pending.checked ? "Включить" : "Отключить"} «${permission?.name ?? pending.code}»?`,
      `${pending.checked ? "Enable" : "Disable"} “${permissionLabel}”?`,
    ),
    description: pending.checked
      ? text(
          "Это критическое разрешение. Обязательные зависимости будут включены автоматически.",
          "This is a critical permission. Required dependencies will be enabled automatically.",
        )
      : dependents.length
        ? text(
            `Вместе с ним будут отключены зависимые действия: ${dependents.join(", ")}.`,
            `Dependent actions will also be disabled: ${dependents.join(", ")}.`,
          )
        : text("Разрешение будет отключено.", "The permission will be disabled."),
    confirmLabel: pending.checked
      ? text("Включить", "Enable")
      : text("Отключить", "Disable"),
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

function RiskBadge({
  risk,
  text,
}: {
  risk: "elevated" | "critical";
  text: (ru: string, en: string) => string;
}): JSX.Element {
  const critical = risk === "critical";
  return (
    <span
      className={[
        "app-risk-badge inline-flex items-center gap-1 rounded-full border px-2 py-0.5",
        critical
          ? "app-risk-badge--critical"
          : "app-risk-badge--elevated",
      ].join(" ")}
    >
      <FiAlertTriangle className="h-3 w-3" />
      {critical ? text("Критическое", "Critical") : text("Повышенный риск", "Elevated risk")}
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
