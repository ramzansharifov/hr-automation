import type { AccessScopeType } from "../types/access";

export const permissionDependencies: Record<string, string[]> = {
  "directory.view": ["profile.view"],
  "attention.view": ["dashboard.view"],

  "employees.create": [
    "employees.view",
    "enterprises.view",
    "departments.view",
    "positions.view",
  ],
  "employees.edit": ["employees.view"],
  "employees.change_employment": [
    "employees.view",
    "employment_history.view",
    "enterprises.view",
    "departments.view",
    "positions.view",
  ],
  "employees.terminate": ["employees.view", "employment_history.view"],
  "employees.export": ["employees.view", "settings.view"],

  "employee_education.view": ["employees.view"],
  "employee_education.create": ["employee_education.view"],
  "employee_education.edit": ["employee_education.view"],
  "employee_education.delete": ["employee_education.view"],

  "employee_experience.view": ["employees.view"],
  "employee_experience.create": ["employee_experience.view"],
  "employee_experience.edit": ["employee_experience.view"],
  "employee_experience.delete": ["employee_experience.view"],

  "employment_history.view": ["employees.view"],

  "enterprises.create": ["enterprises.view"],
  "enterprises.edit": ["enterprises.view"],
  "enterprises.delete": ["enterprises.view"],
  "enterprises.assign_leader": [
    "enterprises.view",
    "departments.view",
    "positions.view",
    "employees.view",
    "employment_history.view",
  ],

  "departments.view": ["enterprises.view"],
  "departments.create": ["departments.view"],
  "departments.edit": ["departments.view"],
  "departments.delete": ["departments.view"],
  "departments.assign_leader": [
    "departments.view",
    "positions.view",
    "employees.view",
    "employment_history.view",
  ],

  "positions.view": ["departments.view"],
  "positions.create": ["positions.view"],
  "positions.edit": ["positions.view"],
  "positions.delete": ["positions.view"],

  "vacations.create": ["vacations.view", "employees.view", "vacation_types.view"],
  "vacations.edit": ["vacations.view", "employees.view", "vacation_types.view"],
  "vacations.delete": ["vacations.view"],
  "vacations.approve": ["vacations.view", "employees.view", "vacation_types.view"],

  "vacancies.create": ["vacancies.view", "positions.view"],
  "vacancies.edit": ["vacancies.view", "positions.view"],
  "vacancies.delete": ["vacancies.view"],

  "candidates.create": ["candidates.view", "vacancies.view"],
  "candidates.edit": ["candidates.view", "vacancies.view"],
  "candidates.delete": ["candidates.view"],
  "candidates.hire": ["candidates.view"],

  "vacation_types.create": ["vacation_types.view"],
  "vacation_types.edit": ["vacation_types.view"],
  "vacation_types.delete": ["vacation_types.view"],

  "document_types.create": ["document_types.view"],
  "document_types.edit": ["document_types.view"],
  "document_types.delete": ["document_types.view"],

  "documents.view": ["employees.view"],
  "documents.add": ["documents.view", "employees.view"],
  "documents.delete": ["documents.view", "employees.view"],

  "data_exchange.import": [
    "employees.view",
    "enterprises.view",
    "departments.view",
    "positions.view",
  ],
  "data_exchange.export": ["employees.view"],

  "users.create": ["users.view", "employees.view"],
  "users.edit": ["users.view", "employees.view"],
  "users.delete": ["users.view"],
  "users.reset_password": ["users.view"],

  "roles.create": ["roles.view", "departments.view"],
  "roles.edit": ["roles.view"],
  "roles.delete": ["roles.view"],

  "settings.backups_view": ["settings.view"],
  "settings.backups_create": ["settings.view"],
  "settings.backups_restore": ["settings.view"],
  "settings.backups_open_folder": ["settings.view"],
};

// Kept only to reject stale payloads from older clients. Migration 034 removes
// these codes from the live permission catalog.
export const legacyPermissionCodes = new Set([
  "employees.manage",
  "organization.view",
  "organization.create",
  "organization.edit",
  "organization.delete",
  "organization.assign_leader",
  "organization.manage",
  "vacations.manage",
  "recruitment.view",
  "recruitment.manage",
  "access.manage",
  "settings.manage",
  "payroll.view",
  "payroll.manage",
]);

// These operations are genuinely installation-wide. A scoped role must not be
// allowed to select them because the backend deliberately has no tenant-scoped
// implementation for them.
export const globalOnlyPermissionCodes = new Set([
  "enterprises.create",
  "enterprises.delete",
  "audit.view",
  "employees.export",
  "settings.backups_view",
  "settings.backups_create",
  "settings.backups_restore",
  "settings.backups_open_folder",
]);

// Enterprise-level mutations may be global or enterprise-scoped, but never
// department-scoped. Read permissions stay available in department roles so the
// parent hierarchy and enterprise dictionaries remain usable.
export const enterpriseLevelPermissionCodes = new Set([
  "enterprises.edit",
  "enterprises.assign_leader",
  "departments.create",
  "departments.delete",
  "vacation_types.create",
  "vacation_types.edit",
  "vacation_types.delete",
  "document_types.create",
  "document_types.edit",
  "document_types.delete",
]);

// Operational HR modules are bound to an enterprise workspace whenever the
// underlying permission has global scope. Employees and the organization registry
// intentionally remain cross-enterprise registries for a global administrator.
export const businessContextPermissionCodes = new Set([
  "dashboard.view",
  "vacations.view",
  "vacations.create",
  "vacations.edit",
  "vacations.delete",
  "vacations.approve",
  "vacation_types.view",
  "vacation_types.create",
  "vacation_types.edit",
  "vacation_types.delete",
  "document_types.view",
  "document_types.create",
  "document_types.edit",
  "document_types.delete",
  "vacancies.view",
  "vacancies.create",
  "vacancies.edit",
  "vacancies.delete",
  "candidates.view",
  "candidates.create",
  "candidates.edit",
  "candidates.delete",
  "candidates.hire",
  "attention.view",
  "analytics.view",
  "data_exchange.import",
  "data_exchange.export",
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
  if (targetScope === "self") return false;
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
  "enterprises.delete",
  "departments.delete",
  "enterprises.assign_leader",
  "departments.assign_leader",
  "documents.delete",
  "users.delete",
  "roles.delete",
  "settings.backups_restore",
]);

const elevatedPermissionCodes = new Set([
  "positions.delete",
  "employee_education.delete",
  "employee_experience.delete",
  "vacations.approve",
  "vacations.delete",
  "vacancies.delete",
  "candidates.delete",
  "candidates.hire",
  "vacation_types.delete",
  "document_types.delete",
  "data_exchange.import",
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
