import * as RadixDialog from "@radix-ui/react-dialog";
import { useTranslation } from "react-i18next";
import type { ReactNode } from "react";
import { FiX } from "react-icons/fi";
import { Button } from "./Button";
import { ModalLayout } from "./ModalLayout";

interface DialogProps {
  bodyClassName?: string;
  children: ReactNode;
  description?: string;
  footer?: ReactNode;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  title: string;
  widthClassName?: string;
}

export function Dialog({
  bodyClassName,
  children,
  description,
  footer,
  onOpenChange,
  open,
  title,
  widthClassName = "max-w-3xl",
}: DialogProps): JSX.Element {
  const { t } = useTranslation();

  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-50 bg-slate-950/55 backdrop-blur-sm" />
        <RadixDialog.Content
          className={`app-surface app-border fixed left-1/2 top-1/2 z-50 flex max-h-[86vh] w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[28px] border ${widthClassName}`}
        >
          <ModalLayout
            bodyClassName={bodyClassName}
            footer={footer}
            header={
              <div className="app-border-soft flex items-start justify-between gap-4 border-b p-6">
                <div className="min-w-0">
                  <RadixDialog.Title className="app-text text-xl font-black">
                    {title}
                  </RadixDialog.Title>
                  {description && (
                    <RadixDialog.Description className="app-muted mt-1 text-sm">
                      {description}
                    </RadixDialog.Description>
                  )}
                </div>

                <RadixDialog.Close asChild>
                  <Button
                    aria-label={t("common.actions.close")}
                    className="h-12 w-12 shrink-0 rounded-2xl"
                    variant="ghost"
                  >
                    <FiX />
                  </Button>
                </RadixDialog.Close>
              </div>
            }
          >
            {children}
          </ModalLayout>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
