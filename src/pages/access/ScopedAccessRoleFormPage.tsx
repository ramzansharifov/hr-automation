import { useEffect, useMemo, useState } from "react";
import {
  FiAlertTriangle,
  FiBriefcase,
  FiLayers,
  FiLock,
  FiSearch,
  FiShield,
} from "react-icons/fi";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";

import { useAuth } from "../../features/auth/AuthContext";
import {
  getDependentPermissionCodes,
  getPermissionRiskLevel,
  normalizePermissionDependencies,
} from "../../shared/access/permissionRules";
import { useAppText } from "../../shared/i18n";
import { hrApiClient } from "../../shared/lib/hrApiClient";
import type {
  AccessPermission,
  AccessRoleSummary,
  AccessScopeType,
  SaveAccessRoleParams,
} from "../../shared/types/access";
import {
  ActionButton,
  ConfirmDialog,
  EmptyState,
  Input,
  LoadingState,
  PageHeader,
  Textarea,
  Toggle,
} from "../../shared/ui";
import { getErrorMessage, groupPermissions } from "./accessControlData";
import {
  accessPermissionDescription,
  accessPermissionName,
} from "./accessTranslations";
import {
  rolePermissionSectionTitle,
  rolePermissionSections,
} from "./rolePermissionSections";

export function ScopedAccessRoleFormPage(): JSX.Element {
  const text = useAppText();
  const { session } = useAuth();
  const navigate = useNavigate();
  const params = useParams();
  const roleId = params.id ? Number(params.id) : null;
  const isEditMode = roleId !== null;
  const [permissions, setPermissions] = useState<AccessPermission[]>([]);
  const [roles, setRoles] = useState<AccessRoleSummary[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [permissionCodes, setPermissionCodes] = useState<string[]>([]);
  const [baseline, setBaseline] = useState("");
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingCriticalCode, setPendingCriticalCode] = useState<string | null>(null);
  const [pendingRemovalCode, setPendingRemovalCode] = useState<string | null>(null);
  const [leaveConfirmationOpen, setLeaveConfirmationOpen] = useState(false);

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
          const currentRole = roleData.find((role) => role.id === roleId);
          if (currentRole) {
            setName(currentRole.name);
            setDescription(currentRole.description);
            setPermissionCodes(currentRole.permissionCodes);
            setBaseline(
              serializeDraft(
                currentRole.name,
                currentRole.description,
                currentRole.permissionCodes,
              ),
            );
          }
        } else {
          setBaseline(serializeDraft("", "", []));
        }
      } catch (error) {
        toast.error(getErrorMessage(error, text("Не удалось загрузить конструктор роли", "Failed to load role builder")));
      } finally {
        if (active) setIsLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [isEditMode, roleId, text]);

  const role = isEditMode
    ? roles.find((item) => item.id === roleId) ?? null
    : null;
  const permissionMap = useMemo(
    () => new Map(permissions.map((permission) => [permission.code, permission])),
    [permissions],
  );
  const inaccessibleSelected = permissionCodes.filter(
    (code) => !permissionMap.has(code),
  );
  const editorLocked = inaccessibleSelected.length > 0;
  const visibleGroups = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return groupPermissions(permissions)
      .map(([module, items]) => [
        module,
        items.filter((permission) => {
          if (!query) return true;
          return [
            accessPermissionName(permission, text),
            accessPermissionDescription(permission, text),
            permission.code,
            permission.module,
          ]
            .join(" ")
            .toLocaleLowerCase()
            .includes(query);
        }),
      ] as const)
      .filter(([, items]) => items.length > 0);
  }, [permissions, search, text]);

  const currentSnapshot = serializeDraft(name, description, permissionCodes);
  const isDirty = currentSnapshot !== baseline;
  const canSave =
    !isSaving &&
    !editorLocked &&
    Boolean(name.trim()) &&
    permissionCodes.length > 0 &&
    (!isEditMode || isDirty);

  const scope = getDisplayedScope(
    role?.scopeType ?? session.permissionScopes[isEditMode ? "roles.edit" : "roles.create"],
    role,
    session.enterpriseName,
    session.departmentName,
    text,
  );

  useEffect(() => {
    if (!isDirty) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent): void => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  function addPermission(code: string): void {
    setPermissionCodes((current) =>
      normalizePermissionDependencies([...current, code]).filter((candidate) =>
        permissionMap.has(candidate),
      ),
    );
  }

  function removePermission(code: string): void {
    setPermissionCodes((current) => {
      const dependents = new Set(getDependentPermissionCodes(current, code));
      dependents.add(code);
      return current.filter((candidate) => !dependents.has(candidate));
    });
  }

  function togglePermission(code: string, checked: boolean): void {
    if (editorLocked) return;
    if (checked && getPermissionRiskLevel(code) === "critical") {
      setPendingCriticalCode(code);
      return;
    }
    if (!checked) {
      const dependents = getDependentPermissionCodes(permissionCodes, code);
      if (dependents.length > 0) {
        setPendingRemovalCode(code);
        return;
      }
      removePermission(code);
      return;
    }
    addPermission(code);
  }

  function navigateToRoleList(): void {
    navigate(isEditMode && roleId ? `/roles/${roleId}` : "/roles");
  }

  function navigateBack(): void {
    if (isDirty) {
      setLeaveConfirmationOpen(true);
      return;
    }
    navigateToRoleList();
  }

  async function saveRole(): Promise<void> {
    if (!canSave) return;
    setIsSaving(true);
    try {
      const params: SaveAccessRoleParams = {
        id: roleId ?? undefined,
        name: name.trim(),
        description: description.trim(),
        permissionCodes,
      };
      const saved = await hrApiClient.saveAccessRole(params);
      toast.success(isEditMode ? text("Роль обновлена", "Role updated") : text("Роль создана", "Role created"));
      navigate(`/roles/${saved.id}`);
    } catch (error) {
      toast.error(getErrorMessage(error, text("Не удалось сохранить роль", "Failed to save role")));
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) return <LoadingState label={text("Загрузка конструктора роли...", "Loading role builder...")} />;

  if (isEditMode && (!role || !Number.isInteger(roleId) || Number(roleId) < 1)) {
    return (
      <section className="app-surface app-border overflow-hidden rounded-[28px] border">
        <EmptyState
          description={text("Роль не существует или находится вне вашей области администрирования.", "The role does not exist or is outside your administration scope.")}
          title={text("Роль недоступна", "Role unavailable")}
        />
      </section>
    );
  }

  if (role?.isSystem) {
    return (
      <section className="app-surface app-border overflow-hidden rounded-[28px] border">
        <EmptyState
          description={text("Системные роли защищены от изменения.", "System roles are protected from modification.")}
          title={text("Системную роль нельзя редактировать", "System role cannot be edited")}
        />
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <div className="flex flex-wrap gap-3">
            <ActionButton action="back" onClick={navigateBack} />
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
        description={text("Разрешения этой роли будут действовать только внутри указанной организационной области. Область задаётся вашим уровнем администрирования и не выбирается вручную.", "This role’s permissions apply only within the specified organization scope. The scope is defined by your administration level and cannot be selected manually.")}
        eyebrow={text("Локальный конструктор доступа", "Scoped access builder")}
        icon={<FiShield />}
        title={isEditMode ? text(`Редактирование · ${role?.name ?? "Роль"}`, `Edit · ${role?.name ?? "Role"}`) : text("Новая роль", "New role")}
      />

      <section className="app-surface app-border flex flex-col gap-4 rounded-[24px] border p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="app-accent-soft flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border">
            {scope.type === "department" ? <FiBriefcase /> : <FiLayers />}
          </span>
          <div>
            <p className="app-text text-sm font-black">{text("Область действия роли", "Role scope")}</p>
            <p className="app-text-soft mt-1 text-sm font-semibold">{scope.label}</p>
          </div>
        </div>
        <span className="app-surface-muted app-border rounded-full border px-3 py-1.5 text-xs font-black">
          {text("Фиксированная область", "Fixed scope")}
        </span>
      </section>

      {editorLocked && (
        <section className="rounded-[24px] border border-amber-300/60 bg-amber-50/80 p-5 text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/30 dark:text-amber-100">
          <div className="flex items-start gap-3">
            <FiLock className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-black">{text("Роль содержит недоступные вам разрешения", "The role contains permissions unavailable to you")}</p>
              <p className="mt-1 text-sm leading-6 opacity-85">
                {text("Сохранение заблокировано, чтобы локальный администратор не мог перераспределить доступ выше собственного уровня.", "Saving is blocked so a scoped administrator cannot redistribute access above their own level.")}
              </p>
            </div>
          </div>
        </section>
      )}

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="app-surface app-border rounded-[28px] border p-6">
          <div className="grid gap-5">
            <label className="grid gap-2">
              <span className="app-text text-sm font-black">{text("Название роли", "Role name")}</span>
              <Input
                disabled={editorLocked}
                maxLength={100}
                onChange={(event) => setName(event.target.value)}
                placeholder={text("Например, Кадровик предприятия", "For example, Enterprise HR specialist")}
                value={name}
              />
            </label>
            <label className="grid gap-2">
              <span className="app-text text-sm font-black">{text("Описание", "Description")}</span>
              <Textarea
                disabled={editorLocked}
                onChange={(event) => setDescription(event.target.value)}
                placeholder={text("За что отвечает эта роль", "What this role is responsible for")}
                value={description}
              />
            </label>
          </div>
        </div>

        <aside className="app-surface app-border rounded-[28px] border p-6">
          <p className="app-text font-black">{text("Итог доступа", "Access summary")}</p>
          <p className="app-muted mt-2 text-sm leading-6">
            {text("Выбрано разрешений:", "Selected permissions:")} <span className="app-text font-black">{permissionCodes.length}</span>
          </p>
          <p className="app-muted mt-3 text-xs leading-5">
            {text("Зависимые разрешения добавляются автоматически. В списке доступны только действия, которые можно безопасно делегировать в вашей области.", "Dependent permissions are added automatically. Only actions that can be safely delegated within your scope are available.")}
          </p>
          {isDirty && (
            <p className="mt-4 text-xs font-black text-amber-800 dark:text-amber-300">
              {text("Есть несохранённые изменения", "There are unsaved changes")}
            </p>
          )}
        </aside>
      </section>

      <section className="app-surface app-border rounded-[28px] border p-5">
        <div className="relative max-w-xl">
          <FiSearch className="app-muted pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2" />
          <Input
            aria-label={text("Поиск разрешений", "Search permissions")}
            className="pl-10"
            onChange={(event) => setSearch(event.target.value)}
            placeholder={text("Поиск по действию, модулю или описанию", "Search by action, module, or description")}
            value={search}
          />
        </div>
      </section>

      <div className="space-y-4">
        {visibleGroups.map(([module, items]) => (
          <section className="app-surface app-border overflow-hidden rounded-[26px] border" key={module}>
            <header className="app-surface-muted app-border-soft flex items-center justify-between border-b px-5 py-4">
              <div>
                <p className="app-text font-black">{permissionModuleTitle(module, items, text)}</p>
                <p className="app-muted mt-1 text-xs">
                  {text(
                    `${items.filter((permission) => permissionCodes.includes(permission.code)).length} из ${items.length} выбрано`,
                    `${items.filter((permission) => permissionCodes.includes(permission.code)).length} of ${items.length} selected`,
                  )}
                </p>
              </div>
            </header>
            <div className="divide-y divide-[var(--app-border-soft)]">
              {items.map((permission) => {
                const checked = permissionCodes.includes(permission.code);
                const risk = getPermissionRiskLevel(permission.code);
                return (
                  <div
                    className="flex items-center justify-between gap-5 px-5 py-4"
                    key={permission.code}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="app-text text-sm font-black">{accessPermissionName(permission, text)}</p>
                        {risk && (
                          <span
                            className={[
                              "app-risk-badge inline-flex items-center gap-1 rounded-full border px-2 py-0.5",
                              risk === "critical"
                                ? "app-risk-badge--critical"
                                : "app-risk-badge--elevated",
                            ].join(" ")}
                          >
                            <FiAlertTriangle className="h-3 w-3" />
                            {risk === "critical" ? text("Критичное", "Critical") : text("Повышенное", "Elevated")}
                          </span>
                        )}
                      </div>
                      <p className="app-meta mt-1 text-xs font-medium leading-5">
                        {accessPermissionDescription(permission, text)}
                      </p>
                      <p className="app-permission-code mt-1 font-mono">{permission.code}</p>
                    </div>
                    <Toggle
                      ariaLabel={text(`Разрешение ${permission.name}`, `Permission ${accessPermissionName(permission, text)}`)}
                      checked={checked}
                      disabled={editorLocked}
                      onCheckedChange={(nextChecked) =>
                        togglePermission(permission.code, nextChecked)
                      }
                    />
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {visibleGroups.length === 0 && (
        <section className="app-surface app-border overflow-hidden rounded-[26px] border">
          <EmptyState
            description={text("Попробуйте изменить поисковый запрос.", "Try changing the search query.")}
            title={text("Разрешения не найдены", "No permissions found")}
          />
        </section>
      )}

      <ConfirmDialog
        cancelLabel={text("Отмена", "Cancel")}
        confirmLabel={text("Добавить разрешение", "Add permission")}
        description={text("Это действие относится к критичным. Оно всё равно останется ограничено вашим предприятием или отделом.", "This is a critical action. It will still remain limited to your enterprise or department.")}
        onConfirm={() => {
          if (pendingCriticalCode) addPermission(pendingCriticalCode);
          setPendingCriticalCode(null);
        }}
        onOpenChange={(open) => !open && setPendingCriticalCode(null)}
        open={Boolean(pendingCriticalCode)}
        title={text("Добавить критичное разрешение?", "Add critical permission?")}
      />

      <ConfirmDialog
        cancelLabel={text("Отмена", "Cancel")}
        confirmLabel={text("Отключить разрешения", "Disable permissions")}
        description={
          pendingRemovalCode
            ? text(
                `Это разрешение требуется для: ${getDependentPermissionCodes(
                  permissionCodes,
                  pendingRemovalCode,
                )
                  .map((dependent) => {
                    const permission = permissionMap.get(dependent);
                    return permission ? accessPermissionName(permission, text) : dependent;
                  })
                  .join(", ")}. Оно будет отключено вместе с зависимыми действиями.`,
                `This permission is required by: ${getDependentPermissionCodes(
                  permissionCodes,
                  pendingRemovalCode,
                )
                  .map((dependent) => {
                    const permission = permissionMap.get(dependent);
                    return permission ? accessPermissionName(permission, text) : dependent;
                  })
                  .join(", ")}. It will be disabled together with dependent actions.`,
              )
            : ""
        }
        onConfirm={() => {
          if (pendingRemovalCode) removePermission(pendingRemovalCode);
          setPendingRemovalCode(null);
        }}
        onOpenChange={(open) => !open && setPendingRemovalCode(null)}
        open={Boolean(pendingRemovalCode)}
        title={text("Отключить зависимые разрешения?", "Disable dependent permissions?")}
      />

      <ConfirmDialog
        cancelLabel={text("Остаться", "Stay")}
        confirmLabel={text("Покинуть страницу", "Leave page")}
        description={text("Есть несохранённые изменения роли. Если покинуть страницу сейчас, они будут потеряны.", "There are unsaved role changes. If you leave now, they will be lost.")}
        onConfirm={() => {
          setLeaveConfirmationOpen(false);
          navigateToRoleList();
        }}
        onOpenChange={setLeaveConfirmationOpen}
        open={leaveConfirmationOpen}
        title={text("Покинуть страницу без сохранения?", "Leave without saving?")}
      />
    </div>
  );
}


function permissionModuleTitle(
  module: string,
  items: AccessPermission[],
  text: (ru: string, en: string) => string,
): string {
  const section = rolePermissionSections.find((candidate) =>
    candidate.permissionCodes.some((code) =>
      items.some((permission) => permission.code === code),
    ),
  );
  return section ? rolePermissionSectionTitle(section, text) : module;
}

function serializeDraft(
  name: string,
  description: string,
  permissionCodes: string[],
): string {
  return JSON.stringify({
    name: name.trim(),
    description: description.trim(),
    permissionCodes: [...new Set(permissionCodes)].sort(),
  });
}

function getDisplayedScope(
  scopeType: AccessScopeType | undefined,
  role: AccessRoleSummary | null,
  enterpriseName: string,
  departmentName: string,
  text: (ru: string, en: string) => string,
): { type: AccessScopeType; label: string } {
  if (scopeType === "department") {
    return {
      type: "department",
      label: text(
        `Отдел «${role?.departmentName || departmentName || "не указан"}»`,
        `Department “${role?.departmentName || departmentName || "not specified"}”`,
      ),
    };
  }
  if (scopeType === "enterprise") {
    return {
      type: "enterprise",
      label: text(
        `Предприятие «${role?.enterpriseName || enterpriseName || "не указано"}»`,
        `Enterprise “${role?.enterpriseName || enterpriseName || "not specified"}”`,
      ),
    };
  }
  return { type: "global", label: text("Вся система", "Entire system") };
}
