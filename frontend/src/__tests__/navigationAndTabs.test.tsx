import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { api } from "../api/client";
import * as AuthContextModule from "../contexts/AuthContext";
import { ClientDashboard } from "../pages/ClientDashboard";
import { ProviderDashboard } from "../pages/ProviderDashboard";
import { AdminDashboard } from "../pages/AdminDashboard";
import {
  mockAdminUser,
  mockClientUser,
  mockProviderPending,
  mockProviderVerified,
  renderWithProviders,
} from "./testUtils";

describe("Navigation, Single-Header AppLayout & No Repeated Tab-Switching Buttons", () => {
  beforeEach(() => {
    vi.spyOn(api, "get").mockImplementation(async (url: string) => {
      if (url === "/services/my") return { data: [] };
      if (url === "/providers/showcase") return { data: [] };
      if (url === "/services/open") return { data: [] };
      if (url === "/providers/wallet") {
        return {
          data: {
            inEscrowCents: 0,
            heldCents: 0,
            disputedCents: 0,
            availableNetCents: 0,
            totalEarnedCents: 0,
            activeServicesCount: 0,
            disputedServicesCount: 0,
            completedServicesCount: 0,
          },
        };
      }
      if (url === "/admin/metrics") {
        return {
          data: {
            financial: {
              totalGMVCents: 0,
              totalRevenueKuaraCents: 0,
              activeEscrowCents: 0,
              disputedEscrowCents: 0,
              refundedTotalCents: 0,
            },
            counts: {
              totalOrders: 0,
              totalUsers: 1,
              verifiedProviders: 0,
              ordersByStatus: {},
            },
          },
        };
      }
      if (
        url === "/admin/providers" ||
        url === "/admin/disputes" ||
        url === "/admin/orders" ||
        url === "/admin/users"
      ) {
        return { data: [] };
      }
      return { data: [] };
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function assertNoDuplicateNavbar() {
    const headers = document.querySelectorAll("header");
    expect(headers).toHaveLength(1);
    expect(screen.queryByText("Como funciona")).not.toBeInTheDocument();
    expect(screen.queryByText("Garantias")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Meu Painel" })).not.toBeInTheDocument();
  }

  function assertTabsOnlyInSidebar(tabLabels: string[]) {
    const aside = document.querySelector("aside");
    const main = document.querySelector("main");
    expect(aside).not.toBeNull();
    expect(main).not.toBeNull();

    const sidebarNav = within(aside as HTMLElement).getByRole("navigation", {
      name: "Navegação do painel",
    });

    for (const label of tabLabels) {
      expect(
        within(sidebarNav).getByRole("button", { name: new RegExp(label) })
      ).toBeInTheDocument();

      // Page body (<main>) must never duplicate sidebar tab buttons
      expect(
        within(main as HTMLElement).queryByRole("button", { name: new RegExp(`^${label}$`) })
      ).not.toBeInTheDocument();
    }
  }

  it("ClientDashboard: renders tab switchers only in Sidebar, has no Navbar, and switches tabs via URL search params", async () => {
    vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({
      user: mockClientUser,
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      reloadUser: vi.fn(),
    });

    const user = userEvent.setup();
    renderWithProviders(<ClientDashboard />, { initialEntries: ["/dashboard/client"] });

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith("/services/my", {
        params: { page: 1, limit: 8 },
      });
    });

    assertNoDuplicateNavbar();
    assertTabsOnlyInSidebar(["Minhas Solicitações", "Buscar Profissionais"]);

    const aside = document.querySelector("aside") as HTMLElement;
    const ordersNavBtn = within(aside).getByRole("button", { name: /Minhas Solicitações/ });
    const showcaseNavBtn = within(aside).getByRole("button", { name: /Buscar Profissionais/ });

    expect(ordersNavBtn).toHaveAttribute("aria-current", "page");
    expect(showcaseNavBtn).not.toHaveAttribute("aria-current", "page");

    await user.click(showcaseNavBtn);

    expect(screen.getByTestId("location-probe")).toHaveAttribute("data-search", "?tab=showcase");
    expect(showcaseNavBtn).toHaveAttribute("aria-current", "page");
    expect(
      screen.getByPlaceholderText("Buscar por nome, bio ou especialidade...")
    ).toBeInTheDocument();
  });

  it("ProviderDashboard: renders tab switchers only in Sidebar, suppresses duplicate verification CTA on verification tab, and updates URL params", async () => {
    vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({
      user: mockProviderVerified,
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      reloadUser: vi.fn(),
    });

    const user = userEvent.setup();
    renderWithProviders(<ProviderDashboard />, { initialEntries: ["/dashboard/provider"] });

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith("/services/open", {
        params: { page: 1, limit: 8 },
      });
    });

    assertNoDuplicateNavbar();
    assertTabsOnlyInSidebar([
      "Oportunidades Abertas",
      "Meus Serviços Ativos",
      "Carteira & Repasses",
      "Auditoria Documental",
    ]);

    const aside = document.querySelector("aside") as HTMLElement;
    await user.click(within(aside).getByRole("button", { name: /Meus Serviços Ativos/ }));
    expect(screen.getByTestId("location-probe")).toHaveAttribute("data-search", "?tab=active_jobs");
    expect(screen.getByText("Gerenciamento de Serviços e Propostas")).toBeInTheDocument();

    await user.click(within(aside).getByRole("button", { name: /Carteira & Repasses/ }));
    expect(screen.getByTestId("location-probe")).toHaveAttribute("data-search", "?tab=wallet");
    expect(screen.getByText("Dados para Recebimento de Repasses")).toBeInTheDocument();
  });

  it("ProviderDashboard: hides 'Enviar Documentos' banner tab-switch button when already on verification tab", async () => {
    vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({
      user: mockProviderPending,
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      reloadUser: vi.fn(),
    });

    renderWithProviders(<ProviderDashboard />, {
      initialEntries: ["/dashboard/provider?tab=verification"],
    });

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith("/providers/wallet");
    });

    expect(api.get).not.toHaveBeenCalledWith("/services/open", expect.anything());
    expect(screen.getByText("Auditoria Documental Pendente")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Enviar Documentos" })).not.toBeInTheDocument();
  });

  it("AdminDashboard: renders tab switchers only in Sidebar, has no Navbar, and switches tabs via URL search params", async () => {
    vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({
      user: mockAdminUser,
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      reloadUser: vi.fn(),
    });

    const user = userEvent.setup();
    renderWithProviders(<AdminDashboard />, { initialEntries: ["/dashboard/admin"] });

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith("/admin/metrics");
    });

    assertNoDuplicateNavbar();
    assertTabsOnlyInSidebar([
      "Visão Geral & KPIs",
      "Moderação Documental",
      "Central de Disputas",
      "Auditoria de Pedidos",
      "Diretório de Usuários",
    ]);

    const aside = document.querySelector("aside") as HTMLElement;
    await user.click(within(aside).getByRole("button", { name: /Moderação Documental/ }));
    expect(screen.getByTestId("location-probe")).toHaveAttribute("data-search", "?tab=verification");
    expect(screen.getByText("Moderação e Auditoria de Prestadores")).toBeInTheDocument();

    await user.click(within(aside).getByRole("button", { name: /Central de Disputas/ }));
    expect(screen.getByTestId("location-probe")).toHaveAttribute("data-search", "?tab=disputes");
    expect(screen.getByText("Central de Mediação & Arbitragem")).toBeInTheDocument();
  });
});
