import React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "./cn";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "danger"
  | "danger-outline"
  | "success"
  | "warning"
  | "link";

export type ButtonSize = "xs" | "sm" | "md" | "lg";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--kuara-primary)] text-[var(--kuara-primary-fg)] border border-transparent hover:bg-[var(--kuara-primary-hover)] shadow-panel",
  secondary:
    "bg-[var(--kuara-secondary)] text-[var(--kuara-secondary-fg)] border border-transparent hover:bg-[var(--kuara-secondary-hover)] shadow-panel",
  outline:
    "bg-[var(--kuara-surface)] text-[var(--kuara-fg)] border border-[var(--kuara-border)] hover:bg-[var(--kuara-surface-hover)] hover:border-[var(--kuara-border-strong)]",
  ghost:
    "bg-transparent text-[var(--kuara-fg-muted)] border border-transparent hover:bg-[var(--kuara-surface-hover)] hover:text-[var(--kuara-fg)]",
  danger:
    "bg-[var(--kuara-danger)] text-[var(--kuara-danger-fg)] border border-transparent hover:bg-[var(--kuara-danger-hover)] shadow-panel",
  "danger-outline":
    "bg-[var(--kuara-surface)] text-[var(--kuara-danger-text)] border border-[var(--kuara-danger-border)] hover:bg-[var(--kuara-danger-soft)]",
  success:
    "bg-[var(--kuara-success)] text-[var(--kuara-success-fg)] border border-transparent hover:bg-[var(--kuara-success-hover)] shadow-panel",
  warning:
    "bg-[var(--kuara-warning-soft)] text-[var(--kuara-warning-text)] border border-[var(--kuara-warning-border)] hover:brightness-95",
  link:
    "bg-transparent text-[var(--kuara-primary)] border border-transparent hover:underline px-0 h-auto",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  xs: "h-6 px-2 text-[11px] rounded gap-1",
  sm: "h-7 px-2.5 text-xs rounded-md gap-1.5",
  md: "h-8 px-3 text-xs rounded-md gap-1.5",
  lg: "h-9 px-4 text-sm rounded-md gap-2",
};

const ICON_ONLY_SIZE_CLASSES: Record<ButtonSize, string> = {
  xs: "h-6 w-6 p-0 rounded",
  sm: "h-7 w-7 p-0 rounded-md",
  md: "h-8 w-8 p-0 rounded-md",
  lg: "h-9 w-9 p-0 rounded-md",
};

export interface ButtonStyleOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
  iconOnly?: boolean;
  fullWidth?: boolean;
  className?: string;
}

/**
 * Generates GPUI-Kit aligned button classes so native buttons and react-router Links share identical geometry.
 */
export function buttonVariants({
  variant = "outline",
  size = "md",
  iconOnly = false,
  fullWidth = false,
  className,
}: ButtonStyleOptions = {}): string {
  return cn(
    "inline-flex items-center justify-center font-medium select-none whitespace-nowrap transition-colors duration-150",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--kuara-ring)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--kuara-bg)]",
    "disabled:opacity-50 disabled:pointer-events-none",
    VARIANT_CLASSES[variant],
    variant !== "link" && (iconOnly ? ICON_ONLY_SIZE_CLASSES[size] : SIZE_CLASSES[size]),
    fullWidth && "w-full",
    className
  );
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  iconOnly?: boolean;
  fullWidth?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "outline",
      size = "md",
      loading = false,
      leftIcon,
      rightIcon,
      iconOnly = false,
      fullWidth = false,
      disabled,
      className,
      children,
      type = "button",
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        className={buttonVariants({ variant, size, iconOnly, fullWidth, className })}
        {...props}
      >
        {loading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
        ) : (
          leftIcon && <span className="inline-flex shrink-0">{leftIcon}</span>
        )}
        {children}
        {!loading && rightIcon && (
          <span className="inline-flex shrink-0">{rightIcon}</span>
        )}
      </button>
    );
  }
);

Button.displayName = "Button";
