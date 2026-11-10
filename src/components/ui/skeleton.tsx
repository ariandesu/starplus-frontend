"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  height?: string | number;
  width?: string | number;
}

export function Skeleton({
  className,
  height = "1.25rem",
  width = "100%",
  ...props
}: SkeletonProps) {
  return (
    <div
      className={cn("skeleton", className)}
      style={{ height, width }}
      {...props}
    />
  );
}
