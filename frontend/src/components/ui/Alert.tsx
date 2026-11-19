import React from "react";
import { AlertCircle, CheckCircle2, Info, ShieldAlert, X } from "lucide-react";
import { cn } from "./cn";

export type AlertVariant = "neutral" | "info" | "success" | "warning" | "danger";

const VARIANT_CLASSES: Record<AlertVariant, string> = {
  neutral:
    "bg-[var(--kuara-surface-muted)] border-[var(--kuara-border)] text-[var(--kuara-fg)]",
  info:
    "bg-[var(--kuara-info-soft)] border-[var(--kuara-info-border)] text-[var(--kuara-info-text)]",
  success:
    "bg-[var(--kuara-success-soft)] border-[var(--kuara-success-border)] text-[var(--kuara-success-text)]",
  warning:
    "bg-[var(--kuara-warning-soft)] border-[var(--kuara-warning-border)] text-[var(--kuara-warning-text)]",
  danger:
    "bg-[var(--kuara-danger-soft)] border-[var(--kuara-danger-border)] text-[var(--kuara-danger-text)]",
};

const DEFAULT_ICONS: Record<AlertVariant, React.ReactNode> = {
  neutral: <Info className="w-4 h-4 shrink-0" />,
  info: <Info className="w-4 h-4 shrink-0" />,
  success: <CheckCircle2 className="w-4 h-4 shrink-0" />,
  warning: <AlertCircle className="w-4 h-4 shrink-0" />,
  danger: <ShieldAlert className="w-4 h-4 shrink-0" />,
};

export interface AlertProps {
  variant?: AlertVariant;
  title?: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode | false;
  action?: React.ReactNode;
  onDismiss?: () => void;
  compact?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export const Alert: React.FC<AlertProps> = ({
  variant = "neutral",
  title,
  description,
  icon,
  action,
  onDismiss,
  compact = false,
  className,
  children,
}) => {
  const renderedIcon = icon === false ? null : icon ?? DEFAULT_ICONS[variant];

  return (
    <div
      role="alert"
      className={cn(
        "rounded-md border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs",
        compact ? "px-3 py-2" : "px-3.5 py-3",
        VARIANT_CLASSES[variant],
        className
      )}
    >
      <div className="flex items-start gap-2.5 min-w-0 flex-1">
        {renderedIcon && <span className="mt-0.5 shrink-0">{renderedIcon}</span>}
        <div className="min-w-0 space-y-0.5 leading-relaxed">
          {title && <p className="font-semibold">{title}</p>}
          {description && <div className="opacity-90">{description}</div>}
          {children}
        </div>
      </div>

      {(action || onDismiss) && (
        <div className="flex items-center gap-2 shrink-0">
          {action}
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Dispensar aviso"
              className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};
