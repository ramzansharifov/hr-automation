import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  Link,
  type LinkProps,
} from "react-router-dom";

import { cn } from "../lib/cn";
import {
  actionDefinitions,
  getActionVariant,
  type ActionContext,
  type AppAction,
} from "./actionDefinitions";
import { buttonVariants, type ButtonSize } from "./buttonVariants";

export interface ActionLinkProps extends LinkProps {
  action: AppAction;
  children?: ReactNode;
  className?: string;
  context?: ActionContext;
  hideIcon?: boolean;
  size?: ButtonSize;
}

export function ActionLink({
  action,
  children,
  className,
  context = "default",
  hideIcon = false,
  size = "md",
  ...props
}: ActionLinkProps): JSX.Element {
  const { t } = useTranslation();
  const definition = actionDefinitions[action];
  const Icon = definition.icon;
  const icon = hideIcon ? null : (
    <span aria-hidden="true" className="app-button__icon">
      <Icon />
    </span>
  );

  return (
    <Link
      {...props}
      className={cn(
        buttonVariants({ size, variant: getActionVariant(action, context) }),
        className,
      )}
    >
      {definition.iconPosition !== "right" && icon}
      <span className="app-button__label">
        {children ?? t(definition.labelKey, { defaultValue: definition.defaultLabel })}
      </span>
      {definition.iconPosition === "right" && icon}
    </Link>
  );
}
