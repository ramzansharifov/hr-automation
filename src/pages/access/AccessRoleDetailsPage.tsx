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

import { useAuth } from "../../features/auth/AuthContext";
import { legacyPermissionCodes } from "../../shared/access/permissionRules";
import { hrApiClient } from "../../shared/lib/hrApiClient";
import type {
  AccessPermission,
  AccessRoleSummary,
  AccessUserSummary,
  SystemAdminSummary,
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
  StatusBadge,
  getErrorMessage,
} from "./AccessControlShared";
import { groupPermissions } from "./accessControlData";

export function AccessRoleDetailsPage(): JSX.Element {
  const navigate = useNavigate();
  const params = useParams();
  const roleId = Number(params.id);
  const { hasPermission } = useAuth();
  const canEdit = hasPermission("roles.edit");
  const canDelete = hasPermission("roles.delete");
  const canViewUsers = hasPermission("users.view");
  const [roles, setRoles] = useState<AccessRoleSummary[]>([]);
  const [permissions, setPermissions] = useState<AccessPermission[]>([]);
  const [users, setUsers] = useState<AccessUserSummary[]>([]);
  const [systemAdmin, setSystemAdmin] = useState<SystemAdminSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [permissionSearch, setPermissionSearch] = useState("");
  const [deleteRole, setDeleteRole] = useState<AccessRoleSummary | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [roleData, permissionData] = await Promise.all([
        hrApiClient.listAccessRoles(),
        hrApiClient.listAccessPermissions(),
      ]);
      setRoles(roleData);
      setPermissions(permissionData);

      if (canViewUsers) {
        const [userData, adminData] = await Promise.all([
          hrApiClient.listAccessUsers(),
          hrApiClient.getAccessSystemAdmin(),
        ]);
        setUsers(userData);
        setSystemAdmin(adminData);
      } else {
        setUsers([]);
        setSystemAdmin(null);
      }
    } catch (error) {
      toast.error(getErrorMessage(error, "Не удалось загрузить роль"));
    } finally {
      setIsLoading(false);
    }
  }, [canViewUsers]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const role = useMemo(
    () => roles.find((item) => item.id === roleId) ?? null,
    [roleId, roles],
  );

  const rolePermissions = useMemo(() => {
    const permissionCodes = new Set(
      (role?.permissionCodes ?? []).filter((code) => !legacyPermissionCodes.has(code)),
    );
    return permissions.filter(
      (permission) =>
        permissionCodes.has(permission.code) &&
        !legacyPermissionCodes.has(permission.code),
    );
  }, [permissions, role]);

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
      canViewUsers
        ? users.filter((user) =>
            user.roles.some((assignedRole) => assignedRole.id === role?.id),
          )
        : [],
    [canViewUsers, role?.id, users],
  );

  const includesSystemAdmin = role?.systemKey === "superadmin";
  const modulesCount = new Set(rolePermissions.map((permission) => permission.module)).size;

  async function confirmDeleteRole(): Promise<void> {
    if (!deleteRole || !canDelete) return;
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

  if (isLoading) return <LoadingState label="Загрузка роли..." />;

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
            {!role.isSystem && canEdit && (
              <Button
                className="border-white/20 shadow-xl hover:opacity-90"
                leftIcon={<FiEdit2 className="h-4 w-4" />}
                onClick={() => navigate(`/roles/${role.id}/edit`)}
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
              {role.code}
            </span>
          </div>
        }
        title={role.name}
      />

      <section className="grid gap-4 md:grid-cols-3">
        <AccessMetric icon={<FiCheckCircle />} label="Разрешения" value={rolePermissions.length} />
        <AccessMetric icon={<FiUsers />} label="Пользователи" value={role.userCount} />
        <AccessMetric icon={<FiLayers />} label="Разделы" value={modulesCount} />
      </section>

      <section className="app-surface app-border overflow-hidden rounded-[28px] border">
        <div className="app-border-soft flex flex-col gap-4 border-b p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="app-text text-lg font-black">Разрешения роли</h2>
            <p className="app-muted mt-1 text-sm">
              Все доступные действия, сгруппированные по разделам приложения.
            </p>
          </div>
          <div className="relative w-full sm:max-w-sm">
            <FiSearch className="app-muted pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2" />
            <Input
              aria-label="Поиск разрешений"
              className="pl-10"
              onChange={(event) => setPermissionSearch(event.target.value)}
              placeholder="Поиск по названию, коду или разделу"
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
          <EmptyState description="Попробуйте изменить поисковый запрос." title="Ничего не найдено" />
        ) : (
          <div className="space-y-4 p-5">
            {permissionGroups.map(([module, groupedPermissions]) => (
              <section className="app-surface-muted app-border rounded-2xl border p-4 sm:p-5" key={module}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="app-text font-black">{module}</p>
                    <p className="app-muted mt-1 text-xs">Разрешений: {groupedPermissions.length}</p>
                  </div>
                  <span className="app-accent-soft app-accent-text flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border">
                    <FiShield className="h-4 w-4" />
                  </span>
                </div>
                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  {groupedPermissions.map((permission) => (
                    <article className="app-surface app-border flex items-start gap-3 rounded-2xl border p-4" key={permission.code}>
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
              {canViewUsers
                ? "Учётные записи, которым роль назначена напрямую или системой."
                : "Список учётных записей защищён отдельным разрешением users.view."}
            </p>
          </div>
          {canViewUsers && (
            <Button leftIcon={<FiUsers className="h-4 w-4" />} onClick={() => navigate("/users")} variant="secondary">
              Открыть пользователей
            </Button>
          )}
        </div>

        {!canViewUsers ? (
          <EmptyState
            description="Количество назначений видно в сводке роли, но имена и логины пользователей доступны только с разрешением «Просмотр пользователей»."
            title="Нет доступа к учётным записям"
          />
        ) : !includesSystemAdmin && assignedUsers.length === 0 ? (
          <EmptyState
            description="Эта роль пока не назначена ни одной учётной записи."
            title="Пользователей нет"
          />
        ) : (
          <div className="grid gap-3 p-5 lg:grid-cols-2">
            {includesSystemAdmin && systemAdmin && (
              <article className="app-surface-muted app-border flex items-center gap-4 rounded-2xl border p-4">
                <span className="app-accent-soft flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border">
                  <FiShield className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="app-text font-black">Системный администратор</p>
                    <span className="app-accent-soft app-accent-text rounded-full px-2 py-0.5 text-[10px] font-black">Встроенная</span>
                  </div>
                  <p className="app-muted mt-1 text-xs">@{systemAdmin.username}</p>
                </div>
              </article>
            )}
            {assignedUsers.map((user) => (
              <article className="app-surface-muted app-border flex items-center gap-4 rounded-2xl border p-4" key={user.id}>
                <span className="app-accent-soft flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border">
                  <FiUser className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="app-text truncate font-black">{user.employeeName}</p>
                    <StatusBadge status={user.status} />
                  </div>
                  <p className="app-accent-text mt-1 truncate text-xs font-black">@{user.username}</p>
                  <p className="app-muted mt-1 truncate text-xs">
                    {[user.enterpriseName, user.departmentName].filter(Boolean).join(" · ") || "Оргструктура не указана"}
                  </p>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {!role.isSystem && canDelete && (
        <section className="app-surface app-border flex flex-col gap-4 rounded-[28px] border p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="app-text font-black">Удаление роли</p>
            <p className="app-muted mt-1 text-sm">Роль можно удалить после снятия со всех пользователей.</p>
          </div>
          <Button leftIcon={<FiTrash2 className="h-4 w-4" />} onClick={() => setDeleteRole(role)} variant="danger">
            Удалить роль
          </Button>
        </section>
      )}

      {canDelete && (
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
      )}
    </div>
  );
}
