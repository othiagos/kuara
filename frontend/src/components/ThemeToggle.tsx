import React from "react";
import { useTheme } from "../contexts/ThemeContext";
import { Sun, Moon } from "lucide-react";
import { cn } from "./ui/cn";

export interface ThemeToggleProps {
  showLabel?: boolean;
  className?: string;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ showLabel = false, className }) => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      onClick={toggleTheme}
      type="button"
      className={cn(
        "inline-flex items-center justify-center gap-1.5 h-8 rounded-md border border-[var(--kuara-border)] bg-[var(--kuara-surface)] text-[var(--kuara-fg-muted)] hover:text-[var(--kuara-fg)] hover:bg-[var(--kuara-surface-hover)] hover:border-[var(--kuara-border-strong)] transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--kuara-ring)]",
        showLabel ? "px-2.5 text-xs font-medium" : "w-8",
        className
      )}
      title={isDark ? "Mudar para modo claro" : "Mudar para modo escuro"}
      aria-label="Alternar tema"
    >
      {isDark ? (
        <Sun className="w-3.5 h-3.5 text-amber-400 shrink-0" />
      ) : (
        <Moon className="w-3.5 h-3.5 text-[var(--kuara-fg-muted)] shrink-0" />
      )}
      {showLabel && <span>{isDark ? "Modo Claro" : "Modo Escuro"}</span>}
    </button>
  );
};
