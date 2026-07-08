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
      <section>
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-blue-600">
          Справочник
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
          {config.title}
        </h1>
        <p className="mt-3 max-w-3xl text-base leading-7 text-slate-500">
          {config.description}
        </p>
      </section>

      <HrEntityTable entity={entity} />
    </div>
  )
}