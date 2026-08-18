import type { ReactNode } from "react";

interface ModalLayoutProps {
  bodyClassName?: string;
  children?: ReactNode;
  footer?: ReactNode;
  header: ReactNode;
}

export function ModalLayout({
  bodyClassName = "p-6",
  children,
  footer,
  header,
}: ModalLayoutProps): JSX.Element {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0">{header}</div>
      {children !== null && children !== undefined ? (
        <div className={`min-h-0 flex-1 overflow-y-auto overscroll-contain ${bodyClassName}`}>
          {children}
        </div>
      ) : null}
      {footer ? (
        <div className="app-surface app-border-soft shrink-0 border-t px-6 py-5">
          {footer}
        </div>
      ) : null}
    </div>
  );
}
