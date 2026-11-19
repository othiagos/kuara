import React, { useId } from "react";
import { cn } from "./cn";

export type InputSize = "sm" | "md" | "lg";

const SIZE_CLASSES: Record<InputSize, string> = {
  sm: "h-7 text-xs px-2.5",
  md: "h-8 text-xs px-3",
  lg: "h-9 text-sm px-3.5",
};

const ICON_PADDING: Record<InputSize, { left: string; right: string }> = {
  sm: { left: "pl-7", right: "pr-7" },
  md: { left: "pl-8", right: "pr-8" },
  lg: { left: "pl-9", right: "pr-9" },
};

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  label?: string;
  hint?: string;
  error?: string;
  size?: InputSize;
  leftIcon?: React.ReactNode;
  rightElement?: React.ReactNode;
  containerClassName?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      hint,
      error,
      size = "md",
      leftIcon,
      rightElement,
      containerClassName,
      className,
      id,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const inputId = id || generatedId;

    return (
      <div className={cn("space-y-1", containerClassName)}>
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-medium text-[var(--kuara-fg)]"
          >
            {label}
          </label>
        )}

        <div className="relative flex items-center">
          {leftIcon && (
            <span className="pointer-events-none absolute left-2.5 flex items-center text-[var(--kuara-fg-subtle)]">
              {leftIcon}
            </span>
          )}

          <input
            ref={ref}
            id={inputId}
            className={cn(
              "w-full rounded-md border bg-[var(--kuara-surface)] text-[var(--kuara-fg)] placeholder:text-[var(--kuara-fg-subtle)] transition-colors",
              "focus:outline-none focus:ring-2 focus:ring-[var(--kuara-ring)] focus:border-transparent",
              "disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-[var(--kuara-surface-muted)]",
              error
                ? "border-[var(--kuara-danger)] focus:ring-[var(--kuara-danger)]"
                : "border-[var(--kuara-border)] hover:border-[var(--kuara-border-strong)]",
              SIZE_CLASSES[size],
              leftIcon && ICON_PADDING[size].left,
              rightElement && ICON_PADDING[size].right,
              className
            )}
            {...props}
          />

          {rightElement && (
            <div className="absolute right-2 flex items-center">{rightElement}</div>
          )}
        </div>

        {error ? (
          <p className="text-[11px] text-[var(--kuara-danger-text)]">{error}</p>
        ) : (
          hint && <p className="text-[11px] text-[var(--kuara-fg-subtle)]">{hint}</p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
