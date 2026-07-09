import type { HrEntityKey, HrRecord } from '../../../shared/types/hr'
import { hrApiClient } from '../../../shared/lib/hrApiClient'
import type { SelectOption } from '../../../shared/ui'

export interface EmployeeRelationOptions {
  departments: SelectOption[]
  positions: SelectOption[]
}

export async function loadEmployeeRelationOptions(): Promise<EmployeeRelationOptions> {
  const [departments, positions] = await Promise.all([
    loadEntityOptions('departments'),
    loadEntityOptions('positions'),
  ])

  return {
    departments,
    positions,
  }
}

export function getRecordLabel(record: HrRecord | null | undefined): string {
  if (!record) {
    return ''
  }

  return String(record.name ?? record.id ?? '')
}

async function loadEntityOptions(entity: Extract<HrEntityKey, 'departments' | 'positions'>): Promise<SelectOption[]> {
  const result = await hrApiClient.list({
    entity,
    page: 1,
    pageSize: 50000,
    orderBy: 'name',
    orderDirection: 'asc',
  })

  return result.items.map((item) => ({
    value: String(item.id ?? ''),
    label: getRecordLabel(item),
  }))
}

