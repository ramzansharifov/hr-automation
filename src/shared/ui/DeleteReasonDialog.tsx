import { useEffect, useState } from "react";

import { ActionButton } from "./ActionButton";
import { Button } from "./Button";
import { Dialog } from "./Dialog";
import { Textarea } from "./Textarea";

interface DeleteReasonDialogProps {
  description: string;
  onConfirm: (reason: string) => void | Promise<void>;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  title: string;
}

export function DeleteReasonDialog({
  description,
  onConfirm,
  onOpenChange,
  open,
  reasonLabel = "Основание удаления",
  reasonPlaceholder = "Укажите причину удаления",
  title,
}: DeleteReasonDialogProps): JSX.Element {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const trimmedReason = reason.trim();

  useEffect(() => {
    if (!open) {
      setReason("");
      setLoading(false);
    }
  }, [open]);

  async function handleConfirm(): Promise<void> {
    if (!trimmedReason || loading) return;

    setLoading(true);
    try {
      await onConfirm(trimmedReason);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      description={description}
      footer={
        <div className="flex justify-end gap-3">
          <Button
            disabled={loading}
            onClick={() => onOpenChange(false)}
            variant="secondary"
          >
            Отмена
          </Button>
          <ActionButton
            action="delete"
            disabled={!trimmedReason}
            loading={loading}
            onClick={() => void handleConfirm()}
          >
            Удалить
          </ActionButton>
        </div>
      }
      onOpenChange={(nextOpen) => {
        if (!loading) onOpenChange(nextOpen);
      }}
      open={open}
      size="sm"
      title={title}
    >
      <label className="grid gap-2">
        <span className="app-text text-sm font-bold">{reasonLabel}</span>
        <Textarea
          autoFocus
          disabled={loading}
          onChange={(event) => setReason(event.target.value)}
          placeholder={reasonPlaceholder}
          rows={4}
          value={reason}
        />
      </label>
    </Dialog>
  );
}
