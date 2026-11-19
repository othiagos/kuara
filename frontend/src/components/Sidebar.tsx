import React, { useEffect } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { cn } from "./ui/cn";
import {
  LayoutDashboard,
  FileText,
  Search,
  Wallet,
  ShieldCheck,
  AlertTriangle,
  Users,
  Layers,
  LogOut,
  Sun,
  Wrench,
  PanelLeftClose,
  PanelLeftOpen,
  X,
} from "lucide-react";

export type SidebarBadgeTone = "neutral" | "amber" | "emerald" | "rose" | "blue";

export interface SidebarBadgeObject {
  count: number | string;
  tone?: SidebarBadgeTone;
}

export type SidebarBadgeValue = number | string | SidebarBadgeObject;

export interface SidebarProps {
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  badges?: Record<string, SidebarBadgeValue>;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  to: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const BADGE_TONE_CLASSES: Record<SidebarBadgeTone, string> = {
  neutral:
    "bg-[var(--kuara-surface-muted)] text-[var(--kuara-fg-muted)] border-[var(--kuara-border)]",
  amber:
    "bg-[var(--kuara-warning-soft)] text-[var(--kuara-warning-text)] border-[var(--kuara-warning-border)]",
  emerald:
    "bg-[var(--kuara-success-soft)] text-[var(--kuara-success-text)] border-[var(--kuara-success-border)]",
  rose:
    "bg-[var(--kuara-danger-soft)] text-[var(--kuara-danger-text)] border-[var(--kuara-danger-border)]",
  blue:
    "bg-[var(--kuara-info-soft)] text-[var(--kuara-info-text)] border-[var(--kuara-info-border)]",
};

const BADGE_DOT_CLASSES: Record<SidebarBadgeTone, string> = {
  neutral: "bg-[var(--kuara-fg-subtle)]",
  amber: "bg-amber-500",
  emerald: "bg-emerald-500",
  rose: "bg-rose-500",
  blue: "bg-blue-500",
};

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  badges,
  collapsed = false,
  onToggleCollapse,
  mobileOpen = false,
  onCloseMobile,
}) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (!mobileOpen || !onCloseMobile) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseMobile();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen, onCloseMobile]);

  if (!user) return null;

  const isDashboardRoute = location.pathname.startsWith("/dashboard/");
  const defaultTabByRole: Record<string, string> = {
    CLIENT: "orders",
    PROVIDER: "mural",
    ADMIN: "overview",
  };

  const currentTab =
    activeTab ||
    searchParams.get("tab") ||
    (isDashboardRoute ? defaultTabByRole[user.role] || "orders" : "");

  const getDashboardHome = () => {
    if (user.role === "CLIENT") return "/dashboard/client";
    if (user.role === "PROVIDER") return "/dashboard/provider";
    return "/dashboard/admin";
  };

  const roleLabel =
    user.role === "CLIENT"
      ? "Painel do Cliente"
      : user.role === "PROVIDER"
      ? "Painel do Prestador"
      : "Operações Admin";

  const roleTag =
    user.role === "CLIENT"
      ? "Contratante"
      : user.role === "PROVIDER"
      ? "Prestador"
      : "Admin";

  const navGroupsByRole: Record<string, NavGroup[]> = {
    CLIENT: [
      {
        label: "Navegação",
        items: [
          {
            id: "orders",
            label: "Minhas Solicitações",
            icon: FileText,
            to: "/dashboard/client?tab=orders",
          },
          {
            id: "showcase",
            label: "Buscar Profissionais",
            icon: Search,
            to: "/dashboard/client?tab=showcase",
          },
        ],
      },
    ],
    PROVIDER: [
      {
        label: "Atendimento & Serviços",
        items: [
          {
            id: "mural",
            label: "Oportunidades Abertas",
            icon: Layers,
            to: "/dashboard/provider?tab=mural",
          },
          {
            id: "active_jobs",
            label: "Meus Serviços Ativos",
            icon: Wrench,
            to: "/dashboard/provider?tab=active_jobs",
          },
        ],
      },
      {
        label: "Financeiro & Cadastro",
        items: [
          {
            id: "wallet",
            label: "Carteira & Repasses",
            icon: Wallet,
            to: "/dashboard/provider?tab=wallet",
          },
          {
            id: "verification",
            label: "Auditoria Documental",
            icon: ShieldCheck,
            to: "/dashboard/provider?tab=verification",
          },
        ],
      },
    ],
    ADMIN: [
      {
        label: "Operações",
        items: [
          {
            id: "overview",
            label: "Visão Geral & KPIs",
            icon: LayoutDashboard,
            to: "/dashboard/admin?tab=overview",
          },
          {
            id: "verification",
            label: "Moderação Documental",
            icon: ShieldCheck,
            to: "/dashboard/admin?tab=verification",
          },
          {
            id: "disputes",
            label: "Central de Disputas",
            icon: AlertTriangle,
            to: "/dashboard/admin?tab=disputes",
          },
        ],
      },
      {
        label: "Auditoria",
        items: [
          {
            id: "all_orders",
            label: "Auditoria de Pedidos",
            icon: FileText,
            to: "/dashboard/admin?tab=all_orders",
          },
          {
            id: "all_users",
            label: "Diretório de Usuários",
            icon: Users,
            to: "/dashboard/admin?tab=all_users",
          },
        ],
      },
    ],
  };

  const navGroups = navGroupsByRole[user.role] || [];

  const handleItemClick = (item: NavItem) => {
    if (onTabChange) {
      onTabChange(item.id);
    }
    navigate(item.to);
    onCloseMobile?.();
  };

  const resolveBadge = (itemId: string): SidebarBadgeObject | null => {
    if (!badges || badges[itemId] === undefined || badges[itemId] === null) return null;
    const raw = badges[itemId];
    if (typeof raw === "object") return raw;
    return { count: raw, tone: "neutral" };
  };

  const renderSidebarContent = (isMobileDrawer: boolean) => {
    const isRail = !isMobileDrawer && collapsed;

    return (
      <aside
        className={cn(
          "bg-[var(--kuara-sidebar)] border-r border-[var(--kuara-border)] flex flex-col justify-between select-none h-full transition-[width] duration-150",
          isRail ? "w-[60px]" : "w-60"
        )}
      >
        {/* Top brand bar (matches Topbar h-12 alignment) */}
        <div className="flex-1 flex flex-col min-h-0">
          <div
            className={cn(
              "h-12 border-b border-[var(--kuara-border)] flex items-center shrink-0",
              isRail ? "justify-center px-2" : "justify-between px-3"
            )}
          >
            <Link
              to={getDashboardHome()}
              onClick={() => onCloseMobile?.()}
              title={isRail ? `Kuara — ${roleLabel}` : undefined}
              className="flex items-center gap-2.5 min-w-0"
            >
              <div className="w-7 h-7 rounded-md bg-[var(--kuara-primary)] text-[var(--kuara-primary-fg)] flex items-center justify-center shrink-0">
                <Sun className="w-4 h-4" />
              </div>
              {!isRail && (
                <div className="min-w-0 leading-tight">
                  <span className="font-semibold text-[13px] text-[var(--kuara-fg)] tracking-tight block">
                    Kuara
                  </span>
                  <span className="block text-[10px] text-[var(--kuara-fg-subtle)] truncate">
                    {roleLabel}
                  </span>
                </div>
              )}
            </Link>

            {isMobileDrawer ? (
              <button
                type="button"
                onClick={onCloseMobile}
                aria-label="Fechar menu"
                className="h-7 w-7 rounded-md inline-flex items-center justify-center text-[var(--kuara-fg-subtle)] hover:text-[var(--kuara-fg)] hover:bg-[var(--kuara-surface-hover)]"
              >
                <X className="w-4 h-4" />
              </button>
            ) : (
              !isRail &&
              onToggleCollapse && (
                <button
                  type="button"
                  onClick={onToggleCollapse}
                  title="Recolher barra lateral"
                  aria-label="Recolher barra lateral"
                  className="h-7 w-7 rounded-md inline-flex items-center justify-center text-[var(--kuara-fg-subtle)] hover:text-[var(--kuara-fg)] hover:bg-[var(--kuara-surface-hover)] transition-colors"
                >
                  <PanelLeftClose className="w-3.5 h-3.5" />
                </button>
              )
            )}
          </div>

          {isRail && onToggleCollapse && (
            <div className="px-2 pt-2 flex justify-center">
              <button
                type="button"
                onClick={onToggleCollapse}
                title="Expandir barra lateral"
                aria-label="Expandir barra lateral"
                className="h-7 w-9 rounded-md inline-flex items-center justify-center text-[var(--kuara-fg-subtle)] hover:text-[var(--kuara-fg)] hover:bg-[var(--kuara-surface-hover)] transition-colors"
              >
                <PanelLeftOpen className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Grouped navigation */}
          <nav
            aria-label="Navegação do painel"
            className={cn("flex-1 overflow-y-auto py-3 space-y-4", isRail ? "px-2" : "px-2.5")}
          >
            {navGroups.map((group) => (
              <div key={group.label} className="space-y-1">
                {!isRail && (
                  <p className="px-2.5 text-[11px] font-medium text-[var(--kuara-fg-subtle)]">
                    {group.label}
                  </p>
                )}

                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isTabActive = currentTab === item.id;
                    const badge = resolveBadge(item.id);
                    const badgeTone = badge?.tone || "neutral";

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleItemClick(item)}
                        title={isRail ? item.label : undefined}
                        aria-current={isTabActive ? "page" : undefined}
                        className={cn(
                          "relative w-full h-8 rounded-md flex items-center transition-colors text-xs font-medium",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--kuara-ring)]",
                          isRail ? "justify-center px-0" : "justify-between px-2.5 gap-2",
                          isTabActive
                            ? "bg-[var(--kuara-surface)] text-[var(--kuara-fg)] border border-[var(--kuara-border)] shadow-panel"
                            : "text-[var(--kuara-fg-muted)] border border-transparent hover:bg-[var(--kuara-surface-hover)] hover:text-[var(--kuara-fg)]"
                        )}
                      >
                        {isTabActive && !isRail && (
                          <span
                            aria-hidden="true"
                            className="absolute left-0 top-1.5 bottom-1.5 w-[2.5px] rounded-r bg-[var(--kuara-primary)]"
                          />
                        )}

                        <span className="flex items-center gap-2 min-w-0">
                          <Icon
                            className={cn(
                              "w-4 h-4 shrink-0",
                              isTabActive
                                ? "text-[var(--kuara-primary)]"
                                : "text-[var(--kuara-fg-subtle)]"
                            )}
                          />
                          {!isRail && <span className="truncate">{item.label}</span>}
                        </span>

                        {!isRail && badge && (
                          <span
                            className={cn(
                              "inline-flex items-center justify-center min-w-[20px] h-[18px] px-1.5 rounded border text-[10px] font-semibold tabular-nums shrink-0",
                              BADGE_TONE_CLASSES[badgeTone]
                            )}
                          >
                            {badge.count}
                          </span>
                        )}

                        {isRail && badge && Number(badge.count) > 0 && (
                          <span
                            className={cn(
                              "absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full",
                              BADGE_DOT_CLASSES[badgeTone]
                            )}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </div>

        {/* Footer user card & logout */}
        <div
          className={cn(
            "border-t border-[var(--kuara-border)] shrink-0 space-y-1.5",
            isRail ? "p-2" : "p-2.5"
          )}
        >
          {!isRail && (
            <div className="p-2 rounded-md border border-[var(--kuara-border)] bg-[var(--kuara-surface)] flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-md bg-[var(--kuara-surface-muted)] border border-[var(--kuara-border)] text-[var(--kuara-fg)] flex items-center justify-center text-xs font-semibold shrink-0">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <p className="text-xs font-medium text-[var(--kuara-fg)] truncate">
                    {user.name}
                  </p>
                  <span className="text-[10px] text-[var(--kuara-fg-subtle)] shrink-0">
                    {roleTag}
                  </span>
                </div>
                <p className="text-[10px] text-[var(--kuara-fg-subtle)] truncate">
                  {user.email}
                </p>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              onCloseMobile?.();
              logout();
            }}
            title={isRail ? "Sair da conta" : undefined}
            className={cn(
              "w-full h-8 rounded-md flex items-center gap-2 text-xs font-medium text-[var(--kuara-danger-text)] hover:bg-[var(--kuara-danger-soft)] transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--kuara-ring)]",
              isRail ? "justify-center px-0" : "px-2.5"
            )}
          >
            <LogOut className="w-3.5 h-3.5 shrink-0" />
            {!isRail && <span>Sair</span>}
          </button>
        </div>
      </aside>
    );
  };

  return (
    <>
      {/* Persistent desktop workspace sidebar */}
      <div className="hidden lg:block sticky top-0 h-screen shrink-0 z-30">
        {renderSidebarContent(false)}
      </div>

      {/* Responsive mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-[1px]"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative z-10 h-full">{renderSidebarContent(true)}</div>
        </div>
      )}
    </>
  );
};
