import { useCallback, useEffect, useState } from "react";
import {
  FiArrowRight,
  FiEdit2,
  FiPlus,
  FiRefreshCw,
  FiShield,
  FiTrash2,
  FiUsers,
} from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import { useAuth } from "../../features/auth/AuthContext";
import { hrApiClient } from "../../shared/lib/hrApiClient";
import type { AccessRoleSummary } from "../../shared/types/access";
import {
  Button,
  ConfirmDialog,
  DataTable,
  IconButton,
  PageHeader,
  type DataTableColumn,
} from "../../shared/ui";
import { AccessMetric, getErrorMessage } from "./AccessControlShared";

export function AccessRolesPage(): JSX.Element {
  const navigate = useNavigate();
  const { hasPermission, session } = useAuth();
  const canCreate = hasPermission("roles.create");
  const canEdit = hasPermission("roles.edit");
  const canDelete = hasPermission("roles.delete");
  const [roles, setRoles] = useState<AccessRoleSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteRole, setDeleteRole] = useState<AccessRoleSummary | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      setRoles(await hrApiClient.listAccessRoles());
    } catch (error) {
      toast.error(getErrorMessage(error, "Не удалось загрузить роли"));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function confirmDeleteRole(): Promise<void> {
    if (!deleteRole || !canDelete) return;
    setIsSaving(true);
    try {
      await hrApiClient.deleteAccessRole(deleteRole.id);
      setDeleteRole(null);
      toast.success("Роль удалена");
      await loadData();
    } catch (error) {
      toast.error(getErrorMessage(error, "Не удалось удалить роль"));
    } finally {
      setIsSaving(false);
    }
  }

  function renderRoleActions(role: AccessRoleSummary): JSX.Element {
    return (
      <div
        className="flex items-center justify-center gap-2"
        onClick={(event) => event.stopPropagation()}
      >
        <IconButton
          icon={<FiArrowRight />}
          label="Открыть роль"
          onClick={() => navigate(`/roles/${role.id}`)}
          size="sm"
        />
        {!role.isSystem && canEdit && (
          <IconButton
            icon={<FiEdit2 />}
            label="Редактировать"
            onClick={() => navigate(`/roles/${role.id}/edit`)}
            size="sm"
          />
        )}
        {!role.isSystem && canDelete && (
          <IconButton
            icon={<FiTrash2 />}
            label="Удалить"
            onClick={() => setDeleteRole(role)}
            size="sm"
            tone="danger"
          />
        )}
      </div>
    );
  }

  const columns: DataTableColumn<AccessRoleSummary>[] = [
    {
      key: "role",
      header: "Роль",
      render: (role) => (
        <div className="flex min-w-[260px] items-center gap-3">
          <span className="app-accent-soft flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border">
            <FiShield className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="app-text truncate font-black">{role.name}</p>
            <p className="app-muted mt-1 max-w-[420px] truncate text-xs">
              {role.description || "Описание не указано"}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "scope",
      header: "Область действия",
      render: (role) => (
        <div className="min-w-[190px]">
          <p className="app-text-soft text-sm font-bold">{getRoleScopeLabel(role)}</p>
          <p className="app-muted mt-1 text-xs">
            {role.isSystem ? "Определяется оргструктурой пользователя" : "Фиксированная привязка"}
          </p>
        </div>
      ),
    },
    {
      key: "type",
      header: "Тип",
      render: (role) => (
        <span
          className={[
            "inline-flex rounded-full border px-2.5 py-1 text-xs font-bold",
            role.isSystem
              ? "app-accent-soft app-accent-text"
              : "app-surface-muted app-border app-text-soft",
          ].join(" ")}
        >
          {role.isSystem ? "Системная" : "Пользовательская"}
        </span>
      ),
    },
    {
      key: "users",
      header: "Пользователей",
      align: "center",
      render: (role) => <span className="app-text font-black">{role.userCount}</span>,
    },
    {
      key: "permissions",
      header: "Разрешений",
      align: "center",
      render: (role) => (
        <span className="app-text font-black">{role.permissionCodes.length}</span>
      ),
    },
    {
      key: "actions",
      header: "Действия",
      align: "center",
      render: (role) => renderRoleActions(role),
    },
  ];

  const systemRoles = roles.filter((role) => role.isSystem).length;
  const customRoles = roles.length - systemRoles;
  const roleScope = session.permissionScopes["roles.view"];
  const contextDescription =
    roleScope === "enterprise"
      ? `Пользовательские роли, созданные здесь, действуют только в предприятии «${session.enterpriseName}».`
      : roleScope === "department"
        ? `Пользовательские роли, созданные здесь, действуют только в отделе «${session.departmentName}».`
        : "Системные и пользовательские роли с точечным набором разрешённых действий.";

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          canCreate ? (
            <Button
              className="border-white/20 shadow-xl hover:opacity-90"
              leftIcon={<FiPlus className="h-4 w-4" />}
              onClick={() => navigate("/roles/new")}
              style={{ background: "#ffffff", color: "#0f172a" }}
              variant="ghost"
            >
              Создать роль
            </Button>
          ) : undefined
        }
        description={contextDescription}
        icon={<FiShield />}
        title="Роли"
      />

      <section className="grid gap-4 sm:grid-cols-3">
        <AccessMetric icon={<FiShield />} label="Доступно ролей" value={roles.length} />
        <AccessMetric icon={<FiUsers />} label="Системные" value={systemRoles} />
        <AccessMetric icon={<FiPlus />} label="Пользовательские" value={customRoles} />
      </section>

      <DataTable
        ariaLabel="Роли доступа"
        card={{
          leading: () => <FiShield className="h-5 w-5" />,
          title: (role) => role.name,
          meta: (role) => (
            <>
              {role.isSystem && <span className="app-accent-text font-black">Системная</span>}
              <span className="app-text-soft">{getRoleScopeLabel(role)}</span>
              <span className="app-text-soft"><span className="app-muted">Пользователей: </span>{role.userCount}</span>
              <span className="app-text-soft"><span className="app-muted">Разрешений: </span>{role.permissionCodes.length}</span>
            </>
          ),
          actions: (role) => renderRoleActions(role),
        }}
        columns={columns}
        emptyDescription="Создайте первую пользовательскую роль или используйте системные роли."
        emptyTitle="Ролей пока нет"
        footer={<>Ролей: <span className="app-text font-black">{roles.length}</span></>}
        getRowKey={(role) => role.id}
        isLoading={isLoading}
        loadingLabel="Загрузка ролей..."
        onRowClick={(role) => navigate(`/roles/${role.id}`)}
        rows={roles}
        toolbar={
          <Button
            leftIcon={<FiRefreshCw className={isLoading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />}
            onClick={() => void loadData()}
            variant="secondary"
          >
            Обновить
          </Button>
        }
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

function getRoleScopeLabel(role: AccessRoleSummary): string {
  if (role.scopeType === "global") return "Вся система";
  if (role.scopeType === "enterprise") {
    return role.enterpriseName ? `Предприятие · ${role.enterpriseName}` : "Предприятие пользователя";
  }
  if (role.scopeType === "department") {
    return role.departmentName ? `Отдел · ${role.departmentName}` : "Отдел пользователя";
  }
  return "Только сам сотрудник";
}
