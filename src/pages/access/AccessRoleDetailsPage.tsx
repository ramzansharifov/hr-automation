import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiCheckCircle,
  FiLayers,
  FiSearch,
  FiShield,
  FiUser,
  FiUsers,
} from "react-icons/fi";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";

import { useAuth } from "../../features/auth/AuthContext";
import { legacyPermissionCodes } from "../../shared/access/permissionRules";
import { useAppText } from "../../shared/i18n";
import { hrApiClient } from "../../shared/lib/hrApiClient";
import type {
  AccessPermission,
  AccessRoleSummary,
  AccessUserSummary,
  SystemAdminSummary,
} from "../../shared/types/access";
import {
  ActionButton,
  DeleteConfirmDialog,
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
import { accessPermissionName, accessRoleName } from "./accessTranslations";

export function AccessRoleDetailsPage(): JSX.Element {
  const text = useAppText();
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
      toast.error(getErrorMessage(error, text("Не удалось загрузить роль", "Failed to load role")));
    } finally {
      setIsLoading(false);
    }
  }, [canViewUsers, text]);

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
      [permission.name, accessPermissionName(permission, text), permission.code, permission.module]
        .join(" ")
        .toLocaleLowerCase()
        .includes(search),
    );
  }, [permissionSearch, rolePermissions, text]);

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
    try {
      await hrApiClient.deleteAccessRole(deleteRole.id);
      toast.success(text("Роль удалена", "Role deleted"));
      setDeleteRole(null);
      navigate("/roles");
    } catch (error) {
      toast.error(getErrorMessage(error, text("Не удалось удалить роль", "Failed to delete role")));
    }
  }

  if (isLoading) return <LoadingState label={text("Загрузка роли...", "Loading role...")} />;

  if (!Number.isInteger(roleId) || roleId < 1 || !role) {
    return (
      <div className="space-y-6">
        <PageHeader
          actions={
            <ActionButton action="back" onClick={() => navigate("/roles")}>
              {text("К ролям", "Back to roles")}
            </ActionButton>
          }
          icon={<FiShield />}
          title={text("Роль не найдена", "Role not found")}
        />
        <section className="app-surface app-border overflow-hidden rounded-[28px] border">
          <EmptyState
            description={text("Вернитесь к списку ролей и выберите существующую запись.", "Return to the role list and select an existing record.")}
            title={text("Нет данных для отображения", "No data to display")}
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
            <ActionButton action="back" onClick={() => navigate("/roles")}>
              {text("Все роли", "All roles")}
            </ActionButton>
            {!role.isSystem && canEdit && (
              <ActionButton
                action="edit"
                onClick={() => navigate(`/roles/${role.id}/edit`)}
              >
                {text("Редактировать", "Edit")}
              </ActionButton>
            )}
          </>
        }
        eyebrow={text("Роль доступа", "Access role")}
        icon={<FiShield />}
        meta={
          <div className="flex flex-wrap gap-2">
            <span className="app-accent-soft rounded-full border px-3 py-1 text-xs font-black">
              {role.isSystem ? text("Системная роль", "System role") : text("Пользовательская роль", "Custom role")}
            </span>
            <span className="app-accent-soft rounded-full border px-3 py-1 text-xs font-black">
              {role.code}
            </span>
          </div>
        }
        title={accessRoleName(role.systemKey, role.name, text)}
      />

      <section className="grid gap-4 md:grid-cols-3">
        <AccessMetric icon={<FiCheckCircle />} label={text("Разрешения", "Permissions")} value={rolePermissions.length} />
        <AccessMetric icon={<FiUsers />} label={text("Пользователи", "Users")} value={role.userCount} />
        <AccessMetric icon={<FiLayers />} label={text("Разделы", "Modules")} value={modulesCount} />
      </section>

      <section className="app-surface app-border overflow-hidden rounded-[28px] border">
        <div className="app-border-soft flex flex-col gap-4 border-b p-5 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="app-text text-lg font-black">{text("Разрешения роли", "Role permissions")}</h2>
          <div className="relative w-full sm:max-w-sm">
            <FiSearch className="app-muted pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2" />
            <Input
              aria-label={text("Поиск разрешений", "Search permissions")}
              className="pl-10"
              onChange={(event) => setPermissionSearch(event.target.value)}
              placeholder={text("Поиск по названию, коду или разделу", "Search by name, code, or module")}
              value={permissionSearch}
            />
          </div>
        </div>

        {rolePermissions.length === 0 ? (
          <EmptyState
            description={text("Эта роль не предоставляет отдельных разрешений.", "This role does not grant individual permissions.")}
            title={text("Разрешения не назначены", "No permissions assigned")}
          />
        ) : permissionGroups.length === 0 ? (
          <EmptyState description={text("Попробуйте изменить поисковый запрос.", "Try changing the search query.")} title={text("Ничего не найдено", "Nothing found")} />
        ) : (
          <div className="space-y-4 p-5">
            {permissionGroups.map(([module, groupedPermissions]) => (
              <section className="app-surface-muted app-border rounded-2xl border p-4 sm:p-5" key={module}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="app-text font-black">{module}</p>
                    <p className="app-muted mt-1 text-xs">{text("Разрешений:", "Permissions:")} {groupedPermissions.length}</p>
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
                        <p className="app-text text-sm font-black">{accessPermissionName(permission, text)}</p>
                        <code className="app-permission-code app-surface-muted app-border mt-2 inline-flex max-w-full rounded-lg border px-2 py-1 font-mono">
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
          <h2 className="app-text text-lg font-black">{text("Пользователи с этой ролью", "Users with this role")}</h2>
          {canViewUsers && (
            <ActionButton action="open" onClick={() => navigate("/users")}>
              {text("Открыть пользователей", "Open users")}
            </ActionButton>
          )}
        </div>

        {!canViewUsers ? (
          <EmptyState
            description={text("Количество назначений видно в сводке роли, но имена и логины пользователей доступны только с разрешением «Просмотр пользователей».", "Assignment counts are visible in the role summary, but user names and usernames require the View users permission.")}
            title={text("Нет доступа к учётным записям", "No access to user accounts")}
          />
        ) : !includesSystemAdmin && assignedUsers.length === 0 ? (
          <EmptyState
            description={text("Эта роль пока не назначена ни одной учётной записи.", "This role is not assigned to any account yet.")}
            title={text("Пользователей нет", "No users")}
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
                    <p className="app-text font-black">{text("Системный администратор", "System administrator")}</p>
                    <span className="app-accent-soft app-accent-text rounded-full px-2 py-0.5 text-[11px] font-black">{text("Встроенная", "Built-in")}</span>
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
                    {[user.enterpriseName, user.departmentName].filter(Boolean).join(" · ") || text("Оргструктура не указана", "Organization structure not specified")}
                  </p>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {!role.isSystem && canDelete && (
        <section className="app-surface app-border flex items-center justify-between gap-4 rounded-[28px] border p-5">
          <p className="app-text font-black">{text("Удаление роли", "Delete role")}</p>
          <ActionButton action="delete" onClick={() => setDeleteRole(role)}>
            {text("Удалить роль", "Delete role")}
          </ActionButton>
        </section>
      )}

      {canDelete && (
        <DeleteConfirmDialog
          description={text("Роль можно удалить только после того, как она снята со всех пользователей.", "A role can only be deleted after it has been removed from all users.")}
          onConfirm={confirmDeleteRole}
          onOpenChange={(open) => !open && setDeleteRole(null)}
          open={Boolean(deleteRole)}
          title={text(`Удалить роль «${deleteRole?.name ?? ""}»?`, `Delete role “${deleteRole?.name ?? ""}”?`)}
        />
      )}
    </div>
  );
}
