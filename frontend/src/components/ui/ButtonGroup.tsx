import React from "react";
import { cn } from "./cn";

export interface ButtonGroupOption<T extends string = string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
  count?: number;
  disabled?: boolean;
}

export interface ButtonGroupProps<T extends string = string> {
  options: ButtonGroupOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: "xs" | "sm" | "md";
  variant?: "attached" | "segmented";
  fullWidth?: boolean;
  className?: string;
}

const ATTACHED_HEIGHTS = {
  xs: "h-6 px-2 text-[11px]",
  sm: "h-7 px-2.5 text-xs",
  md: "h-8 px-3 text-xs",
};

const SEGMENTED_HEIGHTS = {
  xs: "h-5 px-2 text-[11px]",
  sm: "h-6 px-2.5 text-xs",
  md: "h-7 px-3 text-xs",
};

/**
 * GPUI-Kit style segmented control / attached ButtonGroup for inline filters and role switchers.
 */
export function ButtonGroup<T extends string = string>({
  options,
  value,
  onChange,
  size = "sm",
  variant = "attached",
  fullWidth = false,
  className,
}: ButtonGroupProps<T>) {
  if (variant === "segmented") {
    return (
      <div
        role="group"
        className={cn(
          "inline-flex items-center p-0.5 rounded-md border border-[var(--kuara-border)] bg-[var(--kuara-surface-muted)]",
          fullWidth && "w-full",
          className
        )}
      >
        {options.map((opt) => {
          const isActive = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              disabled={opt.disabled}
              onClick={() => onChange(opt.value)}
              className={cn(
                "inline-flex items-center justify-center gap-1.5 rounded-[4px] font-medium transition-all select-none whitespace-nowrap",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--kuara-ring)]",
                "disabled:opacity-50 disabled:pointer-events-none",
                SEGMENTED_HEIGHTS[size],
                fullWidth && "flex-1",
                isActive
                  ? "bg-[var(--kuara-surface)] text-[var(--kuara-fg)] border border-[var(--kuara-border)] shadow-panel"
                  : "text-[var(--kuara-fg-muted)] border border-transparent hover:text-[var(--kuara-fg)]"
              )}
            >
              {opt.icon && <span className="inline-flex shrink-0">{opt.icon}</span>}
              <span>{opt.label}</span>
              {typeof opt.count === "number" && (
                <span className="tabular-nums text-[10px] opacity-75">({opt.count})</span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      role="group"
      className={cn("inline-flex items-center flex-wrap sm:flex-nowrap", fullWidth && "w-full", className)}
    >
      {options.map((opt, idx) => {
        const isActive = opt.value === value;
        const isFirst = idx === 0;
        const isLast = idx === options.length - 1;

        return (
          <button
            key={opt.value}
            type="button"
            disabled={opt.disabled}
            onClick={() => onChange(opt.value)}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 border font-medium transition-colors select-none whitespace-nowrap",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--kuara-ring)] focus-visible:z-20",
              "disabled:opacity-50 disabled:pointer-events-none",
              ATTACHED_HEIGHTS[size],
              fullWidth && "flex-1",
              !isFirst && "-ml-px",
              isFirst && "rounded-l-md",
              isLast && "rounded-r-md",
              isActive
                ? "z-10 bg-[var(--kuara-secondary)] text-[var(--kuara-secondary-fg)] border-[var(--kuara-secondary)]"
                : "bg-[var(--kuara-surface)] text-[var(--kuara-fg-muted)] border-[var(--kuara-border)] hover:bg-[var(--kuara-surface-hover)] hover:text-[var(--kuara-fg)]"
            )}
          >
            {opt.icon && <span className="inline-flex shrink-0">{opt.icon}</span>}
            <span>{opt.label}</span>
            {typeof opt.count === "number" && (
              <span
                className={cn(
                  "tabular-nums text-[10px] px-1 rounded",
                  isActive
                    ? "bg-black/15 dark:bg-black/20"
                    : "bg-[var(--kuara-surface-muted)] text-[var(--kuara-fg-subtle)]"
                )}
              >
                {opt.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
