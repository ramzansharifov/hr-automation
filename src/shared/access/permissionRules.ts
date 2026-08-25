import type { AccessScopeType } from "../types/access";

export const permissionDependencies: Record<string, string[]> = {
  "employees.manage": ["employees.view"],
  "organization.manage": ["organization.view"],
  "recruitment.manage": ["recruitment.view"],
  "vacations.manage": ["vacations.view"],

  "directory.view": ["profile.view"],

  "employees.create": ["employees.view", "organization.view"],
  "employees.edit": ["employees.view", "organization.view"],
  "employees.change_employment": ["employees.view", "organization.view"],
  "employees.terminate": ["employees.view"],
  "employees.export": ["employees.view", "settings.view"],

  "organization.create": ["organization.view"],
  "organization.edit": ["organization.view"],
  "organization.delete": ["organization.view"],
  "organization.assign_leader": ["organization.view", "employees.view"],

  "vacations.create": ["vacations.view", "employees.view", "vacation_types.view"],
  "vacations.edit": ["vacations.view", "employees.view", "vacation_types.view"],
  "vacations.delete": ["vacations.view"],
  "vacations.approve": ["vacations.view", "employees.view", "vacation_types.view"],

  "vacancies.create": ["vacancies.view", "organization.view"],
  "vacancies.edit": ["vacancies.view", "organization.view"],
  "vacancies.delete": ["vacancies.view"],

  "candidates.create": ["candidates.view", "vacancies.view"],
  "candidates.edit": ["candidates.view", "vacancies.view"],
  "candidates.delete": ["candidates.view"],
  "candidates.hire": ["candidates.view"],

  "vacation_types.create": ["vacation_types.view"],
  "vacation_types.edit": ["vacation_types.view"],
  "vacation_types.delete": ["vacation_types.view"],

  "users.create": ["users.view", "employees.view"],
  "users.edit": ["users.view", "employees.view"],
  "users.delete": ["users.view"],
  "users.reset_password": ["users.view"],

  "roles.create": ["roles.view"],
  "roles.edit": ["roles.view"],
  "roles.delete": ["roles.view"],

  "settings.backups_view": ["settings.view"],
  "settings.backups_create": ["settings.view"],
  "settings.backups_restore": ["settings.view"],
  "settings.backups_open_folder": ["settings.view"],
};

export const legacyPermissionCodes = new Set([
  "employees.manage",
  "organization.manage",
  "vacations.manage",
  "recruitment.view",
  "recruitment.manage",
  "access.manage",
  "settings.manage",
  "payroll.view",
  "payroll.manage",
]);

// Infrastructure-level operations remain global. They cannot be isolated by a
// business tenant merely by attaching an organizational scope to the role.
export const globalOnlyPermissionCodes = new Set([
  "settings.backups_view",
  "settings.backups_create",
  "settings.backups_restore",
  "settings.backups_open_folder",
]);

// These permissions operate on enterprise-wide dictionaries. They may be
// delegated to an enterprise role, but never to a department role because a
// department must not mutate data shared by all departments of the enterprise.
export const enterpriseLevelPermissionCodes = new Set([
  "vacation_types.create",
  "vacation_types.edit",
  "vacation_types.delete",
]);

export const accessScopeRank: Record<AccessScopeType, number> = {
  self: 0,
  department: 1,
  enterprise: 2,
  global: 3,
};

export function canScopePermissionTo(
  permissionCode: string,
  targetScope: AccessScopeType,
): boolean {
  if (targetScope === "global") return true;
  if (globalOnlyPermissionCodes.has(permissionCode)) return false;
  if (
    targetScope === "department" &&
    enterpriseLevelPermissionCodes.has(permissionCode)
  ) {
    return false;
  }
  return true;
}

export type PermissionRiskLevel = "elevated" | "critical";

const criticalPermissionCodes = new Set([
  "employees.terminate",
  "organization.delete",
  "users.delete",
  "roles.delete",
  "settings.backups_restore",
]);

const elevatedPermissionCodes = new Set([
  "organization.assign_leader",
  "vacations.approve",
  "vacancies.delete",
  "candidates.delete",
  "candidates.hire",
  "vacation_types.delete",
  "users.reset_password",
  "settings.backups_create",
  "settings.backups_open_folder",
]);

export function getPermissionRiskLevel(code: string): PermissionRiskLevel | null {
  if (criticalPermissionCodes.has(code)) return "critical";
  if (elevatedPermissionCodes.has(code)) return "elevated";
  return null;
}

export function normalizePermissionDependencies(codes: Iterable<string>): string[] {
  const normalized = new Set(codes);
  const queue = [...normalized];

  while (queue.length > 0) {
    const code = queue.shift()!;
    for (const dependency of permissionDependencies[code] ?? []) {
      if (normalized.has(dependency)) continue;
      normalized.add(dependency);
      queue.push(dependency);
    }
  }

  return [...normalized];
}

export function getDependentPermissionCodes(
  selectedCodes: Iterable<string>,
  dependencyCode: string,
): string[] {
  const selected = new Set(selectedCodes);
  const dependents = new Set<string>();
  const queue = [dependencyCode];

  while (queue.length > 0) {
    const dependency = queue.shift()!;
    for (const [candidate, dependencies] of Object.entries(permissionDependencies)) {
      if (!selected.has(candidate) || dependents.has(candidate)) continue;
      if (!dependencies.includes(dependency)) continue;
      dependents.add(candidate);
      queue.push(candidate);
    }
  }

  return [...dependents];
}

export function isPermissionSetDelegable(
  actorPermissionCodes: Iterable<string>,
  requestedPermissionCodes: Iterable<string>,
): boolean {
  const actor = new Set(actorPermissionCodes);
  return normalizePermissionDependencies(requestedPermissionCodes)
    .filter((code) => !legacyPermissionCodes.has(code))
    .every((code) => actor.has(code));
}
