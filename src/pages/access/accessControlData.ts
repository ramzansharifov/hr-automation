import { hrApiClient } from "../../shared/lib/hrApiClient";
import type {
  AccessPermission,
  AccessRoleSummary,
  AccessScopeType,
  AccessUserStatus,
} from "../../shared/types/access";
import type { HrRecord } from "../../shared/types/hr";
import type { SelectOption } from "../../shared/ui";

export interface EmployeeOption extends SelectOption {
  departmentName: string;
  enterpriseName: string;
}

export interface RoleDraft {
  id?: number;
  name: string;
  description: string;
  scopeType: AccessScopeType;
  permissionCodes: string[];
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

export const emptyRoleDraft: RoleDraft = {
  name: "",
  description: "",
  scopeType: "self",
  permissionCodes: [],
};

export const emptyUserDraft: UserDraft = {
  employeeId: "",
  username: "",
  status: "active",
  roleIds: [],
  password: "",
  mustChangePassword: true,
};

export const scopeOptions: SelectOption[] = [
  { value: "global", label: "Все данные системы" },
  { value: "enterprise", label: "Только своё предприятие" },
  { value: "department", label: "Только свой отдел" },
  { value: "self", label: "Только собственные данные" },
];

export const statusOptions: SelectOption[] = [
  { value: "active", label: "Активен" },
  { value: "blocked", label: "Заблокирован" },
];

export function scopeLabel(scope: AccessScopeType): string {
  return scopeOptions.find((option) => option.value === scope)?.label ?? scope;
}

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

  const departmentIds = [
    ...new Set(
      records
        .map((record) => Number(record.department_id))
        .filter(Number.isFinite),
    ),
  ];
  const departmentMap = new Map<number, { name: string; enterpriseId: number }>();

  for (const departmentId of departmentIds) {
    const department = await hrApiClient.getById({
      entity: "departments",
      id: departmentId,
    });
    if (department) {
      departmentMap.set(departmentId, {
        name: String(department.name ?? ""),
        enterpriseId: Number(department.enterprise_id ?? 0),
      });
    }
  }

  const enterpriseIds = [
    ...new Set(
      [...departmentMap.values()]
        .map((item) => item.enterpriseId)
        .filter(Boolean),
    ),
  ];
  const enterpriseMap = new Map<number, string>();

  for (const enterpriseId of enterpriseIds) {
    const enterprise = await hrApiClient.getById({
      entity: "enterprises",
      id: enterpriseId,
    });
    if (enterprise) {
      enterpriseMap.set(enterpriseId, String(enterprise.name ?? ""));
    }
  }

  return records.map((record) => {
    const department = departmentMap.get(Number(record.department_id));
    const fullName = [record.last_name, record.first_name, record.middle_name]
      .map((value) => String(value ?? "").trim())
      .filter(Boolean)
      .join(" ");

    return {
      value: String(record.id),
      label: fullName || `Сотрудник #${record.id}`,
      departmentName: department?.name ?? "",
      enterpriseName: enterpriseMap.get(department?.enterpriseId ?? 0) ?? "",
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
