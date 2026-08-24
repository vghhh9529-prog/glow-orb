import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";

import { cn } from "@/lib/utils";

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      "peer relative inline-flex h-8 w-[3.5rem] shrink-0 cursor-pointer items-center rounded-full border border-border/80 bg-muted/80 p-1 shadow-inner transition-[background-color,border-color,box-shadow] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-primary/55 data-[state=checked]:bg-primary/25 data-[state=checked]:shadow-[0_0_22px_hsl(var(--primary)/0.35)] data-[state=unchecked]:hover:border-primary/35",
      className,
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none block size-6 rounded-full bg-foreground shadow-[0_2px_8px_hsl(var(--background)/0.65)] ring-0 transition-transform duration-200 ease-out data-[state=checked]:translate-x-6 data-[state=unchecked]:translate-x-0 data-[state=checked]:bg-primary-foreground",
      )}
    />
    <span className="pointer-events-none absolute inset-y-0 end-2 flex items-center text-[9px] font-black text-muted-foreground/70 transition-colors data-[state=checked]:text-primary-foreground">
      <span className="sr-only">Toggle</span>
    </span>
  </SwitchPrimitives.Root>
));
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
