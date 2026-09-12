import {
  forwardRef,
  type ComponentPropsWithoutRef,
} from "react";

import { cn } from "../lib/cn";
import { IconButton } from "./IconButton";
import {
  actionDefinitions,
  type AppAction,
} from "./actionDefinitions";

const toneByAction: Record<
  AppAction,
  ComponentPropsWithoutRef<typeof IconButton>["tone"]
> = {
  backup: "accent",
  back: "neutral",
  cancel: "neutral",
  clear: "neutral",
  close: "neutral",
  confirm: "accent",
  create: "accent",
  delete: "danger",
  edit: "accent",
  export: "neutral",
  folderOpen: "neutral",
  hire: "accent",
  import: "neutral",
  login: "accent",
  logout: "neutral",
  manage: "neutral",
  next: "neutral",
  open: "neutral",
  passwordReset: "neutral",
  previous: "neutral",
  refresh: "neutral",
  reset: "neutral",
  restore: "danger",
  save: "accent",
  search: "accent",
  terminate: "danger",
  view: "neutral",
};

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

    return (
      <IconButton
        {...props}
        aria-busy={loading || undefined}
        className={className}
        disabled={disabled || loading}
        icon={
          <Icon
            className={cn(action === "refresh" && loading && "animate-spin")}
          />
        }
        label={label || definition.defaultLabel}
        ref={ref}
        tone={toneByAction[action]}
      />
    );
  },
);

ActionIconButton.displayName = "ActionIconButton";
