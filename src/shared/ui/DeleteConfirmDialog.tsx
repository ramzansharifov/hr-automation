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
  confirmLabel = "Удалить",
  description,
  isLoading = false,
  onConfirm,
  onOpenChange,
  open,
  title,
}: DeleteConfirmDialogProps): JSX.Element {
  return (
    <ConfirmDialog
      cancelLabel="Отмена"
      confirmLabel={confirmLabel}
      confirmVariant="danger"
      description={description}
      isLoading={isLoading}
      loadingLabel="Удаление..."
      onConfirm={onConfirm}
      onOpenChange={onOpenChange}
      open={open}
      title={title}
    />
  );
}
