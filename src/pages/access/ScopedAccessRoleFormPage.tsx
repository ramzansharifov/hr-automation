import { useEffect, useMemo, useState } from "react";
import {
  FiAlertTriangle,
  FiArrowLeft,
  FiBriefcase,
  FiLayers,
  FiLock,
  FiSave,
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
import { hrApiClient } from "../../shared/lib/hrApiClient";
import type {
  AccessPermission,
  AccessRoleSummary,
  AccessScopeType,
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
  Toggle,
} from "../../shared/ui";
import { getErrorMessage, groupPermissions } from "./accessControlData";

export function ScopedAccessRoleFormPage(): JSX.Element {
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
        toast.error(getErrorMessage(error, "Не удалось загрузить конструктор роли"));
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
            permission.name,
            permission.description,
            permission.code,
            permission.module,
          ]
            .join(" ")
            .toLocaleLowerCase()
            .includes(query);
        }),
      ] as const)
      .filter(([, items]) => items.length > 0);
  }, [permissions, search]);

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
        const labels = dependents
          .map((dependent) => permissionMap.get(dependent)?.name ?? dependent)
          .join(", ");
        if (
          !window.confirm(
            `Это разрешение требуется для: ${labels}. Отключить его вместе с зависимыми действиями?`,
          )
        ) {
          return;
        }
      }
      removePermission(code);
      return;
    }
    addPermission(code);
  }

  function navigateBack(): void {
    if (
      isDirty &&
      !window.confirm("Есть несохранённые изменения роли. Покинуть страницу?")
    ) {
      return;
    }
    navigate(isEditMode && roleId ? `/roles/${roleId}` : "/roles");
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
      toast.success(isEditMode ? "Роль обновлена" : "Роль создана");
      navigate(`/roles/${saved.id}`);
    } catch (error) {
      toast.error(getErrorMessage(error, "Не удалось сохранить роль"));
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) return <LoadingState label="Загрузка конструктора роли..." />;

  if (isEditMode && (!role || !Number.isInteger(roleId) || Number(roleId) < 1)) {
    return (
      <section className="app-surface app-border overflow-hidden rounded-[28px] border">
        <EmptyState
          description="Роль не существует или находится вне вашей области администрирования."
          title="Роль недоступна"
        />
      </section>
    );
  }

  if (role?.isSystem) {
    return (
      <section className="app-surface app-border overflow-hidden rounded-[28px] border">
        <EmptyState
          description="Системные роли защищены от изменения."
          title="Системную роль нельзя редактировать"
        />
      </section>
    );
  }

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
        description="Разрешения этой роли будут действовать только внутри указанной организационной области. Область задаётся вашим уровнем администрирования и не выбирается вручную."
        eyebrow="Локальный конструктор доступа"
        icon={<FiShield />}
        title={isEditMode ? `Редактирование · ${role?.name ?? "Роль"}` : "Новая роль"}
      />

      <section className="app-surface app-border flex flex-col gap-4 rounded-[24px] border p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="app-accent-soft flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border">
            {scope.type === "department" ? <FiBriefcase /> : <FiLayers />}
          </span>
          <div>
            <p className="app-text text-sm font-black">Область действия роли</p>
            <p className="app-text-soft mt-1 text-sm font-semibold">{scope.label}</p>
          </div>
        </div>
        <span className="app-surface-muted app-border rounded-full border px-3 py-1.5 text-xs font-black">
          Фиксированная область
        </span>
      </section>

      {editorLocked && (
        <section className="rounded-[24px] border border-amber-300/60 bg-amber-50/80 p-5 text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/30 dark:text-amber-100">
          <div className="flex items-start gap-3">
            <FiLock className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-black">Роль содержит недоступные вам разрешения</p>
              <p className="mt-1 text-sm leading-6 opacity-85">
                Сохранение заблокировано, чтобы локальный администратор не мог перераспределить доступ выше собственного уровня.
              </p>
            </div>
          </div>
        </section>
      )}

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="app-surface app-border rounded-[28px] border p-6">
          <div className="grid gap-5">
            <label className="grid gap-2">
              <span className="app-text text-sm font-black">Название роли</span>
              <Input
                disabled={editorLocked}
                maxLength={100}
                onChange={(event) => setName(event.target.value)}
                placeholder="Например, Кадровик предприятия"
                value={name}
              />
            </label>
            <label className="grid gap-2">
              <span className="app-text text-sm font-black">Описание</span>
              <Textarea
                disabled={editorLocked}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="За что отвечает эта роль"
                value={description}
              />
            </label>
          </div>
        </div>

        <aside className="app-surface app-border rounded-[28px] border p-6">
          <p className="app-text font-black">Итог доступа</p>
          <p className="app-muted mt-2 text-sm leading-6">
            Выбрано разрешений: <span className="app-text font-black">{permissionCodes.length}</span>
          </p>
          <p className="app-muted mt-3 text-xs leading-5">
            Зависимые разрешения добавляются автоматически. В списке доступны только действия, которые можно безопасно делегировать в вашей области.
          </p>
          {isDirty && (
            <p className="mt-4 text-xs font-black text-amber-600 dark:text-amber-300">
              Есть несохранённые изменения
            </p>
          )}
        </aside>
      </section>

      <section className="app-surface app-border rounded-[28px] border p-5">
        <div className="relative max-w-xl">
          <FiSearch className="app-muted pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2" />
          <Input
            aria-label="Поиск разрешений"
            className="pl-10"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Поиск по действию, модулю или описанию"
            value={search}
          />
        </div>
      </section>

      <div className="space-y-4">
        {visibleGroups.map(([module, items]) => (
          <section className="app-surface app-border overflow-hidden rounded-[26px] border" key={module}>
            <header className="app-surface-muted app-border-soft flex items-center justify-between border-b px-5 py-4">
              <div>
                <p className="app-text font-black">{module}</p>
                <p className="app-muted mt-1 text-xs">
                  {items.filter((permission) => permissionCodes.includes(permission.code)).length} из {items.length} выбрано
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
                        <p className="app-text text-sm font-black">{permission.name}</p>
                        {risk && (
                          <span
                            className={[
                              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-black",
                              risk === "critical"
                                ? "border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300"
                                : "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
                            ].join(" ")}
                          >
                            <FiAlertTriangle className="h-3 w-3" />
                            {risk === "critical" ? "Критичное" : "Повышенное"}
                          </span>
                        )}
                      </div>
                      <p className="app-muted mt-1 text-xs leading-5">
                        {permission.description}
                      </p>
                      <p className="app-muted mt-1 font-mono text-[10px]">{permission.code}</p>
                    </div>
                    <Toggle
                      ariaLabel={`Разрешение ${permission.name}`}
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
            description="Попробуйте изменить поисковый запрос."
            title="Разрешения не найдены"
          />
        </section>
      )}

      <ConfirmDialog
        cancelLabel="Отмена"
        confirmLabel="Добавить разрешение"
        description="Это действие относится к критичным. Оно всё равно останется ограничено вашим предприятием или отделом."
        onConfirm={() => {
          if (pendingCriticalCode) addPermission(pendingCriticalCode);
          setPendingCriticalCode(null);
        }}
        onOpenChange={(open) => !open && setPendingCriticalCode(null)}
        open={Boolean(pendingCriticalCode)}
        title="Добавить критичное разрешение?"
      />
    </div>
  );
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
): { type: AccessScopeType; label: string } {
  if (scopeType === "department") {
    return {
      type: "department",
      label: `Отдел «${role?.departmentName || departmentName || "не указан"}»`,
    };
  }
  if (scopeType === "enterprise") {
    return {
      type: "enterprise",
      label: `Предприятие «${role?.enterpriseName || enterpriseName || "не указано"}»`,
    };
  }
  return { type: "global", label: "Вся система" };
}
