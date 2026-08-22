import { useCallback, useEffect, useState } from "react";
import {
  FiArrowRight,
  FiCheck,
  FiEdit2,
  FiPlus,
  FiRefreshCw,
  FiShield,
  FiTrash2,
  FiUsers,
} from "react-icons/fi";
import { useNavigate } from "react-router-dom";
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
  DataTable,
  IconButton,
  PageHeader,
  type DataTableColumn,
} from "../../shared/ui";
import {
  AccessMetric,
  RoleDialog,
  emptyRoleDraft,
  getErrorMessage,
  scopeLabel,
  type RoleDraft,
} from "./AccessControlShared";

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

export function AccessRolesPage(): JSX.Element {
  const navigate = useNavigate();
  const [overview, setOverview] = useState<AccessControlOverview>(emptyOverview);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [roleDraft, setRoleDraft] = useState<RoleDraft>(emptyRoleDraft);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [deleteRole, setDeleteRole] = useState<AccessRoleSummary | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      setOverview(await hrApiClient.getAccessOverview());
    } catch (error) {
      toast.error(getErrorMessage(error, "Не удалось загрузить роли"));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  function openCreateRole(): void {
    setRoleDraft(emptyRoleDraft);
    setRoleDialogOpen(true);
  }

  function openEditRole(role: AccessRoleSummary): void {
    setRoleDraft({
      id: role.id,
      name: role.name,
      description: role.description,
      scopeType: role.scopeType,
      permissionCodes: role.permissionCodes,
    });
    setRoleDialogOpen(true);
  }

  async function saveRole(): Promise<void> {
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
      toast.success(roleDraft.id ? "Роль обновлена" : "Роль создана");
      setRoleDialogOpen(false);
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
        {role.isSystem ? (
          <span className="app-muted text-xs font-semibold">Защищена</span>
        ) : (
          <>
            <IconButton
              icon={<FiEdit2 />}
              label="Редактировать"
              onClick={() => openEditRole(role)}
              size="sm"
            />
            <IconButton
              icon={<FiTrash2 />}
              label="Удалить"
              onClick={() => setDeleteRole(role)}
              size="sm"
              tone="danger"
            />
          </>
        )}
      </div>
    );
  }

  const permissionMap = new Map(
    overview.permissions.map((permission) => [permission.code, permission]),
  );

  const columns: DataTableColumn<AccessRoleSummary>[] = [
    {
      key: "role",
      header: "Роль",
      render: (role) => (
        <div className="min-w-[220px]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="app-text font-black">{role.name}</span>
            {role.isSystem && (
              <span className="app-accent-soft app-accent-text rounded-full px-2 py-0.5 text-[10px] font-black">
                Системная
              </span>
            )}
          </div>
          <p className="app-muted mt-1 max-w-[360px] text-xs leading-5">
            {role.description || "—"}
          </p>
        </div>
      ),
    },
    {
      key: "scope",
      header: "Область данных",
      render: (role) => (
        <span className="app-text-soft font-semibold">
          {scopeLabel(role.scopeType)}
        </span>
      ),
    },
    {
      key: "users",
      header: "Пользователей",
      align: "center",
      render: (role) => (
        <span className="app-text font-black">{role.userCount}</span>
      ),
    },
    {
      key: "permissions",
      header: "Разрешения",
      render: (role) => (
        <div className="flex max-w-[360px] flex-wrap gap-1.5">
          {role.permissionCodes.slice(0, 3).map((code) => (
            <span
              className="app-surface-muted app-border inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold"
              key={code}
            >
              <FiCheck className="app-accent-text h-3 w-3" />
              {permissionMap.get(code)?.name ?? code}
            </span>
          ))}
          {role.permissionCodes.length > 3 && (
            <span className="app-muted self-center text-xs font-bold">
              +{role.permissionCodes.length - 3}
            </span>
          )}
        </div>
      ),
    },
    {
      key: "actions",
      header: "Действия",
      align: "center",
      render: (role) => renderRoleActions(role),
    },
  ];

  const systemRoles = overview.roles.filter((role) => role.isSystem).length;
  const customRoles = overview.roles.length - systemRoles;

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <Button
            className="border-white/20 shadow-xl hover:opacity-90"
            leftIcon={<FiPlus className="h-4 w-4" />}
            onClick={openCreateRole}
            style={{ background: "#ffffff", color: "#0f172a" }}
            variant="ghost"
          >
            Создать роль
          </Button>
        }
        description="Системные и пользовательские роли, область видимости данных и набор разрешений."
        icon={<FiShield />}
        title="Роли"
      />

      <section className="grid gap-4 sm:grid-cols-3">
        <AccessMetric icon={<FiShield />} label="Всего ролей" value={overview.roles.length} />
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
              {role.isSystem && (
                <span className="app-accent-text font-black">Системная</span>
              )}
              <span className="app-text-soft">
                <span className="app-muted">Область: </span>
                {scopeLabel(role.scopeType)}
              </span>
              <span className="app-text-soft">
                <span className="app-muted">Пользователей: </span>
                {role.userCount}
              </span>
              <span className="app-text-soft">
                <span className="app-muted">Разрешений: </span>
                {role.permissionCodes.length}
              </span>
            </>
          ),
          actions: (role) => renderRoleActions(role),
        }}
        columns={columns}
        emptyDescription="Создайте первую кастомную роль или используйте системные роли."
        emptyTitle="Ролей пока нет"
        footer={
          <>
            Ролей: <span className="app-text font-black">{overview.roles.length}</span>
          </>
        }
        getRowKey={(role) => role.id}
        isLoading={isLoading}
        loadingLabel="Загрузка ролей..."
        notice="Нажмите на роль, чтобы открыть отдельную страницу с полным набором разрешений и назначенных пользователей."
        onRowClick={(role) => navigate(`/roles/${role.id}`)}
        rows={overview.roles}
        toolbar={
          <Button
            leftIcon={
              <FiRefreshCw
                className={isLoading ? "h-4 w-4 animate-spin" : "h-4 w-4"}
              />
            }
            onClick={() => void loadData()}
            variant="secondary"
          >
            Обновить
          </Button>
        }
      />

      <RoleDialog
        draft={roleDraft}
        isSaving={isSaving}
        onChange={setRoleDraft}
        onOpenChange={setRoleDialogOpen}
        onSave={() => void saveRole()}
        open={roleDialogOpen}
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
