import type { ReactNode } from 'react'

interface PageHeaderProps {
  actions?: ReactNode
  description?: string
  title: string
}

export function PageHeader({ actions, description, title }: PageHeaderProps): JSX.Element {
  return (
    <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="app-text text-3xl font-black tracking-tight">{title}</h1>
        {description && <p className="app-muted mt-2 max-w-3xl text-sm">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-3">{actions}</div>}
    </section>
  )
}
