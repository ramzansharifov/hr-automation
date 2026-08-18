import { useTranslation } from 'react-i18next'
import { FiDatabase } from 'react-icons/fi'
import type { HrEntityKey } from '../shared/types/hr'
import { HrEntityTable } from '../features/hr-table/HrEntityTable'
import { getEntityConfig } from '../features/hr-table/hrEntityConfig'
import { getAppLocale } from '../shared/i18n'
import { PageHeader } from '../shared/ui'

interface EntityPageProps {
  entity: HrEntityKey
}

export function EntityPage({ entity }: EntityPageProps): JSX.Element {
  const { i18n, t } = useTranslation()
  const config = getEntityConfig(entity, t, getAppLocale(i18n.language))

  return (
    <div className="space-y-6">
      <PageHeader
        description={config.description}
        icon={<FiDatabase />}
        title={config.title}
      />

      <HrEntityTable entity={entity} />
    </div>
  )
}