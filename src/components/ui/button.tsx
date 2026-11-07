"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";
import { ChevronLeft, X } from "lucide-react";

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive" | "outline" | "ghost" | "link";
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
      default: "bg-accent text-accent-foreground hover:bg-accent/90",
      destructive:
        "bg-red-600 text-red-50 hover:bg-red-700",
      outline:
        "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
      ghost: "hover:bg-accent hover:text-accent-foreground",
      link: "text-accent underline-offset-4 hover:underline",
    },
    size: {
      default: "h-11 px-4 py-2",
      sm: "h-9 px-3",
      lg: "h-12 px-8",
    },
  };

  return (
    <Comp
      className={cn(
        "inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
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

// Mobile hamburger toggle button
export function MobileMenuButton({ isOpen, onToggle }: { isOpen: boolean; onToggle: () => void }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onToggle}
      aria-label="Open navigation menu"
      className="lg:hidden"
    >
      {isOpen ? (
        <X className="w-5 h-5" />
      ) : (
        <>
          <ChevronLeft className="w-5 h-5" />
        </>
      )}
    </Button>
  );
}
