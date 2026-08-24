import { hrApiClient } from "../../shared/lib/hrApiClient";
import type {
  AccessPermission,
  AccessRoleSummary,
  AccessUserStatus,
} from "../../shared/types/access";
import type { HrRecord } from "../../shared/types/hr";
import type { SelectOption } from "../../shared/ui";

export interface EmployeeOption extends SelectOption {
  departmentId: number | null;
  departmentName: string;
  enterpriseId: number | null;
  enterpriseName: string;
  fullName: string;
}

export interface UserDraft {
  id?: number;
  employeeId: string;
  username: string;
  status: AccessUserStatus;
  roleIds: number[];
  password: string;
  mustChangePassword: boolean;
}

export const emptyUserDraft: UserDraft = {
  employeeId: "",
  username: "",
  status: "active",
  roleIds: [],
  password: "",
  mustChangePassword: true,
};

export const statusOptions: SelectOption[] = [
  { value: "active", label: "Активен" },
  { value: "blocked", label: "Заблокирован" },
];

export function groupPermissions(
  permissions: AccessPermission[],
): Array<[string, AccessPermission[]]> {
  const groups = new Map<string, AccessPermission[]>();
  for (const permission of permissions) {
    groups.set(permission.module, [
      ...(groups.get(permission.module) ?? []),
      permission,
    ]);
  }
  return [...groups.entries()];
}

export function assignableRoles(roles: AccessRoleSummary[]): AccessRoleSummary[] {
  return roles.filter((role) => role.systemKey !== "superadmin");
}

export async function loadEmployees(): Promise<EmployeeOption[]> {
  const records: HrRecord[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const result = await hrApiClient.list({
      entity: "employees",
      page,
      pageSize: 100,
      filters: { status: { operator: "equals", value: "active" } },
      orderBy: "last_name",
      orderDirection: "asc",
    });
    records.push(...result.items);
    totalPages = Math.max(result.totalPages, 1);
    page += 1;
  } while (page <= totalPages);

  return records.map((record) => {
    const fullName = [record.last_name, record.first_name, record.middle_name]
      .map((value) => String(value ?? "").trim())
      .filter(Boolean)
      .join(" ");
    const enterpriseName = String(record.enterprise_name ?? "").trim();
    const departmentName = String(record.department_name ?? "").trim();
    const enterpriseId = toOptionalId(record.enterprise_id);
    const departmentId = toOptionalId(record.department_id);
    const structure = [enterpriseName, departmentName].filter(Boolean).join(" · ");
    const fallbackName = `Сотрудник #${String(record.id)}`;
    const displayName = fullName || fallbackName;

    return {
      value: String(record.id),
      label: structure ? `${displayName} · ${structure}` : displayName,
      fullName: displayName,
      enterpriseId,
      enterpriseName,
      departmentId,
      departmentName,
    };
  });
}

export function getErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback;
  const marker = "Error: ";
  const index = error.message.lastIndexOf(marker);
  return index >= 0
    ? error.message.slice(index + marker.length)
    : error.message || fallback;
}

function toOptionalId(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}
