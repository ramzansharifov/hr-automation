import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react";
import { FiLoader } from "react-icons/fi";
import { useTranslation } from "react-i18next";
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
    const { t } = useTranslation();
    const definition = actionDefinitions[action];
    const Icon = definition.icon;
    const icon = hideIcon
      ? undefined
      : loading
        ? <FiLoader className="animate-spin" />
        : <Icon />;
    const defaultLabel = t(definition.labelKey, {
      defaultValue: definition.defaultLabel,
    });
    const translatedLoadingLabel = definition.loadingLabelKey
      ? t(definition.loadingLabelKey, {
          defaultValue: definition.loadingLabel ?? definition.defaultLabel,
        })
      : definition.loadingLabel;
    const label = loading
      ? loadingLabel ?? translatedLoadingLabel ?? children ?? defaultLabel
      : children ?? defaultLabel;

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
