import type { ReactNode } from 'react'
import type { IconType } from 'react-icons'
import { AnimatedNumber } from './AnimatedNumber'

interface StatCardProps {
  title: string
  value: ReactNode
  description?: string
  icon: IconType
}

export function StatCard({ title, value, icon: Icon }: StatCardProps): JSX.Element {
  return (
    <article className="app-stat-card group p-4 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="app-muted text-xs font-semibold">{title}</p>
          <div className="app-text mt-2 truncate text-2xl font-extrabold tracking-tight">
            {typeof value === 'number' ? <AnimatedNumber value={value} /> : value}
          </div>
        </div>
        <span className="app-accent-soft flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border">
          <Icon className="h-[18px] w-[18px]" />
        </span>
      </div>
    </article>
  )
}
