import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiArrowLeft,
  FiCheckCircle,
  FiEdit2,
  FiLayers,
  FiSearch,
  FiShield,
  FiTrash2,
  FiUser,
  FiUsers,
} from "react-icons/fi";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";

import { hrApiClient } from "../../shared/lib/hrApiClient";
import type {
  AccessControlOverview,
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
} from "../../shared/ui";
import {
  AccessMetric,
  RoleDialog,
  StatusBadge,
  getErrorMessage,
  scopeLabel,
  type RoleDraft,
} from "./AccessControlShared";
import { groupPermissions } from "./accessControlData";

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

export function AccessRoleDetailsPage(): JSX.Element {
  const navigate = useNavigate();
  const params = useParams();
  const roleId = Number(params.id);
  const [overview, setOverview] = useState<AccessControlOverview>(emptyOverview);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [permissionSearch, setPermissionSearch] = useState("");
  const [roleDraft, setRoleDraft] = useState<RoleDraft | null>(null);
  const [deleteRole, setDeleteRole] = useState<AccessRoleSummary | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      setOverview(await hrApiClient.getAccessOverview());
    } catch (error) {
      toast.error(getErrorMessage(error, "Не удалось загрузить роль"));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const role = useMemo(
    () => overview.roles.find((item) => item.id === roleId) ?? null,
    [overview.roles, roleId],
  );

  const rolePermissions = useMemo(() => {
    const permissionCodes = new Set(role?.permissionCodes ?? []);
    return overview.permissions.filter((permission) =>
      permissionCodes.has(permission.code),
    );
  }, [overview.permissions, role]);

  const filteredPermissions = useMemo(() => {
    const search = permissionSearch.trim().toLocaleLowerCase();
    if (!search) return rolePermissions;
    return rolePermissions.filter((permission) =>
      [permission.name, permission.code, permission.module, permission.description]
        .join(" ")
        .toLocaleLowerCase()
        .includes(search),
    );
  }, [permissionSearch, rolePermissions]);

  const permissionGroups = useMemo(
    () => groupPermissions(filteredPermissions),
    [filteredPermissions],
  );

  const assignedUsers = useMemo(
    () =>
      overview.users.filter((user) =>
        user.roles.some((assignedRole) => assignedRole.id === role?.id),
      ),
    [overview.users, role?.id],
  );

  const includesSystemAdmin = role?.systemKey === "superadmin";
  const visibleUserCount = assignedUsers.length + (includesSystemAdmin ? 1 : 0);
  const modulesCount = new Set(rolePermissions.map((permission) => permission.module)).size;

  function openEditRole(): void {
    if (!role || role.isSystem) return;
    setRoleDraft({
      id: role.id,
      name: role.name,
      description: role.description,
      scopeType: role.scopeType,
      permissionCodes: role.permissionCodes,
    });
  }

  async function saveRole(): Promise<void> {
    if (!roleDraft) return;
    setIsSaving(true);
    try {
      const params: SaveAccessRoleParams = {
        id: roleDraft.id,
        name: roleDraft.name,
        description: roleDraft.description,
        scopeType: roleDraft.scopeType,
        permissionCodes: roleDraft.permissionCodes,
      };
      await hrApiClient.saveAccessRole(params);
      toast.success("Роль обновлена");
      setRoleDraft(null);
      await loadData();
    } catch (error) {
      toast.error(getErrorMessage(error, "Не удалось сохранить роль"));
    } finally {
      setIsSaving(false);
    }
  }

  async function confirmDeleteRole(): Promise<void> {
    if (!deleteRole) return;
    setIsSaving(true);
    try {
      await hrApiClient.deleteAccessRole(deleteRole.id);
      toast.success("Роль удалена");
      setDeleteRole(null);
      navigate("/roles");
    } catch (error) {
      toast.error(getErrorMessage(error, "Не удалось удалить роль"));
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return <LoadingState label="Загрузка роли..." />;
  }

  if (!Number.isInteger(roleId) || roleId < 1 || !role) {
    return (
      <div className="space-y-6">
        <PageHeader
          actions={
            <Button
              className="border-white/20 bg-white/10 text-white"
              leftIcon={<FiArrowLeft className="h-4 w-4" />}
              onClick={() => navigate("/roles")}
              variant="ghost"
            >
              К ролям
            </Button>
          }
          description="Запрошенная роль не существует или была удалена."
          icon={<FiShield />}
          title="Роль не найдена"
        />
        <section className="app-surface app-border overflow-hidden rounded-[28px] border">
          <EmptyState
            description="Вернитесь к списку ролей и выберите существующую запись."
            title="Нет данных для отображения"
          />
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <>
            <Button
              className="border-white/20 bg-white/10 text-white"
              leftIcon={<FiArrowLeft className="h-4 w-4" />}
              onClick={() => navigate("/roles")}
              variant="ghost"
            >
              Все роли
            </Button>
            {!role.isSystem && (
              <Button
                className="border-white/20 shadow-xl hover:opacity-90"
                leftIcon={<FiEdit2 className="h-4 w-4" />}
                onClick={openEditRole}
                style={{ background: "#ffffff", color: "#0f172a" }}
                variant="ghost"
              >
                Редактировать
              </Button>
            )}
          </>
        }
        description={role.description || "Описание для этой роли пока не указано."}
        eyebrow="Роль доступа"
        icon={<FiShield />}
        meta={
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-black text-white/90">
              {role.isSystem ? "Системная роль" : "Пользовательская роль"}
            </span>
            <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-black text-white/90">
              {scopeLabel(role.scopeType)}
            </span>
            <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-black text-white/90">
              {role.code}
            </span>
          </div>
        }
        title={role.name}
      />

      <section className="grid gap-4 md:grid-cols-3">
        <AccessMetric
          icon={<FiCheckCircle />}
          label="Разрешения"
          value={rolePermissions.length}
        />
        <AccessMetric icon={<FiUsers />} label="Пользователи" value={visibleUserCount} />
        <AccessMetric icon={<FiLayers />} label="Модули" value={modulesCount} />
      </section>

      <section className="app-surface app-border overflow-hidden rounded-[28px] border">
        <div className="app-border-soft flex flex-col gap-4 border-b p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="app-text text-lg font-black">Разрешения роли</h2>
            <p className="app-muted mt-1 text-sm">
              Все действия, которые доступны пользователю благодаря этой роли.
            </p>
          </div>
          <div className="relative w-full sm:max-w-sm">
            <FiSearch className="app-muted pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2" />
            <Input
              aria-label="Поиск разрешений"
              className="pl-10"
              onChange={(event) => setPermissionSearch(event.target.value)}
              placeholder="Поиск по названию, коду или модулю"
              value={permissionSearch}
            />
          </div>
        </div>

        {rolePermissions.length === 0 ? (
          <EmptyState
            description="Эта роль не предоставляет отдельных разрешений."
            title="Разрешения не назначены"
          />
        ) : permissionGroups.length === 0 ? (
          <EmptyState
            description="Попробуйте изменить поисковый запрос."
            title="Ничего не найдено"
          />
        ) : (
          <div className="space-y-4 p-5">
            {permissionGroups.map(([module, permissions]) => (
              <section
                className="app-surface-muted app-border rounded-2xl border p-4 sm:p-5"
                key={module}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="app-text font-black">{module}</p>
                    <p className="app-muted mt-1 text-xs">
                      Разрешений в модуле: {permissions.length}
                    </p>
                  </div>
                  <span className="app-accent-soft app-accent-text flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border">
                    <FiShield className="h-4 w-4" />
                  </span>
                </div>

                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  {permissions.map((permission) => (
                    <article
                      className="app-surface app-border flex items-start gap-3 rounded-2xl border p-4"
                      key={permission.code}
                    >
                      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300">
                        <FiCheckCircle className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="app-text text-sm font-black">{permission.name}</p>
                        <p className="app-muted mt-1 text-xs leading-5">
                          {permission.description || "Описание разрешения не указано."}
                        </p>
                        <code className="app-surface-muted app-border app-text-soft mt-3 inline-flex max-w-full rounded-lg border px-2 py-1 text-[11px] font-bold">
                          {permission.code}
                        </code>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </section>

      <section className="app-surface app-border overflow-hidden rounded-[28px] border">
        <div className="app-border-soft flex flex-col gap-3 border-b p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="app-text text-lg font-black">Пользователи с этой ролью</h2>
            <p className="app-muted mt-1 text-sm">
              Учётные записи, которым роль назначена напрямую или системой.
            </p>
          </div>
          <Button
            leftIcon={<FiUsers className="h-4 w-4" />}
            onClick={() => navigate("/users")}
            variant="secondary"
          >
            Открыть пользователей
          </Button>
        </div>

        {!includesSystemAdmin && assignedUsers.length === 0 ? (
          <EmptyState
            description="Эта роль пока не назначена ни одной учётной записи."
            title="Пользователей нет"
          />
        ) : (
          <div className="grid gap-3 p-5 lg:grid-cols-2">
            {includesSystemAdmin && (
              <article className="app-surface-muted app-border flex items-center gap-4 rounded-2xl border p-4">
                <span className="app-accent-soft flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border">
                  <FiShield className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="app-text font-black">Системный администратор</p>
                    <span className="app-accent-soft app-accent-text rounded-full px-2 py-0.5 text-[10px] font-black">
                      Встроенная
                    </span>
                  </div>
                  <p className="app-muted mt-1 text-xs">@{overview.systemAdmin.username}</p>
                </div>
              </article>
            )}

            {assignedUsers.map((user) => (
              <article
                className="app-surface-muted app-border flex items-center gap-4 rounded-2xl border p-4"
                key={user.id}
              >
                <span className="app-accent-soft flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border">
                  <FiUser className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="app-text truncate font-black">{user.employeeName}</p>
                    <StatusBadge status={user.status} />
                  </div>
                  <p className="app-accent-text mt-1 truncate text-xs font-black">
                    @{user.username}
                  </p>
                  <p className="app-muted mt-1 truncate text-xs">
                    {[user.enterpriseName, user.departmentName]
                      .filter(Boolean)
                      .join(" · ") || "Оргструктура не указана"}
                  </p>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {!role.isSystem && (
        <section className="app-surface app-border flex flex-col gap-4 rounded-[28px] border p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="app-text font-black">Управление ролью</p>
            <p className="app-muted mt-1 text-sm">
              Пользовательскую роль можно изменить или удалить после снятия со всех пользователей.
            </p>
          </div>
          <Button
            leftIcon={<FiTrash2 className="h-4 w-4" />}
            onClick={() => setDeleteRole(role)}
            variant="danger"
          >
            Удалить роль
          </Button>
        </section>
      )}

      <RoleDialog
        draft={roleDraft ?? {
          name: "",
          description: "",
          scopeType: "self",
          permissionCodes: [],
        }}
        isSaving={isSaving}
        onChange={setRoleDraft}
        onOpenChange={(open) => !open && setRoleDraft(null)}
        onSave={() => void saveRole()}
        open={Boolean(roleDraft)}
        permissions={overview.permissions}
      />

      <ConfirmDialog
        cancelLabel="Отмена"
        confirmLabel="Удалить"
        description="Роль можно удалить только после того, как она снята со всех пользователей."
        isLoading={isSaving}
        onConfirm={() => void confirmDeleteRole()}
        onOpenChange={(open) => !open && setDeleteRole(null)}
        open={Boolean(deleteRole)}
        title={`Удалить роль «${deleteRole?.name ?? ""}»?`}
      />
    </div>
  );
}
