/* eslint-disable react-refresh/only-export-components */
import type { ReactNode } from "react";

import type {
  AccessPermission,
  AccessRoleSummary,
  AccessScopeType,
  AccessUserStatus,
} from "../../shared/types/access";
import {
  Button,
  Dialog,
  Input,
  Select,
  Textarea,
} from "../../shared/ui";
import {
  groupPermissions,
  scopeLabel,
  scopeOptions,
  statusOptions,
  type EmployeeOption,
  type RoleDraft,
  type UserDraft,
} from "./accessControlData";

export {
  emptyRoleDraft,
  emptyUserDraft,
  getErrorMessage,
  loadEmployees,
  scopeLabel,
} from "./accessControlData";
export type { EmployeeOption, RoleDraft, UserDraft } from "./accessControlData";

export function RoleDialog({
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
              <section
                className="app-surface-muted app-border rounded-2xl border p-4"
                key={module}
              >
                <p className="app-text text-sm font-black">{module}</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {modulePermissions.map((permission) => {
                    const checked = draft.permissionCodes.includes(permission.code);
                    return (
                      <label
                        className="app-surface app-border flex cursor-pointer items-start gap-3 rounded-xl border p-3"
                        key={permission.code}
                      >
                        <input
                          checked={checked}
                          className="mt-1 h-4 w-4 accent-[var(--accent)]"
                          onChange={() =>
                            onChange({
                              ...draft,
                              permissionCodes: checked
                                ? draft.permissionCodes.filter(
                                    (code) => code !== permission.code,
                                  )
                                : [...draft.permissionCodes, permission.code],
                            })
                          }
                          type="checkbox"
                        />
                        <span>
                          <span className="app-text block text-sm font-bold">
                            {permission.name}
                          </span>
                          <span className="app-muted mt-1 block text-xs leading-5">
                            {permission.description}
                          </span>
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

export function UserDialog({
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
            <span className="app-text block text-sm font-black">
              Потребовать смену пароля
            </span>
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
                <label
                  className="app-surface-muted app-border cursor-pointer rounded-2xl border p-4"
                  key={role.id}
                >
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
                      <span className="app-text block text-sm font-black">
                        {role.name}
                      </span>
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

export function AccessMetric({
  icon,
  label,
  value,
}: {
  icon: JSX.Element;
  label: string;
  value: number;
}): JSX.Element {
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

export function StatusBadge({ status }: { status: AccessUserStatus }): JSX.Element {
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

export function Field({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}): JSX.Element {
  return (
    <label className="grid gap-2">
      <span className="app-text text-sm font-black">{label}</span>
      {children}
    </label>
  );
}
