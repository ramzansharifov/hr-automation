import { useCallback, useEffect, useState } from "react";
import { FiPlus, FiShield, FiUsers } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import { useAuth } from "../../features/auth/AuthContext";
import { useAppText } from "../../shared/i18n";
import { hrApiClient } from "../../shared/lib/hrApiClient";
import type { AccessRoleSummary } from "../../shared/types/access";
import {
  ActionButton,
  DataTable,
  DeleteConfirmDialog,
  PageHeader,
  RecordActions,
  type DataTableColumn,
} from "../../shared/ui";
import { AccessMetric, getErrorMessage } from "./AccessControlShared";
import { accessRoleName } from "./accessTranslations";

export function AccessRolesPage(): JSX.Element {
  const text = useAppText();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const canCreate = hasPermission("roles.create");
  const canEdit = hasPermission("roles.edit");
  const canDelete = hasPermission("roles.delete");
  const [roles, setRoles] = useState<AccessRoleSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteRole, setDeleteRole] = useState<AccessRoleSummary | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      setRoles(await hrApiClient.listAccessRoles());
    } catch (error) {
      toast.error(getErrorMessage(error, text("Не удалось загрузить роли", "Failed to load roles")));
    } finally {
      setIsLoading(false);
    }
  }, [text]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function confirmDeleteRole(): Promise<void> {
    if (!deleteRole || !canDelete) return;
    try {
      await hrApiClient.deleteAccessRole(deleteRole.id);
      setDeleteRole(null);
      toast.success(text("Роль удалена", "Role deleted"));
      await loadData();
    } catch (error) {
      toast.error(getErrorMessage(error, text("Не удалось удалить роль", "Failed to delete role")));
    }
  }

  function renderRoleActions(role: AccessRoleSummary): JSX.Element | null {
    return (
      <RecordActions
        deleteLabel={text("Удалить роль", "Delete role")}
        editLabel={text("Редактировать роль", "Edit role")}
        onDelete={
          !role.isSystem && canDelete ? () => setDeleteRole(role) : undefined
        }
        onEdit={
          !role.isSystem && canEdit
            ? () => navigate(`/roles/${role.id}/edit`)
            : undefined
        }
        onView={() => navigate(`/roles/${role.id}`)}
        viewLabel={text("Открыть роль", "Open role")}
      />
    );
  }

  const columns: DataTableColumn<AccessRoleSummary>[] = [
    {
      key: "role",
      header: text("Роль", "Role"),
      render: (role) => (
        <div className="flex min-w-[260px] items-center gap-3">
          <span className="app-accent-soft flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border">
            <FiShield className="h-5 w-5" />
          </span>
          <p className="app-text truncate font-black">{accessRoleName(role.systemKey, role.name, text)}</p>
        </div>
      ),
    },
    {
      key: "scope",
      header: text("Область действия", "Scope"),
      render: (role) => (
        <p className="app-text-soft min-w-[190px] text-sm font-bold">
          {getRoleScopeLabel(role, text)}
        </p>
      ),
    },
    {
      key: "type",
      header: text("Тип", "Type"),
      render: (role) => (
        <span
          className={[
            "inline-flex rounded-full border px-2.5 py-1 text-xs font-bold",
            role.isSystem
              ? "app-accent-soft app-accent-text"
              : "app-surface-muted app-border app-text-soft",
          ].join(" ")}
        >
          {role.isSystem ? text("Системная", "System") : text("Пользовательская", "Custom")}
        </span>
      ),
    },
    {
      key: "users",
      header: text("Пользователей", "Users"),
      align: "center",
      render: (role) => <span className="app-text font-black">{role.userCount}</span>,
    },
    {
      key: "permissions",
      header: text("Разрешений", "Permissions"),
      align: "center",
      render: (role) => (
        <span className="app-text font-black">{role.permissionCodes.length}</span>
      ),
    },
    {
      key: "actions",
      header: text("Действия", "Actions"),
      align: "center",
      render: (role) => renderRoleActions(role),
    },
  ];

  const systemRoles = roles.filter((role) => role.isSystem).length;
  const customRoles = roles.length - systemRoles;

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          canCreate ? (
            <ActionButton
              action="create"
              onClick={() => navigate("/roles/new")}
            >
              {text("Создать роль", "Create role")}
            </ActionButton>
          ) : undefined
        }
        icon={<FiShield />}
        title={text("Роли", "Roles")}
      />

      <section className="grid gap-4 sm:grid-cols-3">
        <AccessMetric icon={<FiShield />} label={text("Доступно ролей", "Available roles")} value={roles.length} />
        <AccessMetric icon={<FiUsers />} label={text("Системные", "System")} value={systemRoles} />
        <AccessMetric icon={<FiPlus />} label={text("Пользовательские", "Custom")} value={customRoles} />
      </section>

      <DataTable
        ariaLabel={text("Роли доступа", "Access roles")}
        card={{
          leading: () => <FiShield className="h-5 w-5" />,
          title: (role) => accessRoleName(role.systemKey, role.name, text),
          meta: (role) => (
            <>
              {role.isSystem && <span className="app-accent-text font-black">{text("Системная", "System")}</span>}
              <span className="app-text-soft">{getRoleScopeLabel(role, text)}</span>
              <span className="app-text-soft"><span className="app-muted">{text("Пользователей:", "Users:")} </span>{role.userCount}</span>
              <span className="app-text-soft"><span className="app-muted">{text("Разрешений:", "Permissions:")} </span>{role.permissionCodes.length}</span>
            </>
          ),
          actions: (role) => renderRoleActions(role),
        }}
        columns={columns}
        emptyDescription={text("Создайте первую пользовательскую роль или используйте системные роли.", "Create the first custom role or use the built-in system roles.")}
        emptyTitle={text("Ролей пока нет", "No roles yet")}
        footer={<>{text("Ролей:", "Roles:")} <span className="app-text font-black">{roles.length}</span></>}
        getRowKey={(role) => role.id}
        isLoading={isLoading}
        loadingLabel={text("Загрузка ролей...", "Loading roles...")}
        onRowClick={(role) => navigate(`/roles/${role.id}`)}
        rows={roles}
        toolbar={
          <ActionButton
            action="refresh"
            loading={isLoading}
            onClick={() => void loadData()}
          />
        }
      />

      <DeleteConfirmDialog
        description={text("Роль можно удалить только после того, как она снята со всех пользователей.", "A role can only be deleted after it has been removed from all users.")}
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
  text: (ru: string, en: string) => string,
): string {
  if (role.scopeType === "global") return text("Вся система", "Entire system");
  if (role.scopeType === "enterprise") {
    return role.enterpriseName
      ? text(`Предприятие · ${role.enterpriseName}`, `Enterprise · ${role.enterpriseName}`)
      : text("Предприятие пользователя", "User enterprise");
  }
  if (role.scopeType === "department") {
    return role.departmentName
      ? text(`Отдел · ${role.departmentName}`, `Department · ${role.departmentName}`)
      : text("Отдел пользователя", "User department");
  }
  return text("Только сам сотрудник", "Own data only");
}
