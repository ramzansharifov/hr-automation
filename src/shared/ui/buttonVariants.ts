import { cva, type VariantProps } from "class-variance-authority";

export const buttonVariants = cva("app-button", {
  variants: {
    variant: {
      primary: "app-button-primary",
      secondary: "app-button-secondary",
      ghost: "app-button-ghost",
      danger: "app-button-danger",
      inverse: "app-button-inverse",
      inverseGhost: "app-button-inverse-ghost",
    },
    size: {
      sm: "app-button-sm",
      md: "app-button-md",
    },
  },
  defaultVariants: {
    variant: "secondary",
    size: "md",
  },
});

export type ButtonVariant = NonNullable<
  VariantProps<typeof buttonVariants>["variant"]
>;

export type ButtonSize = NonNullable<
  VariantProps<typeof buttonVariants>["size"]
>;
