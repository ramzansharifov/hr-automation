import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "./ConfirmDialog";

interface DeleteConfirmDialogProps {
  confirmLabel?: string;
  description: string;
  isLoading?: boolean;
  onConfirm: () => void | Promise<void>;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  title: string;
}

export function DeleteConfirmDialog({
  confirmLabel,
  description,
  isLoading = false,
  onConfirm,
  onOpenChange,
  open,
  title,
}: DeleteConfirmDialogProps): JSX.Element {
  const { t } = useTranslation();
  const resolvedConfirmLabel = confirmLabel ?? t("common.actions.delete");
  return (
    <ConfirmDialog
      cancelLabel={t("common.actions.cancel")}
      confirmLabel={resolvedConfirmLabel}
      confirmVariant="danger"
      description={description}
      isLoading={isLoading}
      loadingLabel={t("common.loading.deleting")}
      onConfirm={onConfirm}
      onOpenChange={onOpenChange}
      open={open}
      title={title}
    />
  );
}
