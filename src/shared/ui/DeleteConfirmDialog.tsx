import { ConfirmDialog } from "./ConfirmDialog";

interface DeleteConfirmDialogProps {
  description: string;
  isLoading?: boolean;
  onConfirm: () => void | Promise<void>;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  title: string;
}

export function DeleteConfirmDialog({
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
      confirmLabel="Удалить"
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
