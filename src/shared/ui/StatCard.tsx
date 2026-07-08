import type { ReactNode } from 'react'
import type { IconType } from 'react-icons'

interface StatCardProps {
  title: string
  value: ReactNode
  description: string
  icon: IconType
}

export function StatCard({ title, value, description, icon: Icon }: StatCardProps): JSX.Element {
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <div className="mt-3 text-3xl font-black tracking-tight text-slate-950">{value}</div>
        </div>

        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
          <Icon className="h-6 w-6" />
        </div>
      </div>

      <p className="mt-4 text-sm leading-6 text-slate-500">{description}</p>
    </article>
  )
}