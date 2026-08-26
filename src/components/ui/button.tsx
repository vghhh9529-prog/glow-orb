import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "group relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold cursor-pointer transition-[transform,background-color,border-color,box-shadow,color] duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.96] disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "isolate overflow-hidden bg-gradient-to-br from-primary via-primary to-accent text-primary-foreground shadow-[0_12px_28px_-12px_hsl(var(--primary)/0.8)] before:pointer-events-none before:absolute before:inset-0 before:-translate-x-full before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent before:transition-transform before:duration-500 hover:-translate-y-1 hover:shadow-[0_20px_42px_-15px_hsl(var(--primary)/0.95)] hover:before:translate-x-full",
        destructive: "isolate overflow-hidden bg-gradient-to-br from-destructive to-destructive/80 text-destructive-foreground shadow-[0_10px_24px_-14px_hsl(var(--destructive)/0.9)] hover:-translate-y-1 hover:shadow-[0_18px_34px_-14px_hsl(var(--destructive)/0.95)] hover:brightness-110",
        outline:
          "border border-border/80 bg-background/60 shadow-sm backdrop-blur-md hover:-translate-y-1 hover:border-primary/45 hover:bg-gradient-to-r hover:from-primary/12 hover:to-accent/10 hover:text-foreground hover:shadow-[0_14px_30px_-18px_hsl(var(--primary)/0.9)]",
        secondary: "border border-border/60 bg-secondary text-secondary-foreground shadow-sm hover:-translate-y-1 hover:border-primary/30 hover:bg-secondary/90 hover:shadow-[0_14px_28px_-16px_hsl(var(--primary)/0.85)]",
        ghost: "border border-transparent hover:-translate-y-0.5 hover:border-primary/15 hover:bg-accent/70 hover:text-accent-foreground hover:shadow-[0_10px_24px_-18px_hsl(var(--primary)/0.9)]",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-lg px-3.5 text-xs",
        lg: "h-12 rounded-xl px-7",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
