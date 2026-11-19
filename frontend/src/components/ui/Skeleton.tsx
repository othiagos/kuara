import React from "react";
import { cn } from "./cn";

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}

export const Skeleton: React.FC<SkeletonProps> = ({ className, ...props }) => (
  <div
    className={cn(
      "animate-pulse rounded-md bg-[var(--kuara-surface-muted)] border border-[var(--kuara-border)]/50",
      className
    )}
    {...props}
  />
);

export const TableSkeleton: React.FC<{ rows?: number; className?: string }> = ({
  rows = 4,
  className,
}) => (
  <div className={cn("divide-y divide-[var(--kuara-border)]", className)}>
    {Array.from({ length: rows }).map((_, idx) => (
      <div key={idx} className="px-4 py-3 flex items-center justify-between gap-4">
        <div className="space-y-1.5 flex-1">
          <Skeleton className="h-3.5 w-48" />
          <Skeleton className="h-3 w-32" />
        </div>
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-7 w-16" />
      </div>
    ))}
  </div>
);
