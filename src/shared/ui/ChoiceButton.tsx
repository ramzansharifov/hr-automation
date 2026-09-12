import {
  forwardRef,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";

import { cn } from "../lib/cn";

export interface ChoiceButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-pressed"> {
  leading?: ReactNode;
  selected: boolean;
  trailing?: ReactNode;
}

export const ChoiceButton = forwardRef<HTMLButtonElement, ChoiceButtonProps>(
  (
    {
      children,
      className,
      leading,
      selected,
      trailing,
      type = "button",
      ...props
    },
    ref,
  ) => (
    <button
      {...props}
      aria-pressed={selected}
      className={cn("app-choice-button", className)}
      ref={ref}
      type={type}
    >
      {leading && (
        <span aria-hidden="true" className="app-choice-button__leading">
          {leading}
        </span>
      )}
      <span className="app-choice-button__label">{children}</span>
      {trailing && (
        <span aria-hidden="true" className="app-choice-button__trailing">
          {trailing}
        </span>
      )}
    </button>
  ),
);

ChoiceButton.displayName = "ChoiceButton";
