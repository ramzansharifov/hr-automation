import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import type {
  ComponentPropsWithoutRef,
  ReactElement,
  ReactNode,
} from "react";

interface TooltipProps {
  align?: ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>["align"];
  children: ReactElement;
  className?: string;
  content: ReactNode;
  delayDuration?: number;
  side?: ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>["side"];
  sideOffset?: number;
}

export function Tooltip({
  align = "center",
  children,
  className = "",
  content,
  delayDuration,
  side = "top",
  sideOffset = 8,
}: TooltipProps): JSX.Element {
  return (
    <TooltipPrimitive.Root delayDuration={delayDuration}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          align={align}
          className={[
            "radix-tooltip-content z-[80] max-w-64 select-none rounded-lg border border-slate-700/80 bg-slate-950 px-3 py-2 text-xs font-semibold leading-4 text-white shadow-2xl",
            className,
          ].join(" ")}
          side={side}
          sideOffset={sideOffset}
        >
          {content}
          <TooltipPrimitive.Arrow className="fill-slate-950" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

export function TooltipProvider({
  children,
  delayDuration = 140,
  skipDelayDuration = 300,
}: ComponentPropsWithoutRef<typeof TooltipPrimitive.Provider>): JSX.Element {
  return (
    <TooltipPrimitive.Provider
      delayDuration={delayDuration}
      skipDelayDuration={skipDelayDuration}
    >
      {children}
    </TooltipPrimitive.Provider>
  );
}
