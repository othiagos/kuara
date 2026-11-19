import React from "react";
import { cn } from "./cn";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "muted" | "elevated" | "interactive";
  padding?: "none" | "sm" | "md" | "lg";
}

const VARIANT_CLASSES = {
  default: "bg-[var(--kuara-surface)] border-[var(--kuara-border)]",
  muted: "bg-[var(--kuara-surface-muted)] border-[var(--kuara-border)]",
  elevated: "bg-[var(--kuara-surface-elevated)] border-[var(--kuara-border)] shadow-panel",
  interactive:
    "bg-[var(--kuara-surface)] border-[var(--kuara-border)] hover:border-[var(--kuara-border-strong)] transition-colors",
};

const PADDING_CLASSES = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-5",
};

export const Card: React.FC<CardProps> = ({
  variant = "default",
  padding = "none",
  className,
  children,
  ...props
}) => {
  return (
    <div
      className={cn(
        "rounded-lg border text-[var(--kuara-fg)]",
        VARIANT_CLASSES[variant],
        PADDING_CLASSES[padding],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  actions?: React.ReactNode;
}

export const CardHeader: React.FC<CardHeaderProps> = ({
  actions,
  className,
  children,
  ...props
}) => (
  <div
    className={cn(
      "px-4 py-3 border-b border-[var(--kuara-border)] flex items-center justify-between gap-3",
      className
    )}
    {...props}
  >
    <div className="min-w-0 flex-1">{children}</div>
    {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
  </div>
);

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({
  className,
  children,
  ...props
}) => (
  <h3
    className={cn("text-[13px] font-semibold text-[var(--kuara-fg)] tracking-tight leading-snug", className)}
    {...props}
  >
    {children}
  </h3>
);

export const CardDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({
  className,
  children,
  ...props
}) => (
  <p className={cn("text-xs text-[var(--kuara-fg-muted)] mt-0.5", className)} {...props}>
    {children}
  </p>
);

export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  children,
  ...props
}) => (
  <div className={cn("p-4", className)} {...props}>
    {children}
  </div>
);

export const CardFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  children,
  ...props
}) => (
  <div
    className={cn(
      "px-4 py-3 border-t border-[var(--kuara-border)] bg-[var(--kuara-surface-muted)]/40 rounded-b-lg flex items-center justify-between gap-3",
      className
    )}
    {...props}
  >
    {children}
  </div>
);
