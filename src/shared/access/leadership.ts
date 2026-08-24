import type { AccessUserRole } from "../types/access";

export type LeadershipRoleKey = "enterprise_director" | "department_head";

export function getLeadershipRole(
  roles: AccessUserRole[],
): LeadershipRoleKey | null {
  if (roles.some((role) => role.systemKey === "enterprise_director")) {
    return "enterprise_director";
  }
  if (roles.some((role) => role.systemKey === "department_head")) {
    return "department_head";
  }
  return null;
}

export function leadershipRoleLabel(role: LeadershipRoleKey): string {
  return role === "enterprise_director"
    ? "Директор предприятия"
    : "Руководитель отдела";
}
