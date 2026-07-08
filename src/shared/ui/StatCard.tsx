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
    <article className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-slate-500">{title}</p>
          <div className="mt-3 text-3xl font-black tracking-tight text-slate-950">
            {value}
          </div>
        </div>

        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
          <Icon className="h-5 w-5" />
        </div>
      </div>

      {description && (
        <p className="mt-4 text-sm font-medium text-slate-500">
          {description}
        </p>
      )}
    </article>
  )
}