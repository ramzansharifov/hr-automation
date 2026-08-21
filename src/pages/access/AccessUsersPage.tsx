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

import { hrApiClient } from "../../shared/lib/hrApiClient";
import type {
  AccessControlOverview,
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

type UserRow =
  | { kind: "system"; id: string; admin: SystemAdminSummary }
  | { kind: "user"; id: string; user: AccessUserSummary };

export function AccessUsersPage(): JSX.Element {
  const [overview, setOverview] = useState<AccessControlOverview>(emptyOverview);
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
      const [accessOverview, employeeOptions] = await Promise.all([
        hrApiClient.getAccessOverview(),
        loadEmployees(),
      ]);
      setOverview(accessOverview);
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
      ? overview.users.find((user) => user.id === userDraft.id)?.employeeId
      : null;
    const occupiedEmployeeIds = new Set(
      overview.users
        .filter((user) => user.employeeId !== currentEmployeeId)
        .map((user) => user.employeeId),
    );
    return employees.filter(
      (employee) => !occupiedEmployeeIds.has(Number(employee.value)),
    );
  }, [employees, overview.users, userDraft.id]);

  const assignableRoles = useMemo(
    () => overview.roles.filter((role) => role.systemKey !== "superadmin"),
    [overview.roles],
  );

  const rows: UserRow[] = [
    { kind: "system", id: "system-superadmin", admin: overview.systemAdmin },
    ...overview.users.map((user) => ({
      kind: "user" as const,
      id: String(user.id),
      user,
    })),
  ];

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

  function renderUserActions(user: AccessUserSummary): JSX.Element {
    return (
      <>
        <IconButton
          icon={<FiKey />}
          label="Сбросить пароль"
          onClick={() => {
            setPassword("");
            setPasswordDialogUser(user);
          }}
          size="sm"
        />
        <IconButton
          icon={<FiEdit2 />}
          label="Редактировать"
          onClick={() => openEditUser(user)}
          size="sm"
        />
        <IconButton
          icon={<FiTrash2 />}
          label="Удалить"
          onClick={() => setDeleteUser(user)}
          size="sm"
          tone="danger"
        />
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
    {
      key: "actions",
      header: "Действия",
      align: "center",
      render: (row) =>
        row.kind === "system" ? (
          <span className="app-muted text-xs font-semibold">Системная</span>
        ) : (
          <div className="flex items-center justify-center gap-2">
            {renderUserActions(row.user)}
          </div>
        ),
    },
  ];

  const activeUsers = overview.users.filter((user) => user.status === "active").length + 1;
  const blockedUsers = overview.users.filter((user) => user.status === "blocked").length;

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <Button
            className="border-white/20 shadow-xl hover:opacity-90"
            leftIcon={<FiPlus className="h-4 w-4" />}
            onClick={openCreateUser}
            style={{ background: "#ffffff", color: "#0f172a" }}
            variant="ghost"
          >
            Добавить пользователя
          </Button>
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
        emptyDescription="Создайте учётную запись и свяжите её с активным сотрудником."
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
    </div>
  );
}
