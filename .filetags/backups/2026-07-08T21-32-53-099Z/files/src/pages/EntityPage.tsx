import type { HrEntityKey } from '../shared/types/hr'
import { HrEntityTable } from '../features/hr-table/HrEntityTable'
import { getEntityConfig } from '../features/hr-table/hrEntityConfig'

interface EntityPageProps {
  entity: HrEntityKey
}

export function EntityPage({ entity }: EntityPageProps): JSX.Element {
  const config = getEntityConfig(entity)

  return (
    <div className="space-y-6">
      <section className="flex items-end justify-between gap-6">
        <div>
          <h1 className="app-text text-3xl font-black tracking-tight">
            {config.title}
          </h1>
        </div>
      </section>

      <HrEntityTable entity={entity} />
    </div>
  )
}
