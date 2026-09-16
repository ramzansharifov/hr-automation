import type { MouseEventHandler } from "react";
import { useTranslation } from "react-i18next";

import { cn } from "../lib/cn";
import { ActionButton } from "./ActionButton";
import type { AppAction } from "./actionDefinitions";

interface FormActionsProps {
  cancelLabel?: string;
  className?: string;
  form?: string;
  loading?: boolean;
  onCancel?: MouseEventHandler<HTMLButtonElement>;
  onSubmit?: MouseEventHandler<HTMLButtonElement>;
  submitAction?: AppAction;
  submitDisabled?: boolean;
  submitLabel?: string;
  submitType?: "button" | "submit";
}

export function FormActions({
  cancelLabel,
  className,
  form,
  loading = false,
  onCancel,
  onSubmit,
  submitAction = "save",
  submitDisabled = false,
  submitLabel,
  submitType = "submit",
}: FormActionsProps): JSX.Element {
  const { t } = useTranslation();
  const resolvedCancelLabel = cancelLabel ?? t("common.actions.cancel");
  return (
    <div className={cn("app-form-actions", className)}>
      {onCancel && (
        <ActionButton
          action="cancel"
          disabled={loading}
          onClick={onCancel}
          type="button"
        >
          {resolvedCancelLabel}
        </ActionButton>
      )}
      <ActionButton
        action={submitAction}
        disabled={submitDisabled}
        form={form}
        loading={loading}
        onClick={onSubmit}
        type={submitType}
      >
        {submitLabel}
      </ActionButton>
    </div>
  );
}
