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
  description,
  eyebrow,
  icon,
  meta,
  title,
}: PageHeaderProps): JSX.Element {
  return (
    <section className="app-accent-gradient-panel flex min-h-[118px] flex-col gap-5 overflow-hidden rounded-[28px] border px-6 py-6 sm:px-7 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 items-center gap-4 sm:gap-5">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-white shadow-lg backdrop-blur [&>svg]:h-6 [&>svg]:w-6">
          {icon}
        </span>

        <div className="min-w-0">
          {eyebrow && (
            <div className="mb-1 text-xs font-black uppercase tracking-[0.16em] text-white/65">
              {eyebrow}
            </div>
          )}
          <h1 className="truncate text-3xl font-black tracking-tight text-white sm:text-4xl">
            {title}
          </h1>
          {description && (
            <div className="mt-2 max-w-3xl text-sm font-medium leading-6 text-white/70">
              {description}
            </div>
          )}
          {meta && <div className="mt-3">{meta}</div>}
        </div>
      </div>

      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-3 lg:justify-end">
          {actions}
        </div>
      )}
    </section>
  );
}
