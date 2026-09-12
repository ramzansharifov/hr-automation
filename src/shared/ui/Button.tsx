import {
  forwardRef,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";

import { cn } from "../lib/cn";
import {
  buttonVariants,
  type ButtonSize,
  type ButtonVariant,
} from "./buttonVariants";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  size?: ButtonSize;
  variant?: ButtonVariant;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      className,
      leftIcon,
      rightIcon,
      size = "md",
      type = "button",
      variant = "secondary",
      ...props
    },
    ref,
  ) => (
    <button
      {...props}
      className={cn(buttonVariants({ size, variant }), className)}
      ref={ref}
      type={type}
    >
      {leftIcon && (
        <span aria-hidden="true" className="app-button__icon">
          {leftIcon}
        </span>
      )}
      <span className="app-button__label">{children}</span>
      {rightIcon && (
        <span aria-hidden="true" className="app-button__icon">
          {rightIcon}
        </span>
      )}
    </button>
  ),
);

Button.displayName = "Button";
