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
} from "../../shared/types/access";
import type { HrRecord } from "../../shared/types/hr";
import {
  Button,
  ConfirmDialog,
  Dialog,
  EmptyState,
  Input,
  LoadingState,
  Select,
  Textarea,
  type SelectOption,
} from "../../shared/ui";

const emptyOverview: AccessControlOverview = {
  permissions: [],
  roles: [],
  users: [],
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
      <header className="app-surface app-border flex flex-col gap-5 rounded-[28px] border p-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <span className="app-accent-soft flex h-12 w-12 items-center justify-center rounded-2xl border">
              <FiShield className="h-6 w-6" />
            </span>
            <div>
              <h1 className="app-text text-2xl font-black tracking-tight sm:text-3xl">
                Роли и пользователи
              </h1>
              <p className="app-muted mt-1 text-sm">
                Учётные записи сотрудников, системные и пользовательские роли, области видимости и разрешения.
              </p>
            </div>
          </div>
        </div>
        <Button
          leftIcon={<FiPlus className="h-4 w-4" />}
          onClick={activeTab === "users" ? openCreateUser : openCreateRole}
        >
          {activeTab === "users" ? "Добавить пользователя" : "Создать роль"}
        </Button>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <AccessMetric icon={<FiUsers />} label="Пользователи" value={overview.users.length} />
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
        roles={overview.roles}
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
  users,
}: {
  onDelete: (user: AccessUserSummary) => void;
  onEdit: (user: AccessUserSummary) => void;
  onResetPassword: (user: AccessUserSummary) => void;
  users: AccessUserSummary[];
}): JSX.Element {
  if (users.length === 0) {
    return (
      <EmptyState
        title="Пользователи ещё не созданы"
        description="Создайте учётную запись и обязательно свяжите её с сотрудником."
      />
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {users.map((user) => (
        <article className="app-surface-muted app-border rounded-[22px] border p-5" key={user.id}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <span className="app-accent-soft flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border">
                <FiUserCheck className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="app-text break-words text-lg font-black">{user.employeeName}</h2>
                  <StatusBadge status={user.status} />
                </div>
                <p className="app-accent-text mt-1 text-sm font-black">@{user.username}</p>
                <p className="app-muted mt-2 text-xs font-semibold">
                  {[user.enterpriseName, user.departmentName].filter(Boolean).join(" · ") ||
                    "Организационная привязка не указана"}
                </p>
              </div>
            </div>
            <div className="flex gap-2 self-end sm:self-auto">
              <IconButton label="Сбросить пароль" onClick={() => onResetPassword(user)}>
                <FiKey />
              </IconButton>
              <IconButton label="Редактировать" onClick={() => onEdit(user)}>
                <FiEdit2 />
              </IconButton>
              <IconButton danger label="Удалить" onClick={() => onDelete(user)}>
                <FiTrash2 />
              </IconButton>
            </div>
          </div>

          <div className="app-border-soft mt-4 border-t pt-4">
            <p className="app-muted text-xs font-black uppercase tracking-[0.12em]">Назначенные роли</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {user.roles.map((role) => (
                <span className="app-surface app-border rounded-full border px-3 py-1 text-xs font-bold" key={role.id}>
                  {role.name}
                </span>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-3 text-xs font-semibold">
              <span className="app-muted">Разрешений: {user.effectivePermissionCodes.length}</span>
              {user.mustChangePassword && (
                <span className="text-amber-600 dark:text-amber-300">Требуется смена пароля</span>
              )}
            </div>
          </div>
        </article>
      ))}
    </div>
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

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {roles.map((role) => (
        <article className="app-surface-muted app-border rounded-[22px] border p-5" key={role.id}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <span className="app-accent-soft flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border">
                <FiShield className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="app-text text-lg font-black">{role.name}</h2>
                  {role.isSystem && (
                    <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] font-black text-indigo-700 dark:border-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
                      Системная
                    </span>
                  )}
                </div>
                <p className="app-muted mt-1 text-sm leading-6">{role.description}</p>
              </div>
            </div>
            {!role.isSystem && (
              <div className="flex gap-2">
                <IconButton label="Редактировать" onClick={() => onEdit(role)}>
                  <FiEdit2 />
                </IconButton>
                <IconButton danger label="Удалить" onClick={() => onDelete(role)}>
                  <FiTrash2 />
                </IconButton>
              </div>
            )}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <RoleMetric label="Область" value={scopeLabel(role.scopeType)} />
            <RoleMetric label="Пользователей" value={String(role.userCount)} />
          </div>

          <div className="app-border-soft mt-4 border-t pt-4">
            <p className="app-muted text-xs font-black uppercase tracking-[0.12em]">
              Разрешения ({role.permissionCodes.length})
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {role.permissionCodes.map((code) => (
                <span className="app-surface app-border inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold" key={code}>
                  <FiCheck className="app-accent-text h-3.5 w-3.5" />
                  {permissionMap.get(code)?.name ?? code}
                </span>
              ))}
            </div>
          </div>
        </article>
      ))}
    </div>
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
      description="Каждая учётная запись обязательно и уникально связана с сотрудником. Пользователь получает объединение разрешений всех назначенных ролей."
      onOpenChange={onOpenChange}
      open={open}
      title={draft.id ? "Редактировать пользователя" : "Новый пользователь"}
    >
      <div className="grid gap-4">
        <Field label="Сотрудник">
          <Select
            onValueChange={(employeeId) => onChange({ ...draft, employeeId })}
            options={employeeOptions}
            placeholder="Выберите сотрудника"
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
            «Директор предприятия» доступен только генеральному директору предприятия, а «Начальник отдела» — сотруднику, назначенному директором отдела.
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

function IconButton({
  children,
  danger = false,
  label,
  onClick,
}: {
  children: React.ReactNode;
  danger?: boolean;
  label: string;
  onClick: () => void;
}): JSX.Element {
  return (
    <button
      aria-label={label}
      className={[
        "app-table-action-button flex h-10 w-10 items-center justify-center rounded-xl border transition [&>svg]:h-4 [&>svg]:w-4",
        danger ? "app-table-action-button--delete" : "",
      ].join(" ")}
      onClick={onClick}
      title={label}
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

function RoleMetric({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="app-surface app-border rounded-2xl border p-4">
      <p className="app-muted text-xs font-bold">{label}</p>
      <p className="app-text mt-1 text-sm font-black">{value}</p>
    </div>
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
