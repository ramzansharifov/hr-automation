/* eslint-disable react-refresh/only-export-components */
import type { ReactNode } from "react";

import type {
  AccessRoleSummary,
  AccessUserStatus,
} from "../../shared/types/access";
import { useAppText } from "../../shared/i18n";
import {
  Dialog,
  FormActions,
  Input,
  SearchableSelect,
  Select,
  Toggle,
} from "../../shared/ui";
import {
  type EmployeeOption,
  type UserDraft,
} from "./accessControlData";
import {
  accessRoleName,
  accessUserStatusLabel,
} from "./accessTranslations";

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
  const text = useAppText();
  const localizedStatusOptions = [
    { value: "active", label: text("Активен", "Active") },
    { value: "blocked", label: text("Заблокирован", "Blocked") },
  ];
  const selectedEmployee = employeeOptions.find(
    (employee) => employee.value === draft.employeeId,
  );

  function changeEmployee(employeeId: string): void {
    const employee = employeeOptions.find(
      (option) => option.value === employeeId,
    );
    const incompatibleRoleIds = new Set(
      roles
        .filter(
          (role) =>
            (role.systemKey === "enterprise_admin" &&
              !employee?.enterpriseName) ||
            (role.systemKey === "department_admin" &&
              !employee?.departmentName),
        )
        .map((role) => role.id),
    );

    onChange({
      ...draft,
      employeeId,
      roleIds: draft.roleIds.filter(
        (roleId) => !incompatibleRoleIds.has(roleId),
      ),
    });
  }

  return (
    <Dialog
      description={text("Учётная запись связывается с актуальным сотрудником из кадровой базы. Роли загружаются из текущего конструктора ролей.", "The account is linked to a current employee in the HR database. Roles are loaded from the current role builder.")}
      onOpenChange={onOpenChange}
      open={open}
      title={draft.id ? text("Редактировать пользователя", "Edit user") : text("Новый пользователь", "New user")}
    >
      <div className="grid gap-4">
        <Field label={text("Сотрудник", "Employee")}>
          <SearchableSelect
            ariaLabel={text("Выберите сотрудника", "Select employee")}
            noOptionsLabel={text("Подходящие сотрудники не найдены", "No matching employees found")}
            onValueChange={changeEmployee}
            options={employeeOptions}
            placeholder={text("Выберите активного сотрудника", "Select an active employee")}
            searchPlaceholder={text("Поиск по ФИО, предприятию или отделу...", "Search by name, enterprise, or department...")}
            value={draft.employeeId}
          />
        </Field>
        <p className="app-muted -mt-2 text-xs leading-5">
          {text("Показываются активные сотрудники без другой учётной записи. Список обновляется из кадрового реестра при открытии конструктора.", "Active employees without another account are shown. The list is refreshed from the employee registry when the builder opens.")}
        </p>
        {selectedEmployee && (
          <div className="app-surface-muted app-border -mt-1 rounded-2xl border px-4 py-3">
            <p className="app-text text-sm font-black">{selectedEmployee.fullName}</p>
            <p className="app-muted mt-1 text-xs">
              {[selectedEmployee.enterpriseName, selectedEmployee.departmentName]
                .filter(Boolean)
                .join(" · ") || text("Организационная структура не указана", "Organizational structure is not specified")}
            </p>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={text("Логин", "Username")}>
            <Input
              autoComplete="off"
              onChange={(event) =>
                onChange({ ...draft, username: event.target.value })
              }
              placeholder="farid.karimov"
              value={draft.username}
            />
          </Field>

          <Field label={text("Статус", "Status")}>
            <Select
              onValueChange={(status) =>
                onChange({ ...draft, status: status as AccessUserStatus })
              }
              options={localizedStatusOptions}
              value={draft.status}
            />
          </Field>
        </div>

        <Field
          label={
            draft.id ? text("Новый пароль — необязательно", "New password — optional") : text("Временный пароль", "Temporary password")
          }
        >
          <Input
            autoComplete="new-password"
            onChange={(event) =>
              onChange({ ...draft, password: event.target.value })
            }
            placeholder={text("Минимум 8 символов, буква и цифра", "At least 8 characters, including a letter and a number")}
            type="password"
            value={draft.password}
          />
        </Field>

        <div className="app-surface-muted app-border flex items-center justify-between gap-4 rounded-2xl border p-4">
          <span className="min-w-0">
            <span className="app-text block text-sm font-black">
              {text("Потребовать смену пароля", "Require password change")}
            </span>
            <span className="app-muted mt-1 block text-xs leading-5">
              {text("Рекомендуется для всех временных паролей.", "Recommended for all temporary passwords.")}
            </span>
          </span>
          <Toggle
            ariaLabel={text("Потребовать смену пароля", "Require password change")}
            checked={draft.mustChangePassword}
            onCheckedChange={(mustChangePassword) =>
              onChange({ ...draft, mustChangePassword })
            }
          />
        </div>

        <div>
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="app-text text-sm font-black">{text("Роли пользователя", "User roles")}</p>
              <p className="app-muted mt-1 text-xs">
                {text("Данные берутся из актуального списка ролей приложения.", "Roles are loaded from the current application role list.")}
              </p>
            </div>
            <span className="app-muted shrink-0 text-xs font-bold">
              {text(`${roles.length} ролей`, `${roles.length} roles`)}
            </span>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {roles.map((role) => {
              const isLeadershipRole =
                role.systemKey === "enterprise_director" ||
                role.systemKey === "department_head";
              const isEnterpriseAdmin =
                role.systemKey === "enterprise_admin";
              const isDepartmentAdmin =
                role.systemKey === "department_admin";
              const isBuiltInSuperadmin = role.systemKey === "superadmin";
              const hasRequiredOrganizationScope = isEnterpriseAdmin
                ? Boolean(selectedEmployee?.enterpriseName)
                : isDepartmentAdmin
                  ? Boolean(selectedEmployee?.departmentName)
                  : true;
              const canToggle =
                assignableRoleIds.has(role.id) && hasRequiredOrganizationScope;
              const checked = isLeadershipRole
                ? automaticRoleIds.has(role.id)
                : draft.roleIds.includes(role.id);
              const disabled = !canToggle;

              let description: string;
              if (isBuiltInSuperadmin) {
                description = text("Только для встроенной системной учётной записи", "Only available to the built-in system account");
              } else if (isLeadershipRole) {
                description = checked
                  ? text("Назначена автоматически по оргструктуре", "Assigned automatically from the organization structure")
                  : text("Назначается автоматически по оргструктуре", "Assigned automatically from the organization structure");
              } else if (isEnterpriseAdmin) {
                description = !selectedEmployee?.enterpriseName
                  ? text("Доступна сотруднику, который уже относится к предприятию", "Available to an employee already assigned to an enterprise")
                  : canToggle
                    ? text(`Полное управление в пределах «${selectedEmployee.enterpriseName}»`, `Full management within “${selectedEmployee.enterpriseName}”`)
                    : text("Недоступна: роль содержит права выше ваших", "Unavailable: this role contains permissions beyond yours");
              } else if (isDepartmentAdmin) {
                description = !selectedEmployee?.departmentName
                  ? text("Доступна сотруднику, который уже относится к отделу", "Available to an employee already assigned to a department")
                  : canToggle
                    ? text(`Полное управление в пределах «${selectedEmployee.departmentName}»`, `Full management within “${selectedEmployee.departmentName}”`)
                    : text("Недоступна: роль содержит права выше ваших", "Unavailable: this role contains permissions beyond yours");
              } else if (!canToggle) {
                description = text("Недоступна: роль содержит права выше ваших", "Unavailable: this role contains permissions beyond yours");
              } else {
                description = text(
                  `${role.permissionCodes.length} разрешений${role.isSystem ? " · системная роль" : ""}`,
                  `${role.permissionCodes.length} permissions${role.isSystem ? " · system role" : ""}`,
                );
              }

              return (
                <div
                  className={[
                    "app-surface-muted app-border flex min-h-[84px] items-center justify-between gap-4 rounded-2xl border p-4 transition",
                    disabled
                      ? "opacity-80"
                      : "hover:border-[var(--accent-border)]",
                  ].join(" ")}
                  key={role.id}
                >
                  <span className="min-w-0">
                    <span className="app-text block text-sm font-black">
                      {accessRoleName(role.systemKey, role.name, text)}
                    </span>
                    <span className="app-muted mt-1 block text-xs leading-5">
                      {description}
                    </span>
                  </span>
                  <Toggle
                    ariaLabel={text(`Роль ${role.name}`, `Role ${accessRoleName(role.systemKey, role.name, text)}`)}
                    checked={checked}
                    disabled={disabled}
                    onCheckedChange={(nextChecked) => {
                      if (!canToggle) return;
                      onChange({
                        ...draft,
                        roleIds: nextChecked
                          ? [...new Set([...draft.roleIds, role.id])]
                          : draft.roleIds.filter(
                              (roleId) => roleId !== role.id,
                            ),
                      });
                    }}
                  />
                </div>
              );
            })}
          </div>

          {roles.length === 0 && (
            <div className="app-surface-muted app-muted mt-3 rounded-2xl p-5 text-center text-sm font-semibold">
              {text("В приложении пока нет доступных ролей.", "There are no available roles in the application yet.")}
            </div>
          )}

          <p className="app-muted mt-3 text-xs leading-5">
            {text("Руководящие роли определяются фактическим назначением в оргструктуре. Роли администратора предприятия и администратора отдела назначаются вручную, а их область доступа автоматически следует за текущим предприятием или отделом сотрудника.", "Leadership roles are determined by actual organizational assignments. Enterprise and department administrator roles are assigned manually, and their data scope automatically follows the employee’s current enterprise or department.")}
          </p>
        </div>

        <FormActions
          className="pt-2"
          loading={isSaving}
          onCancel={() => onOpenChange(false)}
          onSubmit={onSave}
          submitLabel={text("Сохранить пользователя", "Save user")}
          submitType="button"
        />
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
        <p className="app-muted text-xs font-black uppercase tracking-[0.12em]">
          {label}
        </p>
        <p className="app-text mt-1 text-2xl font-black">{value}</p>
      </div>
    </div>
  );
}

export function StatusBadge({
  status,
}: {
  status: AccessUserStatus;
}): JSX.Element {
  const text = useAppText();
  const active = status === "active";
  const label = accessUserStatusLabel(status, text);

  return (
    <span
      aria-label={text(`Статус: ${label}`, `Status: ${label}`)}
      className={[
        "app-status-badge",
        active ? "app-status-badge--active" : "app-status-badge--blocked",
      ].join(" ")}
      title={label}
    >
      <span aria-hidden="true" className="app-status-badge__dot" />
      <span>{label}</span>
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
