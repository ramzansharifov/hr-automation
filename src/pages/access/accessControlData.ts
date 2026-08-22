import { hrApiClient } from "../../shared/lib/hrApiClient";
import type {
  AccessPermission,
  AccessRoleSummary,
  AccessUserStatus,
} from "../../shared/types/access";
import type { HrRecord } from "../../shared/types/hr";
import type { SelectOption } from "../../shared/ui";

export interface EmployeeOption extends SelectOption {
  departmentName: string;
  enterpriseName: string;
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
    totalPages = result.totalPages;
    page += 1;
  } while (page <= totalPages);

  return records.map((record) => {
    const fullName = [record.last_name, record.first_name, record.middle_name]
      .map((value) => String(value ?? "").trim())
      .filter(Boolean)
      .join(" ");

    return {
      value: String(record.id),
      label: fullName || `Сотрудник #${String(record.id)}`,
      departmentName: String(record.department_name ?? ""),
      enterpriseName: String(record.enterprise_name ?? ""),
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
