import * as LabelPrimitive from "@radix-ui/react-label";
import { forwardRef, type ComponentPropsWithoutRef } from "react";

export const Label = forwardRef<
  HTMLLabelElement,
  ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className = "", ...props }, ref) => (
  <LabelPrimitive.Root
    className={["select-none", className].join(" ")}
    ref={ref}
    {...props}
  />
));

Label.displayName = "Label";
