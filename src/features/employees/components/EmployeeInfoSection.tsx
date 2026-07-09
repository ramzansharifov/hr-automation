interface EmployeeInfoItem {
  label: string
  value: string
}

interface EmployeeInfoSectionProps {
  items: EmployeeInfoItem[]
  title: string
}

export function EmployeeInfoSection({ items, title }: EmployeeInfoSectionProps): JSX.Element {
  return (
    <section className="app-surface app-shadow rounded-[28px] border p-6">
      <h2 className="app-text text-lg font-black">{title}</h2>
      <dl className="mt-5 grid gap-4 md:grid-cols-2">
        {items.map((item) => (
          <div key={item.label} className="app-surface-muted rounded-2xl p-4">
            <dt className="app-muted text-xs font-black uppercase tracking-wide">{item.label}</dt>
            <dd className="app-text mt-2 min-h-5 text-sm font-semibold">{item.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

