import * as RadixDialog from "@radix-ui/react-dialog";
import { useTranslation } from "react-i18next";
import type { ReactNode } from "react";
import { FiX } from "react-icons/fi";
import { Button } from "./Button";

export type DialogSize = "sm" | "md" | "lg" | "xl";

interface DialogProps {
  bodyClassName?: string;
  children: ReactNode;
  description?: string;
  footer?: ReactNode;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  size?: DialogSize;
  title: string;
}

const sizeClasses: Record<DialogSize, string> = {
  sm: "max-w-md",
  md: "max-w-xl",
  lg: "max-w-3xl",
  xl: "max-w-5xl",
};

export function Dialog({
  bodyClassName = "",
  children,
  description,
  footer,
  onOpenChange,
  open,
  size = "lg",
  title,
}: DialogProps): JSX.Element {
  const { t } = useTranslation();

  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-50 bg-slate-950/55 backdrop-blur-sm" />
        <RadixDialog.Content
          className={[
            "app-surface app-border fixed left-1/2 top-1/2 z-50 flex max-h-[min(90dvh,900px)] w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[28px] border shadow-2xl outline-none",
            sizeClasses[size],
          ].join(" ")}
        >
          <header className="app-border-soft flex shrink-0 items-start justify-between gap-4 border-b px-6 py-5 sm:px-7 sm:py-6">
            <div className="min-w-0">
              <RadixDialog.Title className="app-text text-xl font-black leading-tight">
                {title}
              </RadixDialog.Title>
              {description && (
                <RadixDialog.Description className="app-muted mt-1.5 max-w-2xl text-sm leading-5">
                  {description}
                </RadixDialog.Description>
              )}
            </div>

            <RadixDialog.Close asChild>
              <Button
                aria-label={t("common.actions.close")}
                className="h-10 w-10 shrink-0 rounded-xl p-0"
                variant="ghost"
              >
                <FiX className="h-5 w-5" />
              </Button>
            </RadixDialog.Close>
          </header>

          <div
            className={[
              "min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5 sm:px-7 sm:py-6",
              bodyClassName,
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {children}
          </div>

          {footer && (
            <footer className="app-surface app-border-soft shrink-0 border-t px-6 py-4 sm:px-7 sm:py-5">
              {footer}
            </footer>
          )}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

export function DialogFooter({ children }: { children: ReactNode }): JSX.Element {
  return <div className="flex flex-wrap justify-end gap-3">{children}</div>;
}
