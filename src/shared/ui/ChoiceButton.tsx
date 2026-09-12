import {
  forwardRef,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";

import { cn } from "../lib/cn";

type ChoiceButtonAlign = "start" | "center" | "between";

export interface ChoiceButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-pressed"> {
  align?: ChoiceButtonAlign;
  leading?: ReactNode;
  selected: boolean;
  trailing?: ReactNode;
}

export const ChoiceButton = forwardRef<HTMLButtonElement, ChoiceButtonProps>(
  (
    {
      align = "start",
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
      className={cn(
        "app-choice-button",
        `app-choice-button-${align}`,
        className,
      )}
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
