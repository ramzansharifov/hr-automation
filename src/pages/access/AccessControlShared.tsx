/* eslint-disable react-refresh/only-export-components */
import type { ReactNode } from "react";

import type {
  AccessRoleSummary,
  AccessUserStatus,
} from "../../shared/types/access";
import {
  Button,
  Dialog,
  Input,
  SearchableSelect,
  Select,
  Toggle,
} from "../../shared/ui";
import {
  statusOptions,
  type EmployeeOption,
  type UserDraft,
} from "./accessControlData";

export {
  emptyUserDraft,
  getErrorMessage,
  loadEmployees,
} from "./accessControlData";
export type { EmployeeOption, UserDraft } from "./accessControlData";

export function UserDialog({
  assignableRoleIds,
  automaticRoleIds,
  draft,
  employeeOptions,
  isSaving,
  onChange,
  onOpenChange,
  onSave,
  open,
  roles,
}: {
  assignableRoleIds: Set<number>;
  automaticRoleIds: Set<number>;
  draft: UserDraft;
  employeeOptions: EmployeeOption[];
  isSaving: boolean;
  onChange: (draft: UserDraft) => void;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
  open: boolean;
  roles: AccessRoleSummary[];
}): JSX.Element {
  const selectedEmployee = employeeOptions.find(
    (employee) => employee.value === draft.employeeId,
  );

  return (
    <Dialog
      description="Учётная запись связывается с актуальным сотрудником из кадровой базы. Роли загружаются из текущего конструктора ролей."
      onOpenChange={onOpenChange}
      open={open}
      title={draft.id ? "Редактировать пользователя" : "Новый пользователь"}
    >
      <div className="grid gap-4">
        <Field label="Сотрудник">
          <SearchableSelect
            ariaLabel="Выберите сотрудника"
            noOptionsLabel="Подходящие сотрудники не найдены"
            onValueChange={(employeeId) => onChange({ ...draft, employeeId })}
            options={employeeOptions}
            placeholder="Выберите активного сотрудника"
            searchPlaceholder="Поиск по ФИО, предприятию или отделу..."
            value={draft.employeeId}
          />
        </Field>
        <p className="app-muted -mt-2 text-xs leading-5">
          Показываются активные сотрудники без другой учётной записи. Список обновляется из кадрового реестра при открытии конструктора.
        </p>
        {selectedEmployee && (
          <div className="app-surface-muted app-border -mt-1 rounded-2xl border px-4 py-3">
            <p className="app-text text-sm font-black">{selectedEmployee.fullName}</p>
            <p className="app-muted mt-1 text-xs">
              {[selectedEmployee.enterpriseName, selectedEmployee.departmentName]
                .filter(Boolean)
                .join(" · ") || "Организационная структура не указана"}
            </p>
          </div>
        )}

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

        <div className="app-surface-muted app-border flex items-center justify-between gap-4 rounded-2xl border p-4">
          <span className="min-w-0">
            <span className="app-text block text-sm font-black">
              Потребовать смену пароля
            </span>
            <span className="app-muted mt-1 block text-xs leading-5">
              Рекомендуется для всех временных паролей.
            </span>
          </span>
          <Toggle
            ariaLabel="Потребовать смену пароля"
            checked={draft.mustChangePassword}
            onCheckedChange={(mustChangePassword) =>
              onChange({ ...draft, mustChangePassword })
            }
          />
        </div>

        <div>
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="app-text text-sm font-black">Роли пользователя</p>
              <p className="app-muted mt-1 text-xs">
                Данные берутся из актуального списка ролей приложения.
              </p>
            </div>
            <span className="app-muted shrink-0 text-xs font-bold">
              {roles.length} ролей
            </span>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {roles.map((role) => {
              const isLeadershipRole =
                role.systemKey === "enterprise_director" ||
                role.systemKey === "department_head";
              const isBuiltInSuperadmin = role.systemKey === "superadmin";
              const canToggle = assignableRoleIds.has(role.id);
              const checked = isLeadershipRole
                ? automaticRoleIds.has(role.id)
                : draft.roleIds.includes(role.id);
              const disabled = !canToggle;
              const description = isBuiltInSuperadmin
                ? "Только для встроенной системной учётной записи"
                : isLeadershipRole
                  ? checked
                    ? "Назначена автоматически по оргструктуре"
                    : "Назначается автоматически по оргструктуре"
                  : !canToggle
                    ? "Недоступна: роль содержит права выше ваших"
                    : `${role.permissionCodes.length} разрешений${role.isSystem ? " · системная роль" : ""}`;

              return (
                <div
                  className={[
                    "app-surface-muted app-border flex min-h-[84px] items-center justify-between gap-4 rounded-2xl border p-4 transition",
                    disabled ? "opacity-70" : "hover:border-[var(--accent-border)]",
                  ].join(" ")}
                  key={role.id}
                >
                  <span className="min-w-0">
                    <span className="app-text block text-sm font-black">
                      {role.name}
                    </span>
                    <span className="app-muted mt-1 block text-xs leading-5">
                      {description}
                    </span>
                  </span>
                  <Toggle
                    ariaLabel={`Роль ${role.name}`}
                    checked={checked}
                    disabled={disabled}
                    onCheckedChange={(nextChecked) => {
                      if (!canToggle) return;
                      onChange({
                        ...draft,
                        roleIds: nextChecked
                          ? [...new Set([...draft.roleIds, role.id])]
                          : draft.roleIds.filter((roleId) => roleId !== role.id),
                      });
                    }}
                  />
                </div>
              );
            })}
          </div>

          {roles.length === 0 && (
            <div className="app-surface-muted app-muted mt-3 rounded-2xl p-5 text-center text-sm font-semibold">
              В приложении пока нет доступных ролей.
            </div>
          )}

          <p className="app-muted mt-3 text-xs leading-5">
            Роли руководителя предприятия и руководителя отдела определяются фактическим назначением в оргструктуре и не переключаются вручную.
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
