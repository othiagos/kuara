import React from "react";
import { cn } from "./cn";

export interface KbdProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode;
}

export const Kbd: React.FC<KbdProps> = ({ className, children, ...props }) => (
  <kbd
    className={cn(
      "inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded border border-[var(--kuara-border)] bg-[var(--kuara-surface-muted)] font-mono text-[10px] font-medium text-[var(--kuara-fg-muted)] select-none",
      className
    )}
    {...props}
  >
    {children}
  </kbd>
);
