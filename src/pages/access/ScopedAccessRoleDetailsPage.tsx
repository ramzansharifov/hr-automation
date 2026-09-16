import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiBriefcase,
  FiCheckCircle,
  FiLayers,
  FiSearch,
  FiShield,
  FiUsers,
} from "react-icons/fi";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";

import { useAuth } from "../../features/auth/AuthContext";
import { useAppText } from "../../shared/i18n";
import { hrApiClient } from "../../shared/lib/hrApiClient";
import type {
  AccessPermission,
  AccessRoleSummary,
  AccessUserSummary,
} from "../../shared/types/access";
import {
  ActionButton,
  DeleteConfirmDialog,
  EmptyState,
  Input,
  LoadingState,
  PageHeader,
} from "../../shared/ui";
import { AccessMetric, StatusBadge, getErrorMessage } from "./AccessControlShared";
import { groupPermissions } from "./accessControlData";
import { accessPermissionName, accessRoleName } from "./accessTranslations";

export function ScopedAccessRoleDetailsPage(): JSX.Element {
  const text = useAppText();
  const navigate = useNavigate();
  const params = useParams();
  const roleId = Number(params.id);
  const { hasPermission, session } = useAuth();
  const canEdit = hasPermission("roles.edit");
  const canDelete = hasPermission("roles.delete");
  const canViewUsers = hasPermission("users.view");
  const [roles, setRoles] = useState<AccessRoleSummary[]>([]);
  const [permissions, setPermissions] = useState<AccessPermission[]>([]);
  const [users, setUsers] = useState<AccessUserSummary[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [deleteRole, setDeleteRole] = useState<AccessRoleSummary | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [roleData, permissionData, userData] = await Promise.all([
        hrApiClient.listAccessRoles(),
        hrApiClient.listAccessPermissions(),
        canViewUsers ? hrApiClient.listAccessUsers() : Promise.resolve([]),
      ]);
      setRoles(roleData);
      setPermissions(permissionData);
      setUsers(userData);
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
    const codes = new Set(role?.permissionCodes ?? []);
    return permissions.filter((permission) => codes.has(permission.code));
  }, [permissions, role?.permissionCodes]);
  const filteredPermissions = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return rolePermissions;
    return rolePermissions.filter((permission) =>
      [permission.name, accessPermissionName(permission, text), permission.code, permission.module]
        .join(" ")
        .toLocaleLowerCase()
        .includes(query),
    );
  }, [rolePermissions, search, text]);
  const permissionGroups = useMemo(
    () => groupPermissions(filteredPermissions),
    [filteredPermissions],
  );
  const assignedUsers = useMemo(
    () =>
      users.filter((user) =>
        user.roles.some((assignedRole) => assignedRole.id === role?.id),
      ),
    [role?.id, users],
  );

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
      <section className="app-surface app-border overflow-hidden rounded-[28px] border">
        <EmptyState
          description={text("Роль не существует или находится вне вашей области администрирования.", "The role does not exist or is outside your administrative scope.")}
          title={text("Роль недоступна", "Role unavailable")}
        />
      </section>
    );
  }

  const scopeLabel = getRoleScopeLabel(role, session.enterpriseName, session.departmentName, text);
  const canModifyRole = !role.isSystem;

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <div className="flex flex-wrap gap-3">
            <ActionButton action="back" onClick={() => navigate("/roles")}>
              {text("К ролям", "Back to roles")}
            </ActionButton>
            {canModifyRole && canEdit && (
              <ActionButton
                action="edit"
                onClick={() => navigate(`/roles/${role.id}/edit`)}
              >
                {text("Редактировать", "Edit")}
              </ActionButton>
            )}
            {canModifyRole && canDelete && (
              <ActionButton
                action="delete"
                onClick={() => setDeleteRole(role)}
              >
                {text("Удалить роль", "Delete role")}
              </ActionButton>
            )}
          </div>
        }
        eyebrow={role.isSystem ? text("Системная роль", "System role") : text("Пользовательская роль", "Custom role")}
        icon={<FiShield />}
        title={accessRoleName(role.systemKey, role.name, text)}
      />

      <section className="grid gap-4 sm:grid-cols-3">
        <AccessMetric
          icon={<FiCheckCircle />}
          label={text("Разрешений", "Permissions")}
          value={rolePermissions.length}
        />
        <AccessMetric icon={<FiUsers />} label={text("Пользователей", "Users")} value={assignedUsers.length} />
        <AccessMetric
          icon={role.scopeType === "department" ? <FiBriefcase /> : <FiLayers />}
          label={text("Область", "Scope")}
          value={1}
        />
      </section>

      <section className="app-surface app-border flex flex-col gap-3 rounded-[24px] border p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="app-muted text-xs font-black uppercase tracking-[0.12em]">
            {text("Где действует роль", "Where this role applies")}
          </p>
          <p className="app-text mt-1 font-black">{scopeLabel}</p>
        </div>
        <span className="app-surface-muted app-border rounded-full border px-3 py-1.5 text-xs font-black">
          {role.isSystem ? text("Системная", "System") : text("Локальная", "Local")}
        </span>
      </section>

      <section className="app-surface app-border rounded-[28px] border p-5">
        <div className="relative max-w-xl">
          <FiSearch className="app-muted pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2" />
          <Input
            aria-label={text("Поиск разрешений роли", "Search role permissions")}
            className="pl-10"
            onChange={(event) => setSearch(event.target.value)}
            placeholder={text("Поиск по разрешениям", "Search permissions")}
            value={search}
          />
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          {permissionGroups.map(([module, items]) => (
            <section className="app-surface app-border overflow-hidden rounded-[24px] border" key={module}>
              <header className="app-surface-muted app-border-soft border-b px-5 py-4">
                <p className="app-text font-black">{module}</p>
                <p className="app-section-count mt-1">{items.length} {text("разрешений", "permissions")}</p>
              </header>
              <div className="divide-y divide-[var(--app-border-soft)]">
                {items.map((permission) => (
                  <div className="px-5 py-4" key={permission.code}>
                    <div className="flex items-start gap-3">
                      <FiCheckCircle className="app-accent-text mt-0.5 h-4 w-4 shrink-0" />
                      <div>
                        <p className="app-text text-sm font-black">{accessPermissionName(permission, text)}</p>
                        <p className="app-permission-code mt-1 font-mono">{permission.code}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
          {permissionGroups.length === 0 && (
            <section className="app-surface app-border overflow-hidden rounded-[24px] border">
              <EmptyState
                description={text("Измените поисковый запрос.", "Change the search query.")}
                title={text("Разрешения не найдены", "No permissions found")}
              />
            </section>
          )}
        </div>

        <aside className="app-surface app-border h-fit rounded-[28px] border p-5">
          <div className="flex items-center gap-3">
            <FiUsers className="app-accent-text h-5 w-5" />
            <p className="app-text font-black">{text("Пользователи роли", "Role users")}</p>
          </div>
          <div className="mt-4 space-y-2">
            {assignedUsers.slice(0, 12).map((user) => (
              <div className="app-surface-muted app-border rounded-2xl border p-3" key={user.id}>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="app-text truncate text-sm font-black">{user.employeeName}</p>
                    <p className="app-muted mt-1 truncate text-xs">@{user.username}</p>
                  </div>
                  <StatusBadge status={user.status} />
                </div>
              </div>
            ))}
            {assignedUsers.length === 0 && (
              <p className="app-muted py-6 text-center text-sm">{text("Роль пока никому не назначена", "The role is not assigned to anyone yet")}</p>
            )}
            {assignedUsers.length > 12 && (
              <p className="app-muted text-center text-xs font-semibold">
                {text("Ещё", "More")} {assignedUsers.length - 12}
              </p>
            )}
          </div>
        </aside>
      </section>

      <DeleteConfirmDialog
        description={text("Удалить роль можно только после того, как она снята со всех пользователей.", "A role can only be deleted after it has been removed from all users.")}
        onConfirm={confirmDeleteRole}
        onOpenChange={(open) => !open && setDeleteRole(null)}
        open={Boolean(deleteRole)}
        title={text(`Удалить роль «${deleteRole?.name ?? ""}»?`, `Delete role “${deleteRole?.name ?? ""}”?`)}
      />
    </div>
  );
}

function getRoleScopeLabel(
  role: AccessRoleSummary,
  sessionEnterpriseName: string,
  sessionDepartmentName: string,
  text: (ru: string, en: string) => string,
): string {
  if (role.scopeType === "global") return text("Вся система", "Entire system");
  if (role.scopeType === "enterprise") {
    const name = role.enterpriseName || sessionEnterpriseName || text("не указано", "not specified");
    return text(`Предприятие «${name}»`, `Enterprise “${name}”`);
  }
  if (role.scopeType === "department") {
    const name = role.departmentName || sessionDepartmentName || text("не указан", "not specified");
    return text(`Отдел «${name}»`, `Department “${name}”`);
  }
  return text("Личный доступ сотрудника", "Employee own-data access");
}
