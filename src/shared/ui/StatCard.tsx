import type { ReactNode } from 'react'
import type { IconType } from 'react-icons'

interface StatCardProps {
  title: string
  value: ReactNode
  description?: string
  icon: IconType
}

export function StatCard({ title, value, description, icon: Icon }: StatCardProps): JSX.Element {
  return (
    <article className="app-surface app-shadow rounded-[24px] border p-5 transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="app-muted text-sm font-bold">{title}</p>
          <div className="app-text mt-3 text-3xl font-black tracking-tight">
            {value}
          </div>
        </div>

        <div className="app-accent-soft flex h-11 w-11 items-center justify-center rounded-2xl">
          <Icon className="h-5 w-5" />
        </div>
      </div>

      {description && (
        <p className="app-muted mt-4 text-sm font-medium">
          {description}
        </p>
      )}
    </article>
  )
}
