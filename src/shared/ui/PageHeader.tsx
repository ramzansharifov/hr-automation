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
    <section className="app-page-header flex min-h-[70px] flex-col gap-3 px-4 py-3.5 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <span className="app-page-header__icon flex h-10 w-10 shrink-0 items-center justify-center rounded-lg [&>svg]:h-[18px] [&>svg]:w-[18px]">
          {icon}
        </span>

        <div className="min-w-0">
          {eyebrow && (
            <div className="app-muted mb-0.5 text-[10px] font-bold uppercase tracking-[0.1em]">
              {eyebrow}
            </div>
          )}
          <h1 className="app-text truncate text-xl font-extrabold tracking-tight sm:text-2xl">
            {title}
          </h1>
          {meta && <div className="mt-1">{meta}</div>}
        </div>
      </div>

      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 lg:justify-end">
          {actions}
        </div>
      )}
    </section>
  );
}
