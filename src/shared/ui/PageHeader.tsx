import type { ReactNode } from 'react'

interface PageHeaderProps {
  actions?: ReactNode
  description?: string
  title: string
}

export function PageHeader({ actions, title }: PageHeaderProps): JSX.Element {
  return (
    <section className="app-accent-gradient-panel flex flex-col gap-5 overflow-hidden rounded-[28px] border p-6 sm:p-7 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0">
        <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">{title}</h1>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-3">{actions}</div>}
    </section>
  )
}
