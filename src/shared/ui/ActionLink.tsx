import type { ReactNode } from "react";
import {
  Link,
  type LinkProps,
} from "react-router-dom";

import { cn } from "../lib/cn";
import { actionDefinitions, type AppAction } from "./actionDefinitions";
import { buttonVariants, type ButtonSize } from "./buttonVariants";

export interface ActionLinkProps extends LinkProps {
  action: AppAction;
  children?: ReactNode;
  className?: string;
  hideIcon?: boolean;
  size?: ButtonSize;
}

export function ActionLink({
  action,
  children,
  className,
  hideIcon = false,
  size = "md",
  ...props
}: ActionLinkProps): JSX.Element {
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
        buttonVariants({ size, variant: definition.variant }),
        className,
      )}
    >
      {definition.iconPosition !== "right" && icon}
      <span className="app-button__label">
        {children ?? definition.defaultLabel}
      </span>
      {definition.iconPosition === "right" && icon}
    </Link>
  );
}
