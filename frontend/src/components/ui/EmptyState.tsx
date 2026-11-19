import React from "react";
import { Inbox } from "lucide-react";
import { cn } from "./cn";

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  compact?: boolean;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  compact = false,
  className,
}) => {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "py-8 px-4" : "py-12 px-6",
        className
      )}
    >
      <div className="w-9 h-9 rounded-md border border-[var(--kuara-border)] bg-[var(--kuara-surface-muted)] text-[var(--kuara-fg-subtle)] flex items-center justify-center mb-3">
        {icon || <Inbox className="w-4 h-4" />}
      </div>
      <p className="text-xs font-semibold text-[var(--kuara-fg)]">{title}</p>
      {description && (
        <p className="text-[11px] text-[var(--kuara-fg-muted)] max-w-sm mt-1 leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-3.5">{action}</div>}
    </div>
  );
};
