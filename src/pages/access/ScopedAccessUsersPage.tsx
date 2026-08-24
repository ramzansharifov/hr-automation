import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiEdit2,
  FiKey,
  FiPlus,
  FiRefreshCw,
  FiTrash2,
  FiUserCheck,
  FiUsers,
} from "react-icons/fi";
import { toast } from "react-toastify";

import { useAuth } from "../../features/auth/AuthContext";
import { hrApiClient } from "../../shared/lib/hrApiClient";
import type {
  AccessRoleSummary,
  AccessUserSummary,
  SaveAccessUserParams,
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

export function ScopedAccessUsersPage(): JSX.Element {
  const { hasPermission, session } = useAuth();
  const canCreate = hasPermission("users.create");
  const canEdit = hasPermission("users.edit");
  const canDelete = hasPermission("users.delete");
  const canResetPassword = hasPermission("users.reset_password");
  const [users, setUsers] = useState<AccessUserSummary[]>([]);
  const [roles, setRoles] = useState<AccessRoleSummary[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [userDraft, setUserDraft] = useState<UserDraft>(emptyUserDraft);
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [passwordDialogUser, setPasswordDialogUser] =
    useState<AccessUserSummary | null>(null);
  const [password, setPassword] = useState("");
  const [deleteUser, setDeleteUser] = useState<AccessUserSummary | null>(null);

  const permissionScope = session.permissionScopes["users.view"];
  const scopeTitle =
    permissionScope === "department"
      ? `Отдел · ${session.departmentName || "не указан"}`
      : `Предприятие · ${session.enterpriseName || "не указано"}`;
  const scopeDescription =
    permissionScope === "department"
      ? "Здесь отображаются и управляются только учётные записи сотрудников вашего отдела."
      : "Здесь отображаются и управляются только учётные записи сотрудников вашего предприятия.";

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [accessUsers, accessRoles, employeeOptions] = await Promise.all([
        hrApiClient.listAccessUsers(),
        hrApiClient.listAccessRoles(),
        loadEmployees(),
      ]);
      setUsers(accessUsers);
      setRoles(accessRoles);
      setEmployees(employeeOptions);
    } catch (error) {
      toast.error(getErrorMessage(error, "Не удалось загрузить пользователей"));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

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

  const selectedEmployee = useMemo(
    () =>
      availableEmployeeOptions.find(
        (employee) => employee.value === userDraft.employeeId,
      ) ?? null,
    [availableEmployeeOptions, userDraft.employeeId],
  );

  const dialogRoles = useMemo(
    () =>
      roles.filter(
        (role) =>
          role.systemKey !== "superadmin" &&
          role.systemKey !== "enterprise_admin" &&
          role.systemKey !== "department_admin",
      ),
    [roles],
  );

  const dialogRoleIds = useMemo(
    () => new Set(dialogRoles.map((role) => role.id)),
    [dialogRoles],
  );

  const assignableRoleIds = useMemo(() => {
    const result = new Set<number>();
    for (const role of dialogRoles) {
      if (role.systemKey === "employee") {
        result.add(role.id);
        continue;
      }
      if (role.isSystem) continue;
      if (!selectedEmployee) continue;
      if (
        role.scopeType === "enterprise" &&
        role.enterpriseId === selectedEmployee.enterpriseId
      ) {
        result.add(role.id);
      }
      if (
        role.scopeType === "department" &&
        role.departmentId === selectedEmployee.departmentId
      ) {
        result.add(role.id);
      }
    }
    return result;
  }, [dialogRoles, selectedEmployee]);

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

  async function openCreateUser(): Promise<void> {
    if (!canCreate) return;
    setUserDraft(emptyUserDraft);
    setUserDialogOpen(true);
  }

  function openEditUser(user: AccessUserSummary): void {
    if (!canEdit) return;
    const manualRoleIds = user.roles
      .filter(
        (role) =>
          dialogRoleIds.has(role.id) &&
          role.systemKey !== "enterprise_director" &&
          role.systemKey !== "department_head",
      )
      .map((role) => role.id);
    setUserDraft({
      id: user.id,
      employeeId: String(user.employeeId),
      username: user.username,
      status: user.status,
      roleIds: manualRoleIds,
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

  function renderActions(user: AccessUserSummary): JSX.Element | undefined {
    const isSelf = user.id === session.userId;
    if (!canEdit && !canDelete && !canResetPassword) return undefined;
    return (
      <div className="flex items-center justify-center gap-2">
        {canResetPassword && !isSelf && (
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
            onClick={() => openEditUser(user)}
            size="sm"
          />
        )}
        {canDelete && !isSelf && (
          <IconButton
            icon={<FiTrash2 />}
            label="Удалить"
            onClick={() => setDeleteUser(user)}
            size="sm"
            tone="danger"
          />
        )}
      </div>
    );
  }

  const columns: DataTableColumn<AccessUserSummary>[] = [
    {
      key: "employee",
      header: "Сотрудник",
      render: (user) => (
        <div className="flex min-w-[220px] items-center gap-3">
          <span className="app-accent-soft flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border">
            <FiUserCheck className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="app-text truncate font-black">{user.employeeName}</p>
            <p className="app-accent-text mt-1 text-xs font-black">@{user.username}</p>
          </div>
        </div>
      ),
    },
    {
      key: "structure",
      header: "Оргструктура",
      render: (user) => (
        <div className="min-w-[180px]">
          <p className="app-text-soft text-sm font-semibold">
            {user.departmentName || "Отдел не указан"}
          </p>
          <p className="app-muted mt-1 text-xs">
            {user.enterpriseName || "Предприятие не указано"}
          </p>
        </div>
      ),
    },
    {
      key: "roles",
      header: "Роли",
      render: (user) => (
        <div className="flex max-w-[320px] flex-wrap gap-1.5">
          {user.roles.length > 0 ? (
            user.roles.slice(0, 3).map((role) => (
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
          {user.roles.length > 3 && (
            <span className="app-muted text-xs font-bold">+{user.roles.length - 3}</span>
          )}
        </div>
      ),
    },
    {
      key: "status",
      header: "Статус",
      render: (user) => <StatusBadge status={user.status} />,
    },
    {
      key: "actions",
      header: "Действия",
      align: "center",
      render: (user) => renderActions(user),
    },
  ];

  const activeUsers = users.filter((user) => user.status === "active").length;
  const blockedUsers = users.length - activeUsers;

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
        description={`${scopeDescription} Системные роли администраторов сохраняются отдельно и не могут быть перераспределены локальным администратором.`}
        eyebrow={scopeTitle}
        icon={<FiUsers />}
        title="Пользователи"
      />

      <section className="grid gap-4 sm:grid-cols-3">
        <AccessMetric icon={<FiUsers />} label="В области" value={users.length} />
        <AccessMetric icon={<FiUserCheck />} label="Активные" value={activeUsers} />
        <AccessMetric icon={<FiUsers />} label="Заблокированные" value={blockedUsers} />
      </section>

      <DataTable
        ariaLabel="Пользователи области"
        card={{
          leading: () => <FiUserCheck className="h-5 w-5" />,
          title: (user) => user.employeeName,
          meta: (user) => (
            <>
              <span className="app-text-soft">@{user.username}</span>
              <StatusBadge status={user.status} />
              <span className="app-text-soft">
                {[user.enterpriseName, user.departmentName].filter(Boolean).join(" · ") ||
                  "Структура не указана"}
              </span>
            </>
          ),
          actions: (user) => renderActions(user),
        }}
        columns={columns}
        emptyDescription="В вашей области пока нет учётных записей сотрудников."
        emptyTitle="Пользователей пока нет"
        footer={
          <>
            Пользователей: <span className="app-text font-black">{users.length}</span>
          </>
        }
        getRowKey={(user) => user.id}
        isLoading={isLoading}
        loadingLabel="Загрузка пользователей..."
        rows={users}
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
          roles={dialogRoles}
        />
      )}

      {canResetPassword && (
        <Dialog
          description="После входа пользователь должен будет сменить временный пароль."
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
          description="Учётная запись будет удалена, кадровая карточка сотрудника сохранится."
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
