"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  className?: string;
  icon?: React.ReactNode;
}

export function Input({ label, error, className, id, icon, ...props }: InputProps) {
  const generated = React.useId();
  const inputId = id ?? generated;
  return (
    <div className={cn("w-full space-y-1", icon && "relative")}>
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-muted block">
          {label}
        </label>
      )}
      {icon && (
        <span aria-hidden className="pointer-events-none absolute bottom-[13px] left-3 flex h-4 w-4 items-center justify-center text-muted">
          {icon}
        </span>
      )}
      <input
        id={inputId}
        type="text"
        className={cn(
          "flex h-11 w-full rounded-control border border-input bg-surface px-3 py-2 text-sm text-foreground ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          icon && "pl-10",
          error && "border-danger focus-visible:ring-danger",
          className
        )}
        {...props}
      />
      {error && (
        <p className="text-sm text-danger">{error}</p>
      )}
    </div>
  );
}
