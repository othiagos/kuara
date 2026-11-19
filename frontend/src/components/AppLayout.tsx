import React, { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sidebar, SidebarBadgeValue } from "./Sidebar";
import { Topbar, TopbarBreadcrumb } from "./Topbar";

export interface AppLayoutProps {
  title?: string;
  subtitle?: string;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  sidebarBadges?: Record<string, SidebarBadgeValue>;
  actions?: React.ReactNode;
  breadcrumbs?: TopbarBreadcrumb[];
  children?: React.ReactNode;
}

const SIDEBAR_STORAGE_KEY = "@kuara:sidebar-collapsed";

export const AppLayout: React.FC<AppLayoutProps> = ({
  title,
  subtitle,
  activeTab,
  onTabChange,
  sidebarBadges,
  actions,
  breadcrumbs,
  children,
}) => {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname, location.search]);

  const handleToggleCollapse = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
      } catch {
        // Ignore storage restrictions
      }
      return next;
    });
  };

  return (
    <div className="flex min-h-screen bg-[var(--kuara-bg)] text-[var(--kuara-fg)] antialiased">
      <Sidebar
        activeTab={activeTab}
        onTabChange={onTabChange}
        badges={sidebarBadges}
        collapsed={collapsed}
        onToggleCollapse={handleToggleCollapse}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <Topbar
          title={title}
          subtitle={subtitle}
          actions={actions}
          breadcrumbs={breadcrumbs}
          onOpenMobileMenu={() => setMobileOpen(true)}
        />

        <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto">
          {children || <Outlet />}
        </main>
      </div>
    </div>
  );
};
