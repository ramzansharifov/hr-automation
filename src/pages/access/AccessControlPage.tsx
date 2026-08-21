import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiCheck,
  FiEdit2,
  FiKey,
  FiLock,
  FiPlus,
  FiShield,
  FiTrash2,
  FiUserCheck,
  FiUsers,
} from "react-icons/fi";
import { toast } from "react-toastify";

import { hrApiClient } from "../../shared/lib/hrApiClient";
import type {
  AccessControlOverview,
  AccessPermission,
  AccessRoleSummary,
  AccessScopeType,
  AccessUserStatus,
  AccessUserSummary,
  SaveAccessRoleParams,
  SaveAccessUserParams,
  SystemAdminSummary,
} from "../../shared/types/access";
import type { HrRecord } from "../../shared/types/hr";
import {
  Button,
  ConfirmDialog,
  DataTable,
  Dialog,
  IconButton,
  Input,
  LoadingState,
  PageHeader,
  Select,
  Textarea,
  type DataTableColumn,
  type SelectOption,
} from "../../shared/ui";

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

const scopeOptions: SelectOption[] = [
  { value: "global", label: "Все данные системы" },
  { value: "enterprise", label: "Только своё предприятие" },
  { value: "department", label: "Только свой отдел" },
  { value: "self", label: "Только собственные данные" },
];

const statusOptions: SelectOption[] = [
  { value: "active", label: "Активен" },
  { value: "blocked", label: "Заблокирован" },
];

interface EmployeeOption extends SelectOption {
  departmentName: string;
  enterpriseName: string;
}

interface RoleDraft {
  id?: number;
  name: string;
  description: string;
  scopeType: AccessScopeType;
  permissionCodes: string[];
}

interface UserDraft {
  id?: number;
  employeeId: string;
  username: string;
  status: AccessUserStatus;
  roleIds: number[];
  password: string;
  mustChangePassword: boolean;
}

const emptyRoleDraft: RoleDraft = {
  name: "",
  description: "",
  scopeType: "self",
  permissionCodes: [],
};

const emptyUserDraft: UserDraft = {
  employeeId: "",
  username: "",
  status: "active",
  roleIds: [],
  password: "",
  mustChangePassword: true,
};

export function AccessControlPage(): JSX.Element {
  const [activeTab, setActiveTab] = useState<"users" | "roles">("users");
  const [overview, setOverview] = useState<AccessControlOverview>(emptyOverview);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [roleDraft, setRoleDraft] = useState<RoleDraft>(emptyRoleDraft);
  const [userDraft, setUserDraft] = useState<UserDraft>(emptyUserDraft);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [passwordDialogUser, setPasswordDialogUser] =
    useState<AccessUserSummary | null>(null);
  const [password, setPassword] = useState("");
  const [deleteRole, setDeleteRole] = useState<AccessRoleSummary | null>(null);
  const [deleteUser, setDeleteUser] = useState<AccessUserSummary | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [accessOverview, employeeOptions] = await Promise.all([
        hrApiClient.getAccessOverview(),
        loadEmployees(),
      ]);
      setOverview(accessOverview);
      setEmployees(employeeOptions);
    } catch (error) {
      toast.error(getErrorMessage(error, "Не удалось загрузить пользователей и роли"));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const availableEmployeeOptions = useMemo(() => {
    const currentEmployeeId = userDraft.id
      ? overview.users.find((user) => user.id === userDraft.id)?.employeeId
      : null;
    const occupiedEmployeeIds = new Set(
      overview.users
        .filter((user) => user.employeeId !== currentEmployeeId)
        .map((user) => user.employeeId),
    );
    return employees.filter((employee) => !occupiedEmployeeIds.has(Number(employee.value)));
  }, [employees, overview.users, userDraft.id]);

  const assignableRoles = useMemo(
    () => overview.roles.filter((role) => role.systemKey !== "superadmin"),
    [overview.roles],
  );

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

  function openCreateUser(): void {
    setUserDraft(emptyUserDraft);
    setUserDialogOpen(true);
  }

  function openEditUser(user: AccessUserSummary): void {
    setUserDraft({
      id: user.id,
      employeeId: String(user.employeeId),
      username: user.username,
      status: user.status,
      roleIds: user.roles.map((role) => role.id),
      password: "",
      mustChangePassword: user.mustChangePassword,
    });
    setUserDialogOpen(true);
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

  async function saveUser(): Promise<void> {
    setIsSaving(true);
    try {
      const params: SaveAccessUserParams = {
        id: userDraft.id,
        employeeId: Number(userDraft.employeeId),
        username: userDraft.username,
        status: userDraft.status,
        roleIds: userDraft.roleIds,
        password: userDraft.password || undefined,
        mustChangePassword: userDraft.mustChangePassword,
      };
      await hrApiClient.saveAccessUser(params);
      toast.success(userDraft.id ? "Пользователь обновлён" : "Пользователь создан");
      setUserDialogOpen(false);
      await loadData();
    } catch (error) {
      toast.error(getErrorMessage(error, "Не удалось сохранить пользователя"));
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

  async function confirmDeleteUser(): Promise<void> {
    if (!deleteUser) return;
    setIsSaving(true);
    try {
      await hrApiClient.deleteAccessUser(deleteUser.id);
      setDeleteUser(null);
      toast.success("Пользователь удалён");
      await loadData();
    } catch (error) {
      toast.error(getErrorMessage(error, "Не удалось удалить пользователя"));
    } finally {
      setIsSaving(false);
    }
  }

  async function resetPassword(): Promise<void> {
    if (!passwordDialogUser) return;
    setIsSaving(true);
    try {
      await hrApiClient.resetAccessPassword({
        userId: passwordDialogUser.id,
        password,
        mustChangePassword: true,
      });
      setPasswordDialogUser(null);
      setPassword("");
      toast.success("Временный пароль установлен");
      await loadData();
    } catch (error) {
      toast.error(getErrorMessage(error, "Не удалось изменить пароль"));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        actions={
          <Button
            className="border-white/20 shadow-xl hover:opacity-90"
            leftIcon={<FiPlus className="h-4 w-4" />}
            onClick={activeTab === "users" ? openCreateUser : openCreateRole}
            style={{ background: "#ffffff", color: "#0f172a" }}
            variant="ghost"
          >
            {activeTab === "users" ? "Добавить пользователя" : "Создать роль"}
          </Button>
        }
        description="Встроенный системный администратор хранится отдельно от сотрудников. Остальные учётные записи всегда связаны с сотрудником."
        icon={<FiShield />}
        title="Роли и пользователи"
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <AccessMetric
          icon={<FiUsers />}
          label="Учётные записи"
          value={overview.users.length + 1}
        />
        <AccessMetric icon={<FiShield />} label="Роли" value={overview.roles.length} />
        <AccessMetric
          icon={<FiLock />}
          label="Системные роли"
          value={overview.roles.filter((role) => role.isSystem).length}
        />
      </div>

      <section className="app-surface app-border overflow-hidden rounded-[28px] border">
        <div className="app-border-soft flex gap-2 border-b px-5 pt-3">
          <TabButton active={activeTab === "users"} onClick={() => setActiveTab("users")}>
            <FiUsers /> Пользователи
          </TabButton>
          <TabButton active={activeTab === "roles"} onClick={() => setActiveTab("roles")}>
            <FiShield /> Роли
          </TabButton>
        </div>

        <div className="p-5 sm:p-6">
          {isLoading ? (
            <LoadingState label="Загрузка управления доступом..." />
          ) : activeTab === "users" ? (
            <UsersSection
              onDelete={setDeleteUser}
              onEdit={openEditUser}
              onResetPassword={(user) => {
                setPassword("");
                setPasswordDialogUser(user);
              }}
              systemAdmin={overview.systemAdmin}
              users={overview.users}
            />
          ) : (
            <RolesSection
              permissions={overview.permissions}
              roles={overview.roles}
              onDelete={setDeleteRole}
              onEdit={openEditRole}
            />
          )}
        </div>
      </section>

      <RoleDialog
        draft={roleDraft}
        isSaving={isSaving}
        onChange={setRoleDraft}
        onOpenChange={setRoleDialogOpen}
        onSave={() => void saveRole()}
        open={roleDialogOpen}
        permissions={overview.permissions}
      />

      <UserDialog
        draft={userDraft}
        employeeOptions={availableEmployeeOptions}
        isSaving={isSaving}
        onChange={setUserDraft}
        onOpenChange={setUserDialogOpen}
        onSave={() => void saveUser()}
        open={userDialogOpen}
        roles={assignableRoles}
      />

      <Dialog
        description="Пароль хранится только в виде криптографического хеша. Пользователь должен сменить временный пароль при первом входе."
        onOpenChange={(open) => {
          if (!open) {
            setPasswordDialogUser(null);
            setPassword("");
          }
        }}
        open={Boolean(passwordDialogUser)}
        title={`Сбросить пароль: ${passwordDialogUser?.username ?? ""}`}
      >
        <Field label="Новый временный пароль">
          <Input
            autoComplete="new-password"
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Минимум 8 символов, буква и цифра"
            type="password"
            value={password}
          />
        </Field>
        <div className="mt-5 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setPasswordDialogUser(null)}>
            Отмена
          </Button>
          <Button disabled={isSaving} onClick={() => void resetPassword()}>
            Установить пароль
          </Button>
        </div>
      </Dialog>

      <ConfirmDialog
        cancelLabel="Отмена"
        confirmLabel="Удалить"
        description="Пользователь потеряет учётную запись, но связанный сотрудник и его кадровые данные останутся в системе."
        isLoading={isSaving}
        onConfirm={() => void confirmDeleteUser()}
        onOpenChange={(open) => !open && setDeleteUser(null)}
        open={Boolean(deleteUser)}
        title={`Удалить пользователя ${deleteUser?.username ?? ""}?`}
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

function UsersSection({
  onDelete,
  onEdit,
  onResetPassword,
  systemAdmin,
  users,
}: {
  onDelete: (user: AccessUserSummary) => void;
  onEdit: (user: AccessUserSummary) => void;
  onResetPassword: (user: AccessUserSummary) => void;
  systemAdmin: SystemAdminSummary;
  users: AccessUserSummary[];
}): JSX.Element {
  type UserRow =
    | { kind: "system"; id: string; admin: SystemAdminSummary }
    | { kind: "user"; id: string; user: AccessUserSummary };

  const rows: UserRow[] = [
    { kind: "system", id: "system-superadmin", admin: systemAdmin },
    ...users.map((user) => ({ kind: "user" as const, id: String(user.id), user })),
  ];

  const columns: DataTableColumn<UserRow>[] = [
    {
      key: "account",
      header: "Учётная запись",
      render: (row) => row.kind === "system" ? (
        <div className="flex min-w-[210px] items-center gap-3">
          <span className="app-accent-soft flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border">
            <FiShield className="h-5 w-5" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="app-text font-black">Системный администратор</span>
              <span className="app-accent-soft app-accent-text rounded-full px-2 py-0.5 text-[10px] font-black">Встроенная</span>
            </div>
            <p className="app-accent-text mt-1 text-xs font-black">@{row.admin.username}</p>
          </div>
        </div>
      ) : (
        <div className="flex min-w-[210px] items-center gap-3">
          <span className="app-accent-soft flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border">
            <FiUserCheck className="h-5 w-5" />
          </span>
          <div>
            <p className="app-text font-black">{row.user.employeeName}</p>
            <p className="app-accent-text mt-1 text-xs font-black">@{row.user.username}</p>
          </div>
        </div>
      ),
    },
    {
      key: "structure",
      header: "Сотрудник / структура",
      render: (row) => row.kind === "system" ? (
        <span className="app-muted text-sm">Не связан с сотрудником</span>
      ) : (
        <div className="min-w-[180px]">
          <p className="app-text-soft text-sm font-semibold">{row.user.employeeName}</p>
          <p className="app-muted mt-1 text-xs">
            {[row.user.enterpriseName, row.user.departmentName].filter(Boolean).join(" · ") || "—"}
          </p>
        </div>
      ),
    },
    {
      key: "status",
      header: "Статус",
      render: (row) => row.kind === "system" ? <StatusBadge status="active" /> : <StatusBadge status={row.user.status} />,
    },
    {
      key: "roles",
      header: "Роли",
      render: (row) => (
        <div className="flex max-w-[260px] flex-wrap gap-1.5">
          {row.kind === "system" ? (
            <span className="app-surface-muted app-border rounded-full border px-2.5 py-1 text-xs font-bold">Superadmin</span>
          ) : row.user.roles.length > 0 ? (
            row.user.roles.slice(0, 3).map((role) => (
              <span className="app-surface-muted app-border rounded-full border px-2.5 py-1 text-xs font-bold" key={role.id}>
                {role.name}
              </span>
            ))
          ) : (
            <span className="app-muted text-xs">Нет ролей</span>
          )}
          {row.kind === "user" && row.user.roles.length > 3 && (
            <span className="app-muted text-xs font-bold">+{row.user.roles.length - 3}</span>
          )}
        </div>
      ),
    },
    {
      key: "access",
      header: "Доступ",
      render: (row) => row.kind === "system" ? (
        <div>
          <p className="app-text font-bold">Полный системный доступ</p>
          <p className="app-muted mt-1 text-xs">Пароль: {row.admin.mustChangePassword ? "требуется смена" : "установлен"}</p>
        </div>
      ) : (
        <div>
          <p className="app-text font-bold">{row.user.effectivePermissionCodes.length} разрешений</p>
          {row.user.mustChangePassword && (
            <p className="mt-1 text-xs font-semibold text-amber-600 dark:text-amber-300">Требуется смена пароля</p>
          )}
        </div>
      ),
    },
    {
      key: "actions",
      header: "Действия",
      align: "center",
      render: (row) => row.kind === "system" ? (
        <span className="app-muted text-xs font-semibold">Системная</span>
      ) : (
        <div className="flex items-center justify-center gap-2">
          <IconButton label="Сбросить пароль" onClick={() => onResetPassword(row.user)}>
            <FiKey />
          </IconButton>
          <IconButton label="Редактировать" onClick={() => onEdit(row.user)}>
            <FiEdit2 />
          </IconButton>
          <IconButton danger label="Удалить" onClick={() => onDelete(row.user)}>
            <FiTrash2 />
          </IconButton>
        </div>
      ),
    },
  ];

  return (
    <DataTable
      ariaLabel="Пользователи системы"
      columns={columns}
      footer={
        <>
          Учётных записей: <span className="app-text font-black">{rows.length}</span>
        </>
      }
      frame={false}
      getRowKey={(row) => row.id}
      rows={rows}
    />
  );
}

function RolesSection({
  onDelete,
  onEdit,
  permissions,
  roles,
}: {
  onDelete: (role: AccessRoleSummary) => void;
  onEdit: (role: AccessRoleSummary) => void;
  permissions: AccessPermission[];
  roles: AccessRoleSummary[];
}): JSX.Element {
  const permissionMap = new Map(permissions.map((permission) => [permission.code, permission]));
  const columns: DataTableColumn<AccessRoleSummary>[] = [
    {
      key: "role",
      header: "Роль",
      render: (role) => (
        <div className="min-w-[220px]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="app-text font-black">{role.name}</span>
            {role.isSystem && (
              <span className="app-accent-soft app-accent-text rounded-full px-2 py-0.5 text-[10px] font-black">Системная</span>
            )}
          </div>
          <p className="app-muted mt-1 max-w-[360px] text-xs leading-5">{role.description || "—"}</p>
        </div>
      ),
    },
    {
      key: "scope",
      header: "Область данных",
      render: (role) => <span className="app-text-soft font-semibold">{scopeLabel(role.scopeType)}</span>,
    },
    {
      key: "users",
      header: "Пользователей",
      align: "center",
      render: (role) => <span className="app-text font-black">{role.userCount}</span>,
    },
    {
      key: "permissions",
      header: "Разрешения",
      render: (role) => (
        <div className="flex max-w-[360px] flex-wrap gap-1.5">
          {role.permissionCodes.slice(0, 3).map((code) => (
            <span className="app-surface-muted app-border inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold" key={code}>
              <FiCheck className="app-accent-text h-3 w-3" />
              {permissionMap.get(code)?.name ?? code}
            </span>
          ))}
          {role.permissionCodes.length > 3 && (
            <span className="app-muted self-center text-xs font-bold">+{role.permissionCodes.length - 3}</span>
          )}
        </div>
      ),
    },
    {
      key: "actions",
      header: "Действия",
      align: "center",
      render: (role) => role.isSystem ? (
        <span className="app-muted text-xs font-semibold">Защищена</span>
      ) : (
        <div className="flex items-center justify-center gap-2">
          <IconButton label="Редактировать" onClick={() => onEdit(role)}>
            <FiEdit2 />
          </IconButton>
          <IconButton danger label="Удалить" onClick={() => onDelete(role)}>
            <FiTrash2 />
          </IconButton>
        </div>
      ),
    },
  ];

  return (
    <DataTable
      ariaLabel="Роли доступа"
      columns={columns}
      emptyDescription="Создайте первую кастомную роль или используйте системные роли."
      emptyTitle="Ролей пока нет"
      footer={
        <>
          Ролей: <span className="app-text font-black">{roles.length}</span>
        </>
      }
      frame={false}
      getRowKey={(role) => role.id}
      rows={roles}
    />
  );
}

function RoleDialog({
  draft,
  isSaving,
  onChange,
  onOpenChange,
  onSave,
  open,
  permissions,
}: {
  draft: RoleDraft;
  isSaving: boolean;
  onChange: (draft: RoleDraft) => void;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
  open: boolean;
  permissions: AccessPermission[];
}): JSX.Element {
  const grouped = groupPermissions(permissions);

  return (
    <Dialog
      description="Кастомная роль объединяет область видимости данных и набор разрешённых действий. Системные роли изменять нельзя."
      onOpenChange={onOpenChange}
      open={open}
      title={draft.id ? "Редактировать роль" : "Новая роль"}
    >
      <div className="grid gap-4">
        <Field label="Название роли">
          <Input
            onChange={(event) => onChange({ ...draft, name: event.target.value })}
            placeholder="Например, Кадровик"
            value={draft.name}
          />
        </Field>
        <Field label="Описание">
          <Textarea
            onChange={(event) => onChange({ ...draft, description: event.target.value })}
            placeholder="Для кого предназначена роль и что она позволяет делать"
            value={draft.description}
          />
        </Field>
        <Field label="Область данных">
          <Select
            onValueChange={(value) =>
              onChange({ ...draft, scopeType: value as AccessScopeType })
            }
            options={scopeOptions}
            value={draft.scopeType}
          />
        </Field>

        <div>
          <p className="app-text text-sm font-black">Разрешения</p>
          <div className="mt-3 space-y-3">
            {grouped.map(([module, modulePermissions]) => (
              <section className="app-surface-muted app-border rounded-2xl border p-4" key={module}>
                <p className="app-text text-sm font-black">{module}</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {modulePermissions.map((permission) => {
                    const checked = draft.permissionCodes.includes(permission.code);
                    return (
                      <label className="app-surface app-border flex cursor-pointer items-start gap-3 rounded-xl border p-3" key={permission.code}>
                        <input
                          checked={checked}
                          className="mt-1 h-4 w-4 accent-[var(--accent)]"
                          onChange={() =>
                            onChange({
                              ...draft,
                              permissionCodes: checked
                                ? draft.permissionCodes.filter((code) => code !== permission.code)
                                : [...draft.permissionCodes, permission.code],
                            })
                          }
                          type="checkbox"
                        />
                        <span>
                          <span className="app-text block text-sm font-bold">{permission.name}</span>
                          <span className="app-muted mt-1 block text-xs leading-5">{permission.description}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button disabled={isSaving} onClick={onSave}>
            Сохранить роль
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function UserDialog({
  draft,
  employeeOptions,
  isSaving,
  onChange,
  onOpenChange,
  onSave,
  open,
  roles,
}: {
  draft: UserDraft;
  employeeOptions: EmployeeOption[];
  isSaving: boolean;
  onChange: (draft: UserDraft) => void;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
  open: boolean;
  roles: AccessRoleSummary[];
}): JSX.Element {
  return (
    <Dialog
      description="Каждая обычная учётная запись уникально связана с активным сотрудником. Встроенный superadmin управляется отдельно."
      onOpenChange={onOpenChange}
      open={open}
      title={draft.id ? "Редактировать пользователя" : "Новый пользователь"}
    >
      <div className="grid gap-4">
        <Field label="Сотрудник">
          <Select
            onValueChange={(employeeId) => onChange({ ...draft, employeeId })}
            options={employeeOptions}
            placeholder="Выберите активного сотрудника"
            value={draft.employeeId}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Логин">
            <Input
              autoComplete="off"
              onChange={(event) => onChange({ ...draft, username: event.target.value })}
              placeholder="farid.karimov"
              value={draft.username}
            />
          </Field>
          <Field label="Статус">
            <Select
              onValueChange={(status) =>
                onChange({ ...draft, status: status as AccessUserStatus })
              }
              options={statusOptions}
              value={draft.status}
            />
          </Field>
        </div>
        <Field label={draft.id ? "Новый пароль — необязательно" : "Временный пароль"}>
          <Input
            autoComplete="new-password"
            onChange={(event) => onChange({ ...draft, password: event.target.value })}
            placeholder="Минимум 8 символов, буква и цифра"
            type="password"
            value={draft.password}
          />
        </Field>

        <label className="app-surface-muted app-border flex cursor-pointer items-center gap-3 rounded-2xl border p-4">
          <input
            checked={draft.mustChangePassword}
            className="h-4 w-4 accent-[var(--accent)]"
            onChange={(event) =>
              onChange({ ...draft, mustChangePassword: event.target.checked })
            }
            type="checkbox"
          />
          <span>
            <span className="app-text block text-sm font-black">Потребовать смену пароля</span>
            <span className="app-muted mt-1 block text-xs">
              Рекомендуется для всех временных паролей.
            </span>
          </span>
        </label>

        <div>
          <p className="app-text text-sm font-black">Роли пользователя</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {roles.map((role) => {
              const checked = draft.roleIds.includes(role.id);
              return (
                <label className="app-surface-muted app-border cursor-pointer rounded-2xl border p-4" key={role.id}>
                  <div className="flex items-start gap-3">
                    <input
                      checked={checked}
                      className="mt-1 h-4 w-4 accent-[var(--accent)]"
                      onChange={() =>
                        onChange({
                          ...draft,
                          roleIds: checked
                            ? draft.roleIds.filter((roleId) => roleId !== role.id)
                            : [...draft.roleIds, role.id],
                        })
                      }
                      type="checkbox"
                    />
                    <span>
                      <span className="app-text block text-sm font-black">{role.name}</span>
                      <span className="app-muted mt-1 block text-xs leading-5">
                        {scopeLabel(role.scopeType)} · {role.permissionCodes.length} разрешений
                      </span>
                    </span>
                  </div>
                </label>
              );
            })}
          </div>
          <p className="app-muted mt-3 text-xs leading-5">
            Руководящие системные роли привязаны к фактическим назначениям в оргструктуре и синхронизируются автоматически.
          </p>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button disabled={isSaving} onClick={onSave}>
            Сохранить пользователя
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function AccessMetric({ icon, label, value }: { icon: JSX.Element; label: string; value: number }): JSX.Element {
  return (
    <div className="app-surface app-border flex items-center gap-4 rounded-[22px] border p-5">
      <span className="app-accent-soft flex h-11 w-11 items-center justify-center rounded-2xl border [&>svg]:h-5 [&>svg]:w-5">
        {icon}
      </span>
      <div>
        <p className="app-muted text-xs font-black uppercase tracking-[0.12em]">{label}</p>
        <p className="app-text mt-1 text-2xl font-black">{value}</p>
      </div>
    </div>
  );
}

function TabButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}): JSX.Element {
  return (
    <button
      className={[
        "inline-flex min-h-14 items-center gap-2 border-b-2 px-4 text-sm font-black transition",
        active
          ? "border-[var(--accent)] text-[var(--accent)]"
          : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]",
      ].join(" ")}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}


function StatusBadge({ status }: { status: AccessUserStatus }): JSX.Element {
  return (
    <span
      className={[
        "inline-flex rounded-full border px-2.5 py-1 text-[11px] font-black",
        status === "active"
          ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
          : "app-surface app-border app-muted",
      ].join(" ")}
    >
      {status === "active" ? "Активен" : "Заблокирован"}
    </span>
  );
}

function Field({ children, label }: { children: React.ReactNode; label: string }): JSX.Element {
  return (
    <label className="grid gap-2">
      <span className="app-text text-sm font-black">{label}</span>
      {children}
    </label>
  );
}

function scopeLabel(scope: AccessScopeType): string {
  return scopeOptions.find((option) => option.value === scope)?.label ?? scope;
}

function groupPermissions(
  permissions: AccessPermission[],
): Array<[string, AccessPermission[]]> {
  const groups = new Map<string, AccessPermission[]>();
  for (const permission of permissions) {
    groups.set(permission.module, [...(groups.get(permission.module) ?? []), permission]);
  }
  return [...groups.entries()];
}

async function loadEmployees(): Promise<EmployeeOption[]> {
  const records: HrRecord[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const result = await hrApiClient.list({
      entity: "employees",
      page,
      pageSize: 100,
      filters: { status: { operator: "equals", value: "active" } },
      orderBy: "last_name",
      orderDirection: "asc",
    });
    records.push(...result.items);
    totalPages = result.totalPages;
    page += 1;
  } while (page <= totalPages);

  const departmentIds = [...new Set(records.map((record) => Number(record.department_id)).filter(Number.isFinite))];
  const departmentMap = new Map<number, { name: string; enterpriseId: number }>();
  for (const departmentId of departmentIds) {
    const department = await hrApiClient.getById({ entity: "departments", id: departmentId });
    if (department) {
      departmentMap.set(departmentId, {
        name: String(department.name ?? ""),
        enterpriseId: Number(department.enterprise_id ?? 0),
      });
    }
  }

  const enterpriseIds = [...new Set([...departmentMap.values()].map((item) => item.enterpriseId).filter(Boolean))];
  const enterpriseMap = new Map<number, string>();
  for (const enterpriseId of enterpriseIds) {
    const enterprise = await hrApiClient.getById({ entity: "enterprises", id: enterpriseId });
    if (enterprise) enterpriseMap.set(enterpriseId, String(enterprise.name ?? ""));
  }

  return records.map((record) => {
    const department = departmentMap.get(Number(record.department_id));
    const fullName = [record.last_name, record.first_name, record.middle_name]
      .map((value) => String(value ?? "").trim())
      .filter(Boolean)
      .join(" ");
    return {
      value: String(record.id),
      label: fullName || `Сотрудник #${record.id}`,
      departmentName: department?.name ?? "",
      enterpriseName: enterpriseMap.get(department?.enterpriseId ?? 0) ?? "",
    };
  });
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback;
  const marker = "Error: ";
  const index = error.message.lastIndexOf(marker);
  return index >= 0 ? error.message.slice(index + marker.length) : error.message || fallback;
}
