import { cva, type VariantProps } from "class-variance-authority";
import {
  forwardRef,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";

import { cn } from "../lib/cn";

const iconButtonVariants = cva("app-icon-button", {
  variants: {
    size: {
      sm: "app-icon-button-sm",
      md: "app-icon-button-md",
      lg: "app-icon-button-lg",
    },
    tone: {
      neutral: "app-icon-button-neutral",
      accent: "app-icon-button-accent",
      danger: "app-icon-button-danger",
      inverse: "app-icon-button-inverse",
    },
  },
  defaultVariants: {
    size: "md",
    tone: "neutral",
  },
});

type IconButtonSize = NonNullable<
  VariantProps<typeof iconButtonVariants>["size"]
>;
type IconButtonTone = NonNullable<
  VariantProps<typeof iconButtonVariants>["tone"]
>;

export interface IconButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  children?: ReactNode;
  danger?: boolean;
  icon?: ReactNode;
  label: string;
  size?: IconButtonSize;
  tone?: IconButtonTone;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      children,
      className,
      danger = false,
      icon,
      label,
      size = "md",
      title,
      tone = "neutral",
      type = "button",
      ...props
    },
    ref,
  ) => {
    const resolvedTone: IconButtonTone = danger ? "danger" : tone;

    return (
      <button
        {...props}
        aria-label={label}
        className={cn(
          iconButtonVariants({ size, tone: resolvedTone }),
          className,
        )}
        ref={ref}
        title={title ?? label}
        type={type}
      >
        {icon ?? children}
      </button>
    );
  },
);

IconButton.displayName = "IconButton";
