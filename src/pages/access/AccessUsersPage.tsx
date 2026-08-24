import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiEdit2,
  FiKey,
  FiLock,
  FiPlus,
  FiRefreshCw,
  FiShield,
  FiTrash2,
  FiUserCheck,
  FiUsers,
} from "react-icons/fi";
import { toast } from "react-toastify";

import { useAuth } from "../../features/auth/AuthContext";
import { legacyPermissionCodes } from "../../shared/access/permissionRules";
import { hrApiClient } from "../../shared/lib/hrApiClient";
import type {
  AccessRoleSummary,
  AccessScopeType,
  AccessUserSummary,
  SaveAccessUserParams,
  SystemAdminSummary,
} from "../../shared/types/access";
import {
  Button,
  ConfirmDialog,
  DataTable,
  Dialog,
  IconButton,
  Input,
  PageHeader,
  type DataTableColumn,
} from "../../shared/ui";
import {
  AccessMetric,
  Field,
  StatusBadge,
  UserDialog,
  emptyUserDraft,
  getErrorMessage,
  loadEmployees,
  type EmployeeOption,
  type UserDraft,
} from "./AccessControlShared";

const emptySystemAdmin: SystemAdminSummary = {
  id: 1,
  username: "superadmin",
  mustChangePassword: false,
  lastLoginAt: null,
  createdAt: "",
  updatedAt: "",
};

type UserRow =
  | { kind: "system"; id: string; admin: SystemAdminSummary }
  | { kind: "user"; id: string; user: AccessUserSummary };

export function AccessUsersPage(): JSX.Element {
  const { hasPermission, session } = useAuth();
  const canCreate = hasPermission("users.create");
  const canEdit = hasPermission("users.edit");
  const canDelete = hasPermission("users.delete");
  const canResetPassword = hasPermission("users.reset_password");
  const hasActions = canEdit || canDelete || canResetPassword;
  const isSuperadmin =
    session.employeeId === 0 ||
    session.roles.some((role) => role.systemKey === "superadmin");
  const [users, setUsers] = useState<AccessUserSummary[]>([]);
  const [roles, setRoles] = useState<AccessRoleSummary[]>([]);
  const [systemAdmin, setSystemAdmin] = useState<SystemAdminSummary>(emptySystemAdmin);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [userDraft, setUserDraft] = useState<UserDraft>(emptyUserDraft);
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [passwordDialogUser, setPasswordDialogUser] =
    useState<AccessUserSummary | null>(null);
  const [password, setPassword] = useState("");
  const [deleteUser, setDeleteUser] = useState<AccessUserSummary | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [accessUsers, accessRoles, admin] = await Promise.all([
        hrApiClient.listAccessUsers(),
        hrApiClient.listAccessRoles(),
        hrApiClient.getAccessSystemAdmin(),
      ]);
      setUsers(accessUsers);
      setRoles(accessRoles);
      setSystemAdmin(admin);

      if (canCreate || canEdit) {
        try {
          setEmployees(await loadEmployees());
        } catch (error) {
          setEmployees([]);
          toast.error(
            getErrorMessage(
              error,
              "Не удалось загрузить сотрудников для конструктора пользователя",
            ),
          );
        }
      } else {
        setEmployees([]);
      }
    } catch (error) {
      toast.error(getErrorMessage(error, "Не удалось загрузить пользователей"));
    } finally {
      setIsLoading(false);
    }
  }, [canCreate, canEdit]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const refreshConstructorData = useCallback(async (): Promise<
    AccessRoleSummary[] | null
  > => {
    try {
      const [freshRoles, freshEmployees] = await Promise.all([
        hrApiClient.listAccessRoles(),
        loadEmployees(),
      ]);
      setRoles(freshRoles);
      setEmployees(freshEmployees);
      return freshRoles;
    } catch (error) {
      toast.error(
        getErrorMessage(
          error,
          "Не удалось обновить роли и сотрудников для конструктора пользователя",
        ),
      );
      return null;
    }
  }, []);

  const availableEmployeeOptions = useMemo(() => {
    const currentEmployeeId = userDraft.id
      ? users.find((user) => user.id === userDraft.id)?.employeeId
      : null;
    const occupiedEmployeeIds = new Set(
      users
        .filter((user) => user.employeeId !== currentEmployeeId)
        .map((user) => user.employeeId),
    );
    return employees.filter(
      (employee) => !occupiedEmployeeIds.has(Number(employee.value)),
    );
  }, [employees, userDraft.id, users]);

  const assignableRoles = useMemo(
    () =>
      getAssignableRoles(
        roles,
        isSuperadmin,
        session.permissionScopes,
      ),
    [isSuperadmin, roles, session.permissionScopes],
  );
  const assignableRoleIds = useMemo(
    () => new Set(assignableRoles.map((role) => role.id)),
    [assignableRoles],
  );
  const automaticRoleIds = useMemo(() => {
    if (!userDraft.id) return new Set<number>();
    const currentUser = users.find((user) => user.id === userDraft.id);
    return new Set(
      (currentUser?.roles ?? [])
        .filter(
          (role) =>
            role.systemKey === "enterprise_director" ||
            role.systemKey === "department_head",
        )
        .map((role) => role.id),
    );
  }, [userDraft.id, users]);

  const rows: UserRow[] = [
    { kind: "system", id: "system-superadmin", admin: systemAdmin },
    ...users.map((user) => ({
      kind: "user" as const,
      id: String(user.id),
      user,
    })),
  ];

  async function openCreateUser(): Promise<void> {
    if (!canCreate) return;
    const freshRoles = await refreshConstructorData();
    if (!freshRoles) return;
    setUserDraft(emptyUserDraft);
    setUserDialogOpen(true);
  }

  async function openEditUser(user: AccessUserSummary): Promise<void> {
    if (!canEdit) return;
    const freshRoles = await refreshConstructorData();
    if (!freshRoles) return;

    const freshAssignableRoleIds = new Set(
      getAssignableRoles(
        freshRoles,
        isSuperadmin,
        session.permissionScopes,
      ).map((role) => role.id),
    );
    const manualRoles = user.roles.filter(
      (role) =>
        role.systemKey !== "enterprise_director" &&
        role.systemKey !== "department_head" &&
        role.systemKey !== "superadmin",
    );
    const forbiddenRole = manualRoles.find(
      (role) => !freshAssignableRoleIds.has(role.id),
    );
    if (forbiddenRole) {
      toast.error(
        `Нельзя редактировать назначение: роль «${forbiddenRole.name}» содержит права выше ваших`,
      );
      return;
    }
    setUserDraft({
      id: user.id,
      employeeId: String(user.employeeId),
      username: user.username,
      status: user.status,
      roleIds: manualRoles.map((role) => role.id),
      password: "",
      mustChangePassword: user.mustChangePassword,
    });
    setUserDialogOpen(true);
  }

  async function saveUser(): Promise<void> {
    if (userDraft.id ? !canEdit : !canCreate) return;
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

  async function confirmDeleteUser(): Promise<void> {
    if (!deleteUser || !canDelete) return;
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
    if (!passwordDialogUser || !canResetPassword) return;
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

  function renderUserActions(user: AccessUserSummary): JSX.Element | undefined {
    if (!hasActions) return undefined;
    return (
      <>
        {canResetPassword && (
          <IconButton
            icon={<FiKey />}
            label="Сбросить пароль"
            onClick={() => {
              setPassword("");
              setPasswordDialogUser(user);
            }}
            size="sm"
          />
        )}
        {canEdit && (
          <IconButton
            icon={<FiEdit2 />}
            label="Редактировать"
            onClick={() => void openEditUser(user)}
            size="sm"
          />
        )}
        {canDelete && (
          <IconButton
            icon={<FiTrash2 />}
            label="Удалить"
            onClick={() => setDeleteUser(user)}
            size="sm"
            tone="danger"
          />
        )}
      </>
    );
  }

  const columns: DataTableColumn<UserRow>[] = [
    {
      key: "account",
      header: "Учётная запись",
      render: (row) =>
        row.kind === "system" ? (
          <div className="flex min-w-[210px] items-center gap-3">
            <span className="app-accent-soft flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border">
              <FiShield className="h-5 w-5" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="app-text font-black">Системный администратор</span>
                <span className="app-accent-soft app-accent-text rounded-full px-2 py-0.5 text-[10px] font-black">
                  Встроенная
                </span>
              </div>
              <p className="app-accent-text mt-1 text-xs font-black">
                @{row.admin.username}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex min-w-[210px] items-center gap-3">
            <span className="app-accent-soft flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border">
              <FiUserCheck className="h-5 w-5" />
            </span>
            <div>
              <p className="app-text font-black">{row.user.employeeName}</p>
              <p className="app-accent-text mt-1 text-xs font-black">
                @{row.user.username}
              </p>
            </div>
          </div>
        ),
    },
    {
      key: "structure",
      header: "Структура",
      render: (row) =>
        row.kind === "system" ? (
          <span className="app-muted text-sm">Не связан с сотрудником</span>
        ) : (
          <div className="min-w-[180px]">
            <p className="app-text-soft text-sm font-semibold">
              {row.user.employeeName}
            </p>
            <p className="app-muted mt-1 text-xs">
              {[row.user.enterpriseName, row.user.departmentName]
                .filter(Boolean)
                .join(" · ") || "—"}
            </p>
          </div>
        ),
    },
    {
      key: "status",
      header: "Статус",
      render: (row) =>
        row.kind === "system" ? (
          <StatusBadge status="active" />
        ) : (
          <StatusBadge status={row.user.status} />
        ),
    },
    {
      key: "roles",
      header: "Роли",
      render: (row) => (
        <div className="flex max-w-[280px] flex-wrap gap-1.5">
          {row.kind === "system" ? (
            <span className="app-surface-muted app-border rounded-full border px-2.5 py-1 text-xs font-bold">
              Superadmin
            </span>
          ) : row.user.roles.length > 0 ? (
            row.user.roles.slice(0, 3).map((role) => (
              <span
                className="app-surface-muted app-border rounded-full border px-2.5 py-1 text-xs font-bold"
                key={role.id}
              >
                {role.name}
              </span>
            ))
          ) : (
            <span className="app-muted text-xs">Нет ролей</span>
          )}
          {row.kind === "user" && row.user.roles.length > 3 && (
            <span className="app-muted text-xs font-bold">
              +{row.user.roles.length - 3}
            </span>
          )}
        </div>
      ),
    },
    {
      key: "access",
      header: "Доступ",
      render: (row) =>
        row.kind === "system" ? (
          <div>
            <p className="app-text font-bold">Полный системный доступ</p>
            <p className="app-muted mt-1 text-xs">
              Пароль: {row.admin.mustChangePassword ? "требуется смена" : "установлен"}
            </p>
          </div>
        ) : (
          <div>
            <p className="app-text font-bold">
              {row.user.effectivePermissionCodes.length} разрешений
            </p>
            {row.user.mustChangePassword && (
              <p className="mt-1 text-xs font-semibold text-amber-600 dark:text-amber-300">
                Требуется смена пароля
              </p>
            )}
          </div>
        ),
    },
    ...(hasActions
      ? [
          {
            key: "actions",
            header: "Действия",
            align: "center" as const,
            render: (row: UserRow) =>
              row.kind === "system" ? (
                <span className="app-muted text-xs font-semibold">Системная</span>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  {renderUserActions(row.user)}
                </div>
              ),
          },
        ]
      : []),
  ];

  const activeUsers = users.filter((user) => user.status === "active").length + 1;
  const blockedUsers = users.filter((user) => user.status === "blocked").length;

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          canCreate ? (
            <Button
              className="border-white/20 shadow-xl hover:opacity-90"
              leftIcon={<FiPlus className="h-4 w-4" />}
              onClick={() => void openCreateUser()}
              style={{ background: "#ffffff", color: "#0f172a" }}
              variant="ghost"
            >
              Добавить пользователя
            </Button>
          ) : undefined
        }
        description="Учётные записи сотрудников, назначенные роли и состояние доступа к системе."
        icon={<FiUsers />}
        title="Пользователи"
      />

      <section className="grid gap-4 sm:grid-cols-3">
        <AccessMetric icon={<FiUsers />} label="Учётные записи" value={rows.length} />
        <AccessMetric icon={<FiUserCheck />} label="Активные" value={activeUsers} />
        <AccessMetric icon={<FiLock />} label="Заблокированные" value={blockedUsers} />
      </section>

      <DataTable
        ariaLabel="Пользователи системы"
        card={{
          leading: (row) =>
            row.kind === "system" ? (
              <FiShield className="h-5 w-5" />
            ) : (
              <FiUserCheck className="h-5 w-5" />
            ),
          title: (row) =>
            row.kind === "system" ? "Системный администратор" : row.user.employeeName,
          meta: (row) =>
            row.kind === "system" ? (
              <>
                <span className="app-text-soft">@{row.admin.username}</span>
                <StatusBadge status="active" />
                <span className="app-text-soft">Superadmin</span>
              </>
            ) : (
              <>
                <span className="app-text-soft">@{row.user.username}</span>
                <StatusBadge status={row.user.status} />
                <span className="app-text-soft">
                  {[row.user.enterpriseName, row.user.departmentName]
                    .filter(Boolean)
                    .join(" · ") || "Структура не указана"}
                </span>
                <span className="app-text-soft">
                  Ролей: {row.user.roles.length}
                </span>
              </>
            ),
          actions: (row) =>
            row.kind === "user" ? renderUserActions(row.user) : undefined,
        }}
        columns={columns}
        emptyDescription={
          canCreate
            ? "Создайте учётную запись и свяжите её с активным сотрудником."
            : "Учётных записей пока нет."
        }
        emptyTitle="Пользователей пока нет"
        footer={
          <>
            Учётных записей: <span className="app-text font-black">{rows.length}</span>
          </>
        }
        getRowKey={(row) => row.id}
        isLoading={isLoading}
        loadingLabel="Загрузка пользователей..."
        rows={rows}
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

      {(canCreate || canEdit) && (
        <UserDialog
          assignableRoleIds={assignableRoleIds}
          automaticRoleIds={automaticRoleIds}
          draft={userDraft}
          employeeOptions={availableEmployeeOptions}
          isSaving={isSaving}
          onChange={setUserDraft}
          onOpenChange={setUserDialogOpen}
          onSave={() => void saveUser()}
          open={userDialogOpen}
          roles={roles}
        />
      )}

      {canResetPassword && (
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
      )}

      {canDelete && (
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
      )}
    </div>
  );
}

function getAssignableRoles(
  roles: AccessRoleSummary[],
  isSuperadmin: boolean,
  permissionScopes: Record<string, AccessScopeType>,
): AccessRoleSummary[] {
  return roles.filter((role) => {
    if (role.systemKey === "superadmin") return false;
    if (
      role.systemKey === "enterprise_director" ||
      role.systemKey === "department_head"
    ) {
      return false;
    }
    if (role.systemKey === "employee") return true;
    if (isSuperadmin) return true;
    return role.permissionCodes
      .filter((code) => !legacyPermissionCodes.has(code))
      .every((code) => permissionScopes[code] === "global");
  });
}
