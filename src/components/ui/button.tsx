"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "accent" | "destructive" | "outline" | "ghost" | "link";
  size?: "default" | "sm" | "lg";
  asChild?: boolean;
}

const Button = React.forwardRef<
  HTMLButtonElement,
  ButtonProps
>(({ className, variant = "default", size = "default", asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button";
  const variants = {
    variant: {
      default: "bg-primary text-primary-foreground hover:bg-primary/90",
      accent: "bg-accent text-accent-foreground hover:bg-accent/90",
      destructive: "bg-danger text-danger-foreground hover:bg-danger/90",
      outline: "border border-border bg-card text-foreground hover:bg-surface-2",
      ghost: "text-foreground hover:bg-surface-2",
      link: "text-accent-strong underline-offset-4 hover:underline",
    },
    size: {
      default: "h-11 px-5 py-2",
      sm: "h-9 px-3",
      lg: "h-13 px-8",
    },
  };

  return (
    <Comp
      className={cn(
        "inline-flex items-center justify-center rounded-full text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
        variants.variant[variant],
        variants.size[size],
        className
      )}
      ref={ref}
      {...props}
    />
  );
});

Button.displayName = "Button";

export { Button };
