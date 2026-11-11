"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type CardVariant = "default" | "tile" | "hero";
type HeroGlow = "nominal" | "watch" | "critical" | "insufficient";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  variant?: CardVariant;
  glow?: HeroGlow;
  hud?: boolean;
}

const VARIANTS: Record<CardVariant, string> = {
  default: "rounded-[1.375rem] border border-border bg-card text-foreground shadow-card md:rounded-card",
  tile: "rounded-tile bg-surface text-foreground",
  hero: "hero-surface rounded-[1.375rem] text-white md:rounded-card",
};

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = "default", glow = "nominal", hud = false, style, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(VARIANTS[variant], hud && "hud-surface", className)}
      style={
        variant === "hero"
          ? ({ ...style, "--hero-glow": `var(--hero-glow-${glow})` } as React.CSSProperties)
          : style
      }
      {...props}
    >
      {hud && (
        <>
          <span aria-hidden="true" className="hud-corner hud-tl" />
          <span aria-hidden="true" className="hud-corner hud-tr" />
          <span aria-hidden="true" className="hud-corner hud-bl" />
          <span aria-hidden="true" className="hud-corner hud-br" />
        </>
      )}
      {children}
    </div>
  )
);
Card.displayName = "Card";

interface CardHeaderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  className?: string;
  title?: React.ReactNode;
  description?: string;
  action?: React.ReactNode;
}

const CardHeader = React.forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className, title, description, action, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex flex-col space-y-1.5 p-6", className)}
      {...props}
    >
      {(title || description || action) && (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {title && <h2 className="text-lg font-medium tracking-tight">{title}</h2>}
            {description && <p className="text-sm text-muted">{description}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </div>
  )
);
CardHeader.displayName = "CardHeader";

interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  className?: string;
}

const CardTitle = React.forwardRef<HTMLHeadingElement, CardTitleProps>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn(
        "text-2xl font-semibold tracking-tight",
        className
      )}
      {...props}
    />
  )
);
CardTitle.displayName = "CardTitle";

interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

const CardContent = React.forwardRef<HTMLDivElement, CardContentProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("p-6 pt-0", className)}
      {...props}
    />
  )
);
CardContent.displayName = "CardContent";

export { Card, CardHeader, CardTitle, CardContent };
