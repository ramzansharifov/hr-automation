import * as RadixDialog from "@radix-ui/react-dialog";
import { useTranslation } from "react-i18next";
import type { ReactNode } from "react";
import { FiX } from "react-icons/fi";
import { IconButton } from "./IconButton";

export type DialogSize = "sm" | "md" | "lg";

interface DialogProps {
  children?: ReactNode;
  description?: string;
  footer?: ReactNode;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  size?: DialogSize;
  title: string;
}

const dialogWidthBySize: Record<DialogSize, string> = {
  sm: "max-w-md",
  md: "max-w-2xl",
  lg: "max-w-3xl",
};

export function Dialog({
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
            "app-surface app-border fixed left-1/2 top-1/2 z-50 flex max-h-[min(90dvh,900px)] w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[28px] border shadow-2xl",
            dialogWidthBySize[size],
          ].join(" ")}
        >
          <div className="app-border-soft flex shrink-0 items-start justify-between gap-4 border-b px-6 py-5">
            <div className="min-w-0 py-0.5">
              <RadixDialog.Title className="app-text text-xl font-black">
                {title}
              </RadixDialog.Title>
              {description && (
                <RadixDialog.Description className="app-muted mt-1 text-sm leading-6">
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
          </div>

          {children !== undefined && children !== null && (
            <div className="app-dialog-body min-h-0 flex-1 overflow-y-auto overscroll-contain p-6 [&>form>.sticky]:static [&>form>.sticky]:mx-0 [&>form>.sticky]:mb-0 [&>form>.sticky]:mt-6 [&>form>.sticky]:px-0 [&>form>.sticky]:pb-0">
              {children}
            </div>
          )}

          {footer && (
            <div className="app-surface app-border-soft shrink-0 border-t px-6 py-4">
              {footer}
            </div>
          )}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
