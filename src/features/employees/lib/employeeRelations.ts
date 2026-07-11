import type { HrEntityKey, HrRecord } from "../../../shared/types/hr";
import { hrApiClient } from "../../../shared/lib/hrApiClient";
import type { SelectOption } from "../../../shared/ui";

export interface EmployeeRelationOptions {
  departments: SelectOption[];
  positions: PositionOption[];
}

export interface PositionOption extends SelectOption {
  departmentId: string;
  baseSalary: string;
}

export async function loadEmployeeRelationOptions(): Promise<EmployeeRelationOptions> {
  const [departments, positions] = await Promise.all([
    loadEntityOptions("departments"),
    loadPositionOptions(),
  ]);

  return {
    departments,
    positions,
  };
}

async function loadPositionOptions(): Promise<PositionOption[]> {
  const result = await hrApiClient.list({
    entity: "positions",
    page: 1,
    pageSize: 100,
    orderBy: "name",
    orderDirection: "asc",
  });
  return result.items.map((item) => ({
    value: String(item.id ?? ""),
    label: getRecordLabel(item),
    departmentId: String(item.department_id ?? ""),
    baseSalary: String(item.base_salary ?? 0),
  }));
}

export function getRecordLabel(record: HrRecord | null | undefined): string {
  if (!record) {
    return "";
  }

  return String(record.name ?? record.id ?? "");
}

async function loadEntityOptions(
  entity: Extract<HrEntityKey, "departments" | "positions">,
): Promise<SelectOption[]> {
  const result = await hrApiClient.list({
    entity,
    page: 1,
    pageSize: 50000,
    orderBy: "name",
    orderDirection: "asc",
  });

  return result.items.map((item) => ({
    value: String(item.id ?? ""),
    label: getRecordLabel(item),
  }));
}
