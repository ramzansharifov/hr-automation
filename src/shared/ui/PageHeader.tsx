import type { ReactNode } from "react";

interface PageHeaderProps {
  actions?: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  icon: ReactNode;
  meta?: ReactNode;
  title: ReactNode;
}

export function PageHeader({
  actions,
  eyebrow,
  icon,
  meta,
  title,
}: PageHeaderProps): JSX.Element {
  return (
    <section className="app-accent-gradient-panel flex min-h-[78px] flex-col gap-3 overflow-hidden rounded-[22px] border px-5 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 items-center gap-3.5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-white backdrop-blur [&>svg]:h-5 [&>svg]:w-5">
          {icon}
        </span>

        <div className="min-w-0">
          {eyebrow && (
            <div className="mb-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-white/65">
              {eyebrow}
            </div>
          )}
          <h1 className="truncate text-2xl font-black tracking-tight text-white sm:text-3xl">
            {title}
          </h1>
          {meta && <div className="mt-1.5">{meta}</div>}
        </div>
      </div>

      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2.5 lg:justify-end">
          {actions}
        </div>
      )}
    </section>
  );
}
