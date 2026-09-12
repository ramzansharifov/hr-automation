import * as RadixSwitch from "@radix-ui/react-switch";

import { cn } from "../lib/cn";

interface ToggleProps {
  ariaLabel: string;
  checked: boolean;
  className?: string;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
}

export function Toggle({
  ariaLabel,
  checked,
  className,
  disabled = false,
  onCheckedChange,
}: ToggleProps): JSX.Element {
  return (
    <RadixSwitch.Root
      aria-label={ariaLabel}
      checked={checked}
      className={cn("app-toggle", className)}
      disabled={disabled}
      onCheckedChange={onCheckedChange}
    >
      <RadixSwitch.Thumb className="app-toggle__thumb" />
    </RadixSwitch.Root>
  );
}
