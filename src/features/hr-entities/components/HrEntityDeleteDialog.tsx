import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";

import { getUserFacingErrorMessage } from "../../../shared/lib/userFacingErrors";
import { DeleteConfirmDialog } from "../../../shared/ui";

interface HrEntityDeleteDialogProps {
  onConfirm: () => Promise<void>;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

export function HrEntityDeleteDialog({
  onConfirm,
  onOpenChange,
  open,
}: HrEntityDeleteDialogProps): JSX.Element {
  const { t } = useTranslation();

  async function handleConfirm(): Promise<void> {
    try {
      await onConfirm();
      toast.success(t("forms.toasts.deleted"));
      onOpenChange(false);
    } catch (error) {
      toast.error(
        getUserFacingErrorMessage(error, t("forms.toasts.deleteError")),
      );
    }
  }

  return (
    <DeleteConfirmDialog
      confirmLabel={t("common.actions.delete")}
      description={t("forms.delete.description")}
      onConfirm={handleConfirm}
      onOpenChange={onOpenChange}
      open={open}
      title={t("forms.delete.title")}
    />
  );
}
