import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiUserCheck,
  FiUsers,
} from "react-icons/fi";
import { toast } from "react-toastify";

import { useAuth } from "../../features/auth/AuthContext";
import { useAppText } from "../../shared/i18n";
import { hrApiClient } from "../../shared/lib/hrApiClient";
import type {
  AccessRoleSummary,
  AccessUserSummary,
  SaveAccessUserParams,
} from "../../shared/types/access";
import {
  ActionButton,
  ActionIconButton,
  DataTable,
  DeleteConfirmDialog,
  Dialog,
  Input,
  PageHeader,
  RecordActions,
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
import { accessRoleName } from "./accessTranslations";

export function ScopedAccessUsersPage(): JSX.Element {
  const text = useAppText();
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
      ? text(
          `Отдел · ${session.departmentName || "не указан"}`,
          `Department · ${session.departmentName || "not specified"}`,
        )
      : text(
          `Предприятие · ${session.enterpriseName || "не указано"}`,
          `Enterprise · ${session.enterpriseName || "not specified"}`,
        );
  const scopeDescription =
    permissionScope === "department"
      ? text(
          "Здесь отображаются и управляются только учётные записи сотрудников вашего отдела.",
          "Only employee accounts from your department are displayed and managed here.",
        )
      : text(
          "Здесь отображаются и управляются только учётные записи сотрудников вашего предприятия.",
          "Only employee accounts from your enterprise are displayed and managed here.",
        );

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
      toast.error(getErrorMessage(error, text("Не удалось загрузить пользователей", "Failed to load users")));
    } finally {
      setIsLoading(false);
    }
  }, [text]);

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
      toast.success(userDraft.id ? text("Пользователь обновлён", "User updated") : text("Пользователь создан", "User created"));
      setUserDialogOpen(false);
      await loadData();
    } catch (error) {
      toast.error(getErrorMessage(error, text("Не удалось сохранить пользователя", "Failed to save user")));
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
      toast.success(text("Временный пароль установлен", "Temporary password set"));
      await loadData();
    } catch (error) {
      toast.error(getErrorMessage(error, text("Не удалось изменить пароль", "Failed to change password")));
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
      toast.success(text("Пользователь удалён", "User deleted"));
      await loadData();
    } catch (error) {
      toast.error(getErrorMessage(error, text("Не удалось удалить пользователя", "Failed to delete user")));
    } finally {
      setIsSaving(false);
    }
  }

  function renderActions(user: AccessUserSummary): JSX.Element | undefined {
    const isSelf = user.id === session.userId;
    if (!canEdit && !canDelete && !canResetPassword) return undefined;

    return (
      <RecordActions
        deleteLabel={text("Удалить пользователя", "Delete user")}
        editLabel={text("Редактировать пользователя", "Edit user")}
        onDelete={
          canDelete && !isSelf ? () => setDeleteUser(user) : undefined
        }
        onEdit={canEdit ? () => openEditUser(user) : undefined}
      >
        {canResetPassword && !isSelf && (
          <ActionIconButton
            action="passwordReset"
            label={text("Сбросить пароль", "Reset password")}
            onClick={() => {
              setPassword("");
              setPasswordDialogUser(user);
            }}
            size="sm"
          />
        )}
      </RecordActions>
    );
  }

  const columns: DataTableColumn<AccessUserSummary>[] = [
    {
      key: "employee",
      header: text("Сотрудник", "Employee"),
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
      header: text("Оргструктура", "Organization"),
      render: (user) => (
        <div className="min-w-[180px]">
          <p className="app-text-soft text-sm font-semibold">
            {user.departmentName || text("Отдел не указан", "Department not specified")}
          </p>
          <p className="app-muted mt-1 text-xs">
            {user.enterpriseName || text("Предприятие не указано", "Enterprise not specified")}
          </p>
        </div>
      ),
    },
    {
      key: "roles",
      header: text("Роли", "Roles"),
      render: (user) => (
        <div className="flex max-w-[320px] flex-wrap gap-1.5">
          {user.roles.length > 0 ? (
            user.roles.slice(0, 3).map((role) => (
              <span
                className="app-surface-muted app-border rounded-full border px-2.5 py-1 text-xs font-bold"
                key={role.id}
              >
                {accessRoleName(role.systemKey, role.name, text)}
              </span>
            ))
          ) : (
            <span className="app-muted text-xs">{text("Нет ролей", "No roles")}</span>
          )}
          {user.roles.length > 3 && (
            <span className="app-muted text-xs font-bold">+{user.roles.length - 3}</span>
          )}
        </div>
      ),
    },
    {
      key: "status",
      header: text("Статус", "Status"),
      render: (user) => <StatusBadge status={user.status} />,
    },
    {
      key: "actions",
      header: text("Действия", "Actions"),
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
            <ActionButton
              action="create"
              onClick={() => void openCreateUser()}
            >
              {text("Добавить пользователя", "Add user")}
            </ActionButton>
          ) : undefined
        }
        description={text(
          `${scopeDescription} Системные роли администраторов сохраняются отдельно и не могут быть перераспределены локальным администратором.`,
          `${scopeDescription} System administrator roles are maintained separately and cannot be reassigned by a local administrator.`,
        )}
        eyebrow={scopeTitle}
        icon={<FiUsers />}
        title={text("Пользователи", "Users")}
      />

      <section className="grid gap-4 sm:grid-cols-3">
        <AccessMetric icon={<FiUsers />} label={text("В области", "In scope")} value={users.length} />
        <AccessMetric icon={<FiUserCheck />} label={text("Активные", "Active")} value={activeUsers} />
        <AccessMetric icon={<FiUsers />} label={text("Заблокированные", "Blocked")} value={blockedUsers} />
      </section>

      <DataTable
        ariaLabel={text("Пользователи области", "Scoped users")}
        card={{
          leading: () => <FiUserCheck className="h-5 w-5" />,
          title: (user) => user.employeeName,
          meta: (user) => (
            <>
              <span className="app-text-soft">@{user.username}</span>
              <StatusBadge status={user.status} />
              <span className="app-text-soft">
                {[user.enterpriseName, user.departmentName].filter(Boolean).join(" · ") ||
                  text("Структура не указана", "Structure not specified")}
              </span>
            </>
          ),
          actions: (user) => renderActions(user),
        }}
        columns={columns}
        emptyDescription={text("В вашей области пока нет учётных записей сотрудников.", "There are no employee accounts in your scope yet.")}
        emptyTitle={text("Пользователей пока нет", "No users yet")}
        footer={
          <>
            {text("Пользователей:", "Users:")} <span className="app-text font-black">{users.length}</span>
          </>
        }
        getRowKey={(user) => user.id}
        isLoading={isLoading}
        loadingLabel={text("Загрузка пользователей...", "Loading users...")}
        rows={users}
        toolbar={
          <ActionButton
            action="refresh"
            loading={isLoading}
            onClick={() => void loadData()}
          />
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
          description={text("После входа пользователь должен будет сменить временный пароль.", "After signing in, the user will be required to change the temporary password.")}
          onOpenChange={(open) => {
            if (!open) {
              setPasswordDialogUser(null);
              setPassword("");
            }
          }}
          open={Boolean(passwordDialogUser)}
          title={text(`Сбросить пароль: ${passwordDialogUser?.username ?? ""}`, `Reset password: ${passwordDialogUser?.username ?? ""}`)}
        >
          <Field label={text("Новый временный пароль", "New temporary password")}>
            <Input
              autoComplete="new-password"
              onChange={(event) => setPassword(event.target.value)}
              placeholder={text("Минимум 8 символов, буква и цифра", "At least 8 characters, including a letter and a number")}
              type="password"
              value={password}
            />
          </Field>
          <div className="mt-5 flex justify-end gap-3">
            <ActionButton
              action="cancel"
              onClick={() => setPasswordDialogUser(null)}
            />
            <ActionButton
              action="passwordReset"
              disabled={!password}
              loading={isSaving}
              onClick={() => void resetPassword()}
            >
              {text("Установить пароль", "Set password")}
            </ActionButton>
          </div>
        </Dialog>
      )}

      {canDelete && (
        <DeleteConfirmDialog
          description={text("Учётная запись будет удалена, кадровая карточка сотрудника сохранится.", "The account will be deleted while the employee HR profile is preserved.")}
          isLoading={isSaving}
          onConfirm={confirmDeleteUser}
          onOpenChange={(open) => !open && setDeleteUser(null)}
          open={Boolean(deleteUser)}
          title={text(`Удалить пользователя ${deleteUser?.username ?? ""}?`, `Delete user ${deleteUser?.username ?? ""}?`)}
        />
      )}
    </div>
  );
}
