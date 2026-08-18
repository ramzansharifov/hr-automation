import type { HrEntityKey, HrRecord } from "../../../shared/types/hr";
import { hrApiClient } from "../../../shared/lib/hrApiClient";
import type { SelectOption } from "../../../shared/ui";

export interface EmployeeRelationOptions {
  departments: SelectOption[];
  positions: PositionOption[];
}

export interface PositionOption extends SelectOption {
  departmentId: string;
}

export async function loadEmployeeRelationOptions(): Promise<EmployeeRelationOptions> {
  const [departments, positions] = await Promise.all([
    loadEntityOptions("departments"),
    loadPositionOptions(),
  ]);

  return { departments, positions };
}

async function loadPositionOptions(): Promise<PositionOption[]> {
  const records = await loadAll("positions");
  return records.map((item) => ({
    value: String(item.id ?? ""),
    label: getRecordLabel(item),
    departmentId: String(item.department_id ?? ""),
  }));
}

export function getRecordLabel(record: HrRecord | null | undefined): string {
  if (!record) return "";
  return String(record.name ?? record.id ?? "");
}

async function loadEntityOptions(
  entity: Extract<HrEntityKey, "departments" | "positions">,
): Promise<SelectOption[]> {
  const records = await loadAll(entity);
  return records.map((item) => ({
    value: String(item.id ?? ""),
    label: getRecordLabel(item),
  }));
}

async function loadAll(
  entity: Extract<HrEntityKey, "departments" | "positions">,
): Promise<HrRecord[]> {
  const records: HrRecord[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const result = await hrApiClient.list({
      entity,
      page,
      pageSize: 100,
      orderBy: "name",
      orderDirection: "asc",
    });
    records.push(...result.items);
    totalPages = Math.max(result.totalPages, 1);
    page += 1;
  } while (page <= totalPages);

  return records;
}
