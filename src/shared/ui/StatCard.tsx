import type { ReactNode } from 'react'
import type { IconType } from 'react-icons'

interface StatCardProps {
  title: string
  value: ReactNode
  description?: string
  icon: IconType
}

export function StatCard({ title, value, icon: Icon }: StatCardProps): JSX.Element {
  return (
    <article className="app-surface app-border group relative overflow-hidden rounded-[24px] border p-5 transition duration-200 hover:-translate-y-0.5 hover:border-[var(--accent-border)]">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[var(--accent-border)] to-[var(--accent-hover)] opacity-80" />
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="app-muted text-sm font-bold">{title}</p>
          <div className="app-text mt-3 truncate text-3xl font-black tracking-tight">{value}</div>
        </div>
        <span className="app-accent-soft flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border transition group-hover:scale-105">
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </article>
  )
}
