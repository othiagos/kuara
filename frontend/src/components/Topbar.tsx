import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { ThemeToggle } from "./ThemeToggle";
import { Divider } from "./ui/Divider";
import { ChevronRight, Menu, ShieldCheck } from "lucide-react";

export interface TopbarBreadcrumb {
  label: string;
  to?: string;
}

export interface TopbarProps {
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  breadcrumbs?: TopbarBreadcrumb[];
  onOpenMobileMenu?: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({
  title,
  subtitle,
  actions,
  breadcrumbs,
  onOpenMobileMenu,
}) => {
  const { user } = useAuth();

  return (
    <header className="h-12 border-b border-[var(--kuara-border)] bg-[var(--kuara-surface)] sticky top-0 z-20 flex items-center justify-between gap-3 px-4 sm:px-6 shrink-0">
      <div className="min-w-0 flex items-center gap-2.5">
        {onOpenMobileMenu && (
          <button
            type="button"
            onClick={onOpenMobileMenu}
            aria-label="Abrir navegação"
            className="lg:hidden h-8 w-8 rounded-md border border-[var(--kuara-border)] bg-[var(--kuara-surface)] text-[var(--kuara-fg-muted)] hover:text-[var(--kuara-fg)] hover:bg-[var(--kuara-surface-hover)] inline-flex items-center justify-center shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--kuara-ring)]"
          >
            <Menu className="w-4 h-4" />
          </button>
        )}

        <div className="min-w-0 flex items-center gap-2.5">
          {breadcrumbs && breadcrumbs.length > 0 && (
            <nav aria-label="Navegação estrutural" className="hidden sm:flex items-center gap-1 text-xs text-[var(--kuara-fg-muted)] shrink-0">
              {breadcrumbs.map((crumb, idx) => (
                <React.Fragment key={`${crumb.label}-${idx}`}>
                  {crumb.to ? (
                    <Link
                      to={crumb.to}
                      className="hover:text-[var(--kuara-fg)] transition-colors truncate max-w-[140px]"
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className="truncate max-w-[140px]">{crumb.label}</span>
                  )}
                  <ChevronRight className="w-3.5 h-3.5 text-[var(--kuara-fg-subtle)] shrink-0" />
                </React.Fragment>
              ))}
            </nav>
          )}

          {title && (
            <h1 className="text-[13px] font-semibold text-[var(--kuara-fg)] tracking-tight truncate">
              {title}
            </h1>
          )}

          {title && subtitle && (
            <Divider orientation="vertical" className="hidden md:inline-block" />
          )}

          {subtitle && (
            <span className="text-xs text-[var(--kuara-fg-muted)] hidden md:inline truncate">
              {subtitle}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {actions && <div className="flex items-center gap-2">{actions}</div>}

        <div className="hidden xl:inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-[var(--kuara-primary-border)] bg-[var(--kuara-primary-soft)] text-[11px] font-medium text-[var(--kuara-warning-text)]">
          <ShieldCheck className="w-3.5 h-3.5 text-[var(--kuara-primary)] shrink-0" />
          <span>Custódia Kuara</span>
        </div>

        <ThemeToggle />

        {user && (
          <div
            title={`${user.name} (${user.email})`}
            className="h-8 w-8 rounded-md bg-[var(--kuara-surface-muted)] text-[var(--kuara-fg)] border border-[var(--kuara-border)] flex items-center justify-center text-xs font-semibold select-none shrink-0"
          >
            {user.name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
    </header>
  );
};
