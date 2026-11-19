import React from "react";
import { Card } from "./Card";
import { cn } from "./cn";

export type StatTone = "neutral" | "amber" | "emerald" | "blue" | "rose";

const VALUE_TONE_CLASSES: Record<StatTone, string> = {
  neutral: "text-[var(--kuara-fg)]",
  amber: "text-amber-600 dark:text-amber-400",
  emerald: "text-emerald-600 dark:text-emerald-400",
  blue: "text-blue-600 dark:text-blue-400",
  rose: "text-rose-600 dark:text-rose-400",
};

const ICON_BOX_CLASSES: Record<StatTone, string> = {
  neutral:
    "bg-[var(--kuara-surface-muted)] text-[var(--kuara-fg-muted)] border-[var(--kuara-border)]",
  amber:
    "bg-[var(--kuara-warning-soft)] text-[var(--kuara-warning-text)] border-[var(--kuara-warning-border)]",
  emerald:
    "bg-[var(--kuara-success-soft)] text-[var(--kuara-success-text)] border-[var(--kuara-success-border)]",
  blue:
    "bg-[var(--kuara-info-soft)] text-[var(--kuara-info-text)] border-[var(--kuara-info-border)]",
  rose:
    "bg-[var(--kuara-danger-soft)] text-[var(--kuara-danger-text)] border-[var(--kuara-danger-border)]",
};

export interface StatCardProps {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: StatTone;
  compact?: boolean;
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  hint,
  icon,
  tone = "neutral",
  compact = false,
  className,
}) => {
  return (
    <Card
      variant="elevated"
      padding={compact ? "sm" : "md"}
      className={cn("flex items-start justify-between gap-3", className)}
    >
      <div className="min-w-0 flex-1">
        <span className="block text-xs font-medium text-[var(--kuara-fg-muted)] truncate">
          {label}
        </span>
        <div
          className={cn(
            "font-bold tracking-tight tabular-nums mt-1",
            compact ? "text-lg" : "text-xl",
            VALUE_TONE_CLASSES[tone]
          )}
        >
          {value}
        </div>
        {hint && (
          <span className="block text-[11px] text-[var(--kuara-fg-subtle)] mt-1 truncate">
            {hint}
          </span>
        )}
      </div>

      {icon && (
        <div
          className={cn(
            "w-8 h-8 rounded-md border flex items-center justify-center shrink-0",
            ICON_BOX_CLASSES[tone]
          )}
        >
          {icon}
        </div>
      )}
    </Card>
  );
};
