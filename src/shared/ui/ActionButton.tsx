import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react";
import { FiLoader } from "react-icons/fi";
import { Button } from "./Button";
import {
  actionDefinitions,
  getActionVariant,
  type ActionContext,
  type AppAction,
} from "./actionDefinitions";

export interface ActionButtonProps
  extends Omit<
    ComponentPropsWithoutRef<typeof Button>,
    "leftIcon" | "rightIcon" | "variant"
  > {
  action: AppAction;
  context?: ActionContext;
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
      context = "default",
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
    const icon = hideIcon
      ? undefined
      : loading
        ? <FiLoader className="animate-spin" />
        : <Icon />;
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
        variant={getActionVariant(action, context)}
      >
        {label}
      </Button>
    );
  },
);

ActionButton.displayName = "ActionButton";
