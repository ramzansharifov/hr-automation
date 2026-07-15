import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";
import type { ReactNode } from "react";

interface ScrollAreaProps {
  children: ReactNode;
  className?: string;
  viewportClassName?: string;
}

export function ScrollArea({
  children,
  className = "",
  viewportClassName = "",
}: ScrollAreaProps): JSX.Element {
  return (
    <ScrollAreaPrimitive.Root
      className={["relative overflow-hidden", className].join(" ")}
      type="hover"
    >
      <ScrollAreaPrimitive.Viewport
        className={["h-full w-full", viewportClassName].join(" ")}
      >
        {children}
      </ScrollAreaPrimitive.Viewport>
      <ScrollAreaPrimitive.Scrollbar
        className="radix-scrollbar flex touch-none select-none p-0.5 transition-colors data-[orientation=vertical]:w-2.5 data-[orientation=horizontal]:h-2.5 data-[orientation=horizontal]:flex-col"
        orientation="vertical"
      >
        <ScrollAreaPrimitive.Thumb className="radix-scrollbar-thumb relative flex-1 rounded-full bg-[color-mix(in_srgb,var(--color-text-muted)_34%,transparent)] transition-colors hover:bg-[color-mix(in_srgb,var(--color-text-muted)_52%,transparent)]" />
      </ScrollAreaPrimitive.Scrollbar>
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  );
}
