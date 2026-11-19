import React, { useId } from "react";
import { cn } from "./cn";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
  containerClassName?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, hint, error, containerClassName, className, id, rows = 3, ...props }, ref) => {
    const generatedId = useId();
    const textareaId = id || generatedId;

    return (
      <div className={cn("space-y-1", containerClassName)}>
        {label && (
          <label
            htmlFor={textareaId}
            className="block text-xs font-medium text-[var(--kuara-fg)]"
          >
            {label}
          </label>
        )}

        <textarea
          ref={ref}
          id={textareaId}
          rows={rows}
          className={cn(
            "w-full rounded-md border bg-[var(--kuara-surface)] px-3 py-2 text-xs text-[var(--kuara-fg)] placeholder:text-[var(--kuara-fg-subtle)] transition-colors leading-relaxed",
            "focus:outline-none focus:ring-2 focus:ring-[var(--kuara-ring)] focus:border-transparent",
            "disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-[var(--kuara-surface-muted)]",
            error
              ? "border-[var(--kuara-danger)] focus:ring-[var(--kuara-danger)]"
              : "border-[var(--kuara-border)] hover:border-[var(--kuara-border-strong)]",
            className
          )}
          {...props}
        />

        {error ? (
          <p className="text-[11px] text-[var(--kuara-danger-text)]">{error}</p>
        ) : (
          hint && <p className="text-[11px] text-[var(--kuara-fg-subtle)]">{hint}</p>
        )}
      </div>
    );
  }
);

Textarea.displayName = "Textarea";
