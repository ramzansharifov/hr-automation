import type { ReactNode } from "react";

import { cn } from "../lib/cn";
import { ActionIconButton } from "./ActionIconButton";

interface RecordActionsProps {
  children?: ReactNode;
  className?: string;
  deleteLabel?: string;
  editLabel?: string;
  onDelete?: () => void;
  onEdit?: () => void;
  onView?: () => void;
  size?: "sm" | "md";
  stopPropagation?: boolean;
  viewLabel?: string;
}

export function RecordActions({
  children,
  className,
  deleteLabel = "Удалить",
  editLabel = "Редактировать",
  onDelete,
  onEdit,
  onView,
  size = "sm",
  stopPropagation = true,
  viewLabel = "Открыть",
}: RecordActionsProps): JSX.Element | null {
  if (!children && !onView && !onEdit && !onDelete) return null;

  return (
    <div
      className={cn("app-record-actions", className)}
      onClick={
        stopPropagation
          ? (event) => event.stopPropagation()
          : undefined
      }
    >
      {children}
      {onView && (
        <ActionIconButton
          action="view"
          label={viewLabel}
          onClick={onView}
          size={size}
        />
      )}
      {onEdit && (
        <ActionIconButton
          action="edit"
          label={editLabel}
          onClick={onEdit}
          size={size}
        />
      )}
      {onDelete && (
        <ActionIconButton
          action="delete"
          label={deleteLabel}
          onClick={onDelete}
          size={size}
        />
      )}
    </div>
  );
}
