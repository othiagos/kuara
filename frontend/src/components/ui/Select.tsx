import React, { useId } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "./cn";

export type SelectSize = "sm" | "md" | "lg";

const SIZE_CLASSES: Record<SelectSize, string> = {
  sm: "h-7 text-xs pl-2.5 pr-7",
  md: "h-8 text-xs pl-3 pr-8",
  lg: "h-9 text-sm pl-3.5 pr-9",
};

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size"> {
  label?: string;
  hint?: string;
  error?: string;
  size?: SelectSize;
  options?: SelectOption[];
  containerClassName?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label,
      hint,
      error,
      size = "md",
      options,
      containerClassName,
      className,
      id,
      children,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const selectId = id || generatedId;

    return (
      <div className={cn("space-y-1", containerClassName)}>
        {label && (
          <label
            htmlFor={selectId}
            className="block text-xs font-medium text-[var(--kuara-fg)]"
          >
            {label}
          </label>
        )}

        <div className="relative flex items-center">
          <select
            ref={ref}
            id={selectId}
            className={cn(
              "w-full appearance-none rounded-md border bg-[var(--kuara-surface)] text-[var(--kuara-fg)] transition-colors",
              "focus:outline-none focus:ring-2 focus:ring-[var(--kuara-ring)] focus:border-transparent",
              "disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-[var(--kuara-surface-muted)]",
              error
                ? "border-[var(--kuara-danger)] focus:ring-[var(--kuara-danger)]"
                : "border-[var(--kuara-border)] hover:border-[var(--kuara-border-strong)]",
              SIZE_CLASSES[size],
              className
            )}
            {...props}
          >
            {options
              ? options.map((opt) => (
                  <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                    {opt.label}
                  </option>
                ))
              : children}
          </select>

          <ChevronDown className="pointer-events-none absolute right-2.5 w-3.5 h-3.5 text-[var(--kuara-fg-subtle)]" />
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

Select.displayName = "Select";
