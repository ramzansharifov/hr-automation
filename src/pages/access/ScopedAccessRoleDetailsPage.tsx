import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiArrowLeft,
  FiBriefcase,
  FiCheckCircle,
  FiEdit2,
  FiLayers,
  FiSearch,
  FiShield,
  FiTrash2,
  FiUsers,
} from "react-icons/fi";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";

import { useAuth } from "../../features/auth/AuthContext";
import { hrApiClient } from "../../shared/lib/hrApiClient";
import type {
  AccessPermission,
  AccessRoleSummary,
  AccessUserSummary,
} from "../../shared/types/access";
import {
  Button,
  ConfirmDialog,
  EmptyState,
  Input,
  LoadingState,
  PageHeader,
} from "../../shared/ui";
import { AccessMetric, StatusBadge, getErrorMessage } from "./AccessControlShared";
import { groupPermissions } from "./accessControlData";

export function ScopedAccessRoleDetailsPage(): JSX.Element {
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
  const [isSaving, setIsSaving] = useState(false);
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
    const codes = new Set(role?.permissionCodes ?? []);
    return permissions.filter((permission) => codes.has(permission.code));
  }, [permissions, role?.permissionCodes]);
  const filteredPermissions = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return rolePermissions;
    return rolePermissions.filter((permission) =>
      [permission.name, permission.code, permission.module, permission.description]
        .join(" ")
        .toLocaleLowerCase()
        .includes(query),
    );
  }, [rolePermissions, search]);
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
    setIsSaving(true);
    try {
      await hrApiClient.deleteAccessRole(deleteRole.id);
      toast.success("Роль удалена");
      navigate("/roles");
    } catch (error) {
      toast.error(getErrorMessage(error, "Не удалось удалить роль"));
    } finally {
      setIsSaving(false);
      setDeleteRole(null);
    }
  }

  if (isLoading) return <LoadingState label="Загрузка роли..." />;

  if (!Number.isInteger(roleId) || roleId < 1 || !role) {
    return (
      <section className="app-surface app-border overflow-hidden rounded-[28px] border">
        <EmptyState
          description="Роль не существует или находится вне вашей области администрирования."
          title="Роль недоступна"
        />
      </section>
    );
  }

  const scopeLabel = getRoleScopeLabel(role, session.enterpriseName, session.departmentName);
  const canModifyRole = !role.isSystem;

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <div className="flex flex-wrap gap-3">
            <Button
              className="border-white/20 bg-white/10 text-white"
              leftIcon={<FiArrowLeft className="h-4 w-4" />}
              onClick={() => navigate("/roles")}
              variant="ghost"
            >
              К ролям
            </Button>
            {canModifyRole && canEdit && (
              <Button
                className="border-white/20 bg-white/10 text-white"
                leftIcon={<FiEdit2 className="h-4 w-4" />}
                onClick={() => navigate(`/roles/${role.id}/edit`)}
                variant="ghost"
              >
                Редактировать
              </Button>
            )}
            {canModifyRole && canDelete && (
              <Button
                className="border-red-300/40 bg-red-500/10 text-white"
                leftIcon={<FiTrash2 className="h-4 w-4" />}
                onClick={() => setDeleteRole(role)}
                variant="ghost"
              >
                Удалить
              </Button>
            )}
          </div>
        }
        description={role.description || "Описание роли не указано."}
        eyebrow={role.isSystem ? "Системная роль" : "Пользовательская роль"}
        icon={<FiShield />}
        title={role.name}
      />

      <section className="grid gap-4 sm:grid-cols-3">
        <AccessMetric
          icon={<FiCheckCircle />}
          label="Разрешений"
          value={rolePermissions.length}
        />
        <AccessMetric icon={<FiUsers />} label="Пользователей" value={assignedUsers.length} />
        <AccessMetric
          icon={role.scopeType === "department" ? <FiBriefcase /> : <FiLayers />}
          label="Область"
          value={role.scopeType === "department" ? 1 : 1}
        />
      </section>

      <section className="app-surface app-border flex flex-col gap-3 rounded-[24px] border p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="app-muted text-xs font-black uppercase tracking-[0.12em]">
            Где действует роль
          </p>
          <p className="app-text mt-1 font-black">{scopeLabel}</p>
          <p className="app-muted mt-1 text-xs leading-5">
            {role.isSystem
              ? "Системная роль использует оргструктуру сотрудника, которому она назначена."
              : "Эта привязка фиксирована: роль нельзя использовать за пределами указанной области."}
          </p>
        </div>
        <span className="app-surface-muted app-border rounded-full border px-3 py-1.5 text-xs font-black">
          {role.isSystem ? "Системная" : "Локальная"}
        </span>
      </section>

      <section className="app-surface app-border rounded-[28px] border p-5">
        <div className="relative max-w-xl">
          <FiSearch className="app-muted pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2" />
          <Input
            aria-label="Поиск разрешений роли"
            className="pl-10"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Поиск по разрешениям"
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
                <p className="app-muted mt-1 text-xs">{items.length} разрешений</p>
              </header>
              <div className="divide-y divide-[var(--app-border-soft)]">
                {items.map((permission) => (
                  <div className="px-5 py-4" key={permission.code}>
                    <div className="flex items-start gap-3">
                      <FiCheckCircle className="app-accent-text mt-0.5 h-4 w-4 shrink-0" />
                      <div>
                        <p className="app-text text-sm font-black">{permission.name}</p>
                        <p className="app-muted mt-1 text-xs leading-5">
                          {permission.description}
                        </p>
                        <p className="app-muted mt-1 font-mono text-[10px]">{permission.code}</p>
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
                description="Измените поисковый запрос."
                title="Разрешения не найдены"
              />
            </section>
          )}
        </div>

        <aside className="app-surface app-border h-fit rounded-[28px] border p-5">
          <div className="flex items-center gap-3">
            <FiUsers className="app-accent-text h-5 w-5" />
            <div>
              <p className="app-text font-black">Пользователи роли</p>
              <p className="app-muted mt-1 text-xs">Только в вашей доступной области</p>
            </div>
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
              <p className="app-muted py-6 text-center text-sm">Роль пока никому не назначена</p>
            )}
            {assignedUsers.length > 12 && (
              <p className="app-muted text-center text-xs font-semibold">
                Ещё {assignedUsers.length - 12}
              </p>
            )}
          </div>
        </aside>
      </section>

      <ConfirmDialog
        cancelLabel="Отмена"
        confirmLabel="Удалить роль"
        description="Удалить роль можно только после того, как она снята со всех пользователей."
        isLoading={isSaving}
        onConfirm={() => void confirmDeleteRole()}
        onOpenChange={(open) => !open && setDeleteRole(null)}
        open={Boolean(deleteRole)}
        title={`Удалить роль «${deleteRole?.name ?? ""}»?`}
      />
    </div>
  );
}

function getRoleScopeLabel(
  role: AccessRoleSummary,
  sessionEnterpriseName: string,
  sessionDepartmentName: string,
): string {
  if (role.scopeType === "global") return "Вся система";
  if (role.scopeType === "enterprise") {
    return `Предприятие «${role.enterpriseName || sessionEnterpriseName || "не указано"}»`;
  }
  if (role.scopeType === "department") {
    return `Отдел «${role.departmentName || sessionDepartmentName || "не указан"}»`;
  }
  return "Личный доступ сотрудника";
}
