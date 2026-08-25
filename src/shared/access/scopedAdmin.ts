import type { AccessUserRole } from "../types/access";

export type ScopedAdminRoleKey = "enterprise_admin" | "department_admin";

export function getScopedAdminRole(
  roles: AccessUserRole[],
): ScopedAdminRoleKey | null {
  if (roles.some((role) => role.systemKey === "enterprise_admin")) {
    return "enterprise_admin";
  }
  if (roles.some((role) => role.systemKey === "department_admin")) {
    return "department_admin";
  }
  return null;
}

export function scopedAdminRoleLabel(role: ScopedAdminRoleKey): string {
  return role === "enterprise_admin"
    ? "Администратор предприятия"
    : "Администратор отдела";
}
