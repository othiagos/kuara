import React from "react";
import { cn } from "./cn";

export interface DividerProps {
  orientation?: "horizontal" | "vertical";
  label?: React.ReactNode;
  className?: string;
}

export const Divider: React.FC<DividerProps> = ({
  orientation = "horizontal",
  label,
  className,
}) => {
  if (orientation === "vertical") {
    return (
      <span
        aria-hidden="true"
        className={cn("inline-block w-px h-4 bg-[var(--kuara-border)] shrink-0", className)}
      />
    );
  }

  if (label) {
    return (
      <div className={cn("flex items-center gap-3", className)}>
        <div className="h-px flex-1 bg-[var(--kuara-border)]" />
        <span className="text-[11px] font-medium text-[var(--kuara-fg-subtle)]">{label}</span>
        <div className="h-px flex-1 bg-[var(--kuara-border)]" />
      </div>
    );
  }

  return <hr className={cn("border-0 h-px bg-[var(--kuara-border)] w-full", className)} />;
};
