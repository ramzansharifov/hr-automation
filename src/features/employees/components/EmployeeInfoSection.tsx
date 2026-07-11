interface EmployeeInfoItem {
  label: string;
  value: string;
}

interface EmployeeInfoSectionProps {
  items: EmployeeInfoItem[];
  title: string;
}

export function EmployeeInfoSection({
  items,
  title,
}: EmployeeInfoSectionProps): JSX.Element {
  return (
    <section className="app-surface-muted app-border rounded-[24px] border p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <span className="h-2.5 w-2.5 rounded-full bg-[var(--accent)]" />
        <h2 className="app-text text-lg font-black tracking-tight">{title}</h2>
      </div>
      <dl className="app-border-soft mt-5 grid gap-3 border-t pt-5 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <div
            key={item.label}
            className="app-surface app-border rounded-2xl border p-4"
          >
            <dt className="app-muted text-[11px] font-black uppercase tracking-[0.1em]">
              {item.label}
            </dt>
            <dd className="app-text mt-2 min-h-5 break-words text-sm font-semibold leading-5">
              {item.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
