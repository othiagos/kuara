import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { ThemeToggle } from "./ThemeToggle";
import { buttonVariants } from "./ui/Button";
import { Divider } from "./ui/Divider";
import { Sun } from "lucide-react";

export const Navbar: React.FC = () => {
  const { user } = useAuth();

  const getDashboardLink = () => {
    if (!user) return "/login";
    if (user.role === "CLIENT") return "/dashboard/client";
    if (user.role === "PROVIDER") return "/dashboard/provider";
    return "/dashboard/admin";
  };

  return (
    <header className="h-14 border-b border-[var(--kuara-border)] bg-[var(--kuara-surface)]/95 backdrop-blur-sm sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-full flex items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-md bg-[var(--kuara-primary)] text-[var(--kuara-primary-fg)] flex items-center justify-center shrink-0">
            <Sun className="w-4 h-4" />
          </div>
          <span className="font-semibold text-sm text-[var(--kuara-fg)] tracking-tight">
            Kuara
          </span>
          <Divider orientation="vertical" className="hidden sm:inline-block" />
          <span className="hidden sm:inline-block text-xs text-[var(--kuara-fg-muted)] truncate">
            Contratação Segura
          </span>
        </Link>

        <nav className="flex items-center gap-1.5 sm:gap-2.5 text-xs font-medium">
          <a
            href="/#como-funciona"
            className={buttonVariants({
              variant: "ghost",
              size: "md",
              className: "hidden sm:inline-flex",
            })}
          >
            Como funciona
          </a>
          <a
            href="/#garantias"
            className={buttonVariants({
              variant: "ghost",
              size: "md",
              className: "hidden sm:inline-flex",
            })}
          >
            Garantias
          </a>

          <ThemeToggle />

          {user ? (
            <Link
              to={getDashboardLink()}
              className={buttonVariants({ variant: "primary", size: "md" })}
            >
              Meu Painel
            </Link>
          ) : (
            <div className="flex items-center gap-1.5">
              <Link
                to="/login"
                className={buttonVariants({ variant: "ghost", size: "md" })}
              >
                Entrar
              </Link>
              <Link
                to="/register"
                className={buttonVariants({ variant: "secondary", size: "md" })}
              >
                Criar Conta
              </Link>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
};
