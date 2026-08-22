import * as RadixSwitch from "@radix-ui/react-switch";
import { useEffect, useMemo, useState } from "react";
import {
  FiArrowLeft,
  FiCheckCircle,
  FiSave,
  FiShield,
  FiSliders,
} from "react-icons/fi";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";

import { hrApiClient } from "../../shared/lib/hrApiClient";
import type {
  AccessControlOverview,
  AccessPermission,
  AccessScopeType,
  SaveAccessRoleParams,
} from "../../shared/types/access";
import {
  Button,
  EmptyState,
  Input,
  LoadingState,
  PageHeader,
  Select,
  Textarea,
} from "../../shared/ui";
import { getErrorMessage, scopeOptions } from "./accessControlData";
import {
  legacyPermissionCodes,
  rolePermissionSections,
  type RolePermissionSectionDefinition,
} from "./rolePermissionSections";

const emptyOverview: AccessControlOverview = {
  permissions: [],
  roles: [],
  users: [],
  systemAdmin: {
    id: 1,
    username: "superadmin",
    mustChangePassword: false,
    lastLoginAt: null,
    createdAt: "",
    updatedAt: "",
  },
};

export function AccessRoleFormPage(): JSX.Element {
  const navigate = useNavigate();
  const params = useParams();
  const roleId = params.id ? Number(params.id) : null;
  const isEditMode = roleId !== null;
  const [overview, setOverview] = useState<AccessControlOverview>(emptyOverview);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [scopeType, setScopeType] = useState<AccessScopeType>("self");
  const [permissionCodes, setPermissionCodes] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    async function load(): Promise<void> {
      setIsLoading(true);
      try {
        const data = await hrApiClient.getAccessOverview();
        if (!active) return;
        setOverview(data);
        if (isEditMode) {
          const role = data.roles.find((item) => item.id === roleId);
          if (!role) return;
          setName(role.name);
          setDescription(role.description);
          setScopeType(role.scopeType);
          setPermissionCodes(
            role.permissionCodes.filter((code) => !legacyPermissionCodes.has(code)),
          );
        }
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
    ? overview.roles.find((item) => item.id === roleId) ?? null
    : null;
  const permissionMap = useMemo(
    () => new Map(overview.permissions.map((permission) => [permission.code, permission])),
    [overview.permissions],
  );
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
  const selectedCount = permissionCodes.filter((code) => permissionMap.has(code)).length;
  const enabledSections = visibleSections.filter((section) =>
    section.permissions.some((permission) => permissionCodes.includes(permission.code)),
  ).length;

  function togglePermission(
    section: RolePermissionSectionDefinition,
    code: string,
    checked: boolean,
  ): void {
    setPermissionCodes((current) => {
      const next = new Set(current);
      const sectionCodes = section.permissionCodes.filter((permissionCode) =>
        permissionMap.has(permissionCode),
      );
      const viewCode = sectionCodes.find((permissionCode) =>
        permissionCode.endsWith(".view"),
      );

      if (checked) {
        next.add(code);
        if (viewCode && code !== viewCode) next.add(viewCode);
      } else if (code === viewCode) {
        sectionCodes.forEach((permissionCode) => next.delete(permissionCode));
      } else {
        next.delete(code);
      }
      return [...next];
    });
  }

  function toggleSection(
    section: RolePermissionSectionDefinition,
    checked: boolean,
  ): void {
    setPermissionCodes((current) => {
      const next = new Set(current);
      section.permissionCodes
        .filter((code) => permissionMap.has(code))
        .forEach((code) => (checked ? next.add(code) : next.delete(code)));
      return [...next];
    });
  }

  async function saveRole(): Promise<void> {
    if (!name.trim()) {
      toast.error("Укажите название роли");
      return;
    }
    setIsSaving(true);
    try {
      const params: SaveAccessRoleParams = {
        id: roleId ?? undefined,
        name: name.trim(),
        description: description.trim(),
        scopeType,
        permissionCodes: permissionCodes.filter((code) => permissionMap.has(code)),
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

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <div className="flex flex-wrap gap-3">
            <Button
              className="border-white/20 bg-white/10 text-white"
              leftIcon={<FiArrowLeft className="h-4 w-4" />}
              onClick={() => navigate(isEditMode && roleId ? `/roles/${roleId}` : "/roles")}
              variant="ghost"
            >
              Назад
            </Button>
            <Button
              className="border-white/20 shadow-xl hover:opacity-90"
              disabled={isSaving}
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

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="app-surface app-border rounded-[28px] border p-6">
          <div className="grid gap-5 lg:grid-cols-2">
            <label className="grid gap-2">
              <span className="app-text text-sm font-black">Название роли</span>
              <Input
                onChange={(event) => setName(event.target.value)}
                placeholder="Например, HR-менеджер"
                value={name}
              />
            </label>
            <label className="grid gap-2">
              <span className="app-text text-sm font-black">Область данных</span>
              <Select
                onValueChange={(value) => setScopeType(value as AccessScopeType)}
                options={scopeOptions}
                value={scopeType}
              />
            </label>
            <label className="grid gap-2 lg:col-span-2">
              <span className="app-text text-sm font-black">Описание</span>
              <Textarea
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
              <p className="app-muted mt-1 text-xs">Обновляется сразу при переключении</p>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <SummaryValue label="Разрешений" value={selectedCount} />
            <SummaryValue label="Разделов" value={enabledSections} />
          </div>
          <p className="app-muted mt-4 text-xs leading-5">
            При включении действия автоматически включается просмотр соответствующего раздела. Если отключить просмотр, остальные действия раздела также отключатся.
          </p>
        </aside>
      </section>

      {["Основное", "Администрирование", "Профиль и настройки"].map((group) => {
        const sections = visibleSections.filter((section) => section.group === group);
        return (
          <section className="space-y-4" key={group}>
            <div className="px-1">
              <p className="app-accent-text text-xs font-black uppercase tracking-[0.16em]">{group}</p>
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              {sections.map((section) => {
                const availableCodes = section.permissionCodes.filter((code) => permissionMap.has(code));
                const activeCount = availableCodes.filter((code) => permissionCodes.includes(code)).length;
                const allEnabled = availableCodes.length > 0 && activeCount === availableCodes.length;
                return (
                  <article className="app-surface app-border overflow-hidden rounded-[28px] border" key={section.key}>
                    <header className="app-surface-muted app-border-soft flex items-center justify-between gap-4 border-b p-5">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="app-text text-lg font-black">{section.title}</h2>
                          <span className="app-muted text-xs font-bold">{activeCount}/{availableCodes.length}</span>
                        </div>
                        <p className="app-muted mt-1 text-sm leading-5">{section.description}</p>
                      </div>
                      <PermissionSwitch
                        checked={allEnabled}
                        label={`Все разрешения раздела «${section.title}»`}
                        onCheckedChange={(checked) => toggleSection(section, checked)}
                      />
                    </header>
                    <div className="divide-y divide-[var(--color-border-soft)]">
                      {section.permissions.map((permission) => (
                        <div className="flex items-center justify-between gap-5 px-5 py-4" key={permission.code}>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="app-text text-sm font-black">{permission.name}</p>
                              {permissionCodes.includes(permission.code) && (
                                <FiCheckCircle className="h-4 w-4 shrink-0 text-emerald-500" />
                              )}
                            </div>
                            <p className="app-muted mt-1 text-xs leading-5">{permission.description}</p>
                            <code className="app-muted mt-2 block truncate text-[10px] font-bold">{permission.code}</code>
                          </div>
                          <PermissionSwitch
                            checked={permissionCodes.includes(permission.code)}
                            label={permission.name}
                            onCheckedChange={(checked) =>
                              togglePermission(section, permission.code, checked)
                            }
                          />
                        </div>
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function PermissionSwitch({
  checked,
  label,
  onCheckedChange,
}: {
  checked: boolean;
  label: string;
  onCheckedChange: (checked: boolean) => void;
}): JSX.Element {
  return (
    <RadixSwitch.Root
      aria-label={label}
      checked={checked}
      className="relative h-7 w-12 shrink-0 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-hover)] shadow-inner outline-none transition data-[state=checked]:border-[var(--accent-border)] data-[state=checked]:bg-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent-border)] focus-visible:ring-offset-2"
      onCheckedChange={onCheckedChange}
    >
      <RadixSwitch.Thumb className="block h-5 w-5 translate-x-1 rounded-full bg-white shadow-md transition-transform duration-200 data-[state=checked]:translate-x-6" />
    </RadixSwitch.Root>
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