import React, { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "./cn";

export type ModalSize = "sm" | "md" | "lg" | "xl";

const SIZE_CLASSES: Record<ModalSize, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-2xl",
};

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  size?: ModalSize;
  footer?: React.ReactNode;
  closeOnBackdrop?: boolean;
  noPadding?: boolean;
  className?: string;
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  size = "md",
  footer,
  closeOnBackdrop = true,
  noPadding = false,
  className,
  children,
}) => {
  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-[2px]"
      onMouseDown={(e) => {
        if (closeOnBackdrop && e.target === e.currentTarget) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={cn(
          "w-full rounded-lg border border-[var(--kuara-border)] bg-[var(--kuara-surface-elevated)] text-[var(--kuara-fg)] shadow-modal overflow-hidden flex flex-col max-h-[90vh]",
          SIZE_CLASSES[size],
          className
        )}
      >
        {(title || subtitle) && (
          <div className="px-4 py-3 border-b border-[var(--kuara-border)] flex items-start justify-between gap-3 shrink-0">
            <div className="flex items-start gap-2.5 min-w-0">
              {icon && (
                <span className="mt-0.5 text-[var(--kuara-fg-muted)] shrink-0">{icon}</span>
              )}
              <div className="min-w-0">
                {title && (
                  <h2 className="text-sm font-semibold text-[var(--kuara-fg)] leading-snug">
                    {title}
                  </h2>
                )}
                {subtitle && (
                  <p className="text-xs text-[var(--kuara-fg-muted)] mt-0.5 truncate">
                    {subtitle}
                  </p>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar janela"
              className="h-7 w-7 rounded-md inline-flex items-center justify-center text-[var(--kuara-fg-subtle)] hover:text-[var(--kuara-fg)] hover:bg-[var(--kuara-surface-hover)] transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--kuara-ring)]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className={cn("overflow-y-auto", !noPadding && "p-4 sm:p-5")}>
          {children}
        </div>

        {footer && (
          <div className="px-4 py-3 border-t border-[var(--kuara-border)] bg-[var(--kuara-surface-muted)]/40 flex items-center justify-end gap-2 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export const ModalBody: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  children,
  ...props
}) => (
  <div className={cn("p-4 sm:p-5", className)} {...props}>
    {children}
  </div>
);

export const ModalFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  children,
  ...props
}) => (
  <div
    className={cn(
      "px-4 py-3 border-t border-[var(--kuara-border)] bg-[var(--kuara-surface-muted)]/40 flex items-center justify-end gap-2",
      className
    )}
    {...props}
  >
    {children}
  </div>
);
