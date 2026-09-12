import { useState } from "react";

import type { ButtonVariant } from "./buttonVariants";
import { ActionButton } from "./ActionButton";
import { Button } from "./Button";
import { Dialog } from "./Dialog";

interface ConfirmDialogProps {
  cancelLabel?: string;
  confirmLabel?: string;
  confirmVariant?: ButtonVariant;
  description: string;
  isLoading?: boolean;
  loadingLabel?: string;
  onConfirm: () => void | Promise<void>;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  title: string;
}

export function ConfirmDialog({
  cancelLabel = "Отмена",
  confirmLabel = "Подтвердить",
  confirmVariant = "danger",
  description,
  isLoading = false,
  loadingLabel = "Выполнение...",
  onConfirm,
  onOpenChange,
  open,
  title,
}: ConfirmDialogProps): JSX.Element {
  const [internalLoading, setInternalLoading] = useState(false);
  const busy = isLoading || internalLoading;

  async function handleConfirm(): Promise<void> {
    if (busy) return;

    setInternalLoading(true);
    try {
      await onConfirm();
    } finally {
      setInternalLoading(false);
    }
  }

  return (
    <Dialog
      description={description}
      footer={
        <div className="flex justify-end gap-3">
          <Button
            disabled={busy}
            onClick={() => onOpenChange(false)}
            variant="secondary"
          >
            {cancelLabel}
          </Button>
          {confirmVariant === "danger" ? (
            <ActionButton
              action="delete"
              loading={busy}
              loadingLabel={loadingLabel}
              onClick={() => void handleConfirm()}
            >
              {confirmLabel}
            </ActionButton>
          ) : (
            <Button
              disabled={busy}
              onClick={() => void handleConfirm()}
              variant={confirmVariant}
            >
              {busy ? loadingLabel : confirmLabel}
            </Button>
          )}
        </div>
      }
      onOpenChange={(nextOpen) => {
        if (!busy) onOpenChange(nextOpen);
      }}
      open={open}
      size="sm"
      title={title}
    />
  );
}
