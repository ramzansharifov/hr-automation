import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react";

import { cn } from "../lib/cn";
import { Button } from "./Button";
import {
  actionDefinitions,
  type AppAction,
} from "./actionDefinitions";

export interface ActionButtonProps
  extends Omit<
    ComponentPropsWithoutRef<typeof Button>,
    "leftIcon" | "rightIcon" | "variant"
  > {
  action: AppAction;
  hideIcon?: boolean;
  loading?: boolean;
  loadingLabel?: ReactNode;
}

export const ActionButton = forwardRef<HTMLButtonElement, ActionButtonProps>(
  (
    {
      action,
      children,
      className,
      disabled,
      hideIcon = false,
      loading = false,
      loadingLabel,
      ...props
    },
    ref,
  ) => {
    const definition = actionDefinitions[action];
    const Icon = definition.icon;
    const icon = hideIcon ? undefined : (
      <Icon className={cn(action === "refresh" && loading && "animate-spin")} />
    );
    const label = loading
      ? loadingLabel ?? definition.loadingLabel ?? children ?? definition.defaultLabel
      : children ?? definition.defaultLabel;

    return (
      <Button
        {...props}
        aria-busy={loading || undefined}
        className={className}
        disabled={disabled || loading}
        leftIcon={definition.iconPosition === "right" ? undefined : icon}
        ref={ref}
        rightIcon={definition.iconPosition === "right" ? icon : undefined}
        variant={definition.variant}
      >
        {label}
      </Button>
    );
  },
);

ActionButton.displayName = "ActionButton";
