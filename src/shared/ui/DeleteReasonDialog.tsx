import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

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
  reasonLabel,
  reasonPlaceholder,
  title,
}: DeleteReasonDialogProps): JSX.Element {
  const { t } = useTranslation();
  const resolvedReasonLabel = reasonLabel ?? t("common.fields.deleteReason");
  const resolvedReasonPlaceholder =
    reasonPlaceholder ?? t("common.fields.deleteReasonPlaceholder");
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
            {t("common.actions.cancel")}
          </Button>
          <ActionButton
            action="delete"
            disabled={!trimmedReason}
            loading={loading}
            onClick={() => void handleConfirm()}
          >
            {t("common.actions.delete")}
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
        <span className="app-text text-sm font-bold">{resolvedReasonLabel}</span>
        <Textarea
          autoFocus
          disabled={loading}
          onChange={(event) => setReason(event.target.value)}
          placeholder={resolvedReasonPlaceholder}
          rows={4}
          value={reason}
        />
      </label>
    </Dialog>
  );
}
