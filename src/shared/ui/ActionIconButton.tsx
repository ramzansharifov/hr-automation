import {
  forwardRef,
  type ComponentPropsWithoutRef,
} from "react";
import { FiLoader } from "react-icons/fi";
import { IconButton } from "./IconButton";
import {
  actionDefinitions,
  type AppAction,
} from "./actionDefinitions";

export interface ActionIconButtonProps
  extends Omit<
    ComponentPropsWithoutRef<typeof IconButton>,
    "danger" | "icon" | "label" | "tone"
  > {
  action: AppAction;
  label?: string;
  loading?: boolean;
}

export const ActionIconButton = forwardRef<
  HTMLButtonElement,
  ActionIconButtonProps
>(
  (
    {
      action,
      className,
      disabled,
      label,
      loading = false,
      ...props
    },
    ref,
  ) => {
    const definition = actionDefinitions[action];
    const Icon = definition.icon;
    const tone =
      definition.variant === "danger"
        ? "danger"
        : definition.variant === "primary"
          ? "accent"
          : "neutral";

    return (
      <IconButton
        {...props}
        aria-busy={loading || undefined}
        className={className}
        disabled={disabled || loading}
        icon={loading ? <FiLoader className="animate-spin" /> : <Icon />}
        label={label || definition.defaultLabel}
        ref={ref}
        tone={tone}
      />
    );
  },
);

ActionIconButton.displayName = "ActionIconButton";
