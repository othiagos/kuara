import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { api } from "../api/client";
import * as AuthContextModule from "../contexts/AuthContext";
import { Pagination } from "../components/ui";
import { ClientDashboard } from "../pages/ClientDashboard";
import { ProviderDashboard } from "../pages/ProviderDashboard";
import { AdminDashboard } from "../pages/AdminDashboard";
import {
  mockAdminUser,
  mockClientUser,
  mockProviderVerified,
  renderWithProviders,
} from "./testUtils";

describe("Pagination UI & Lazy Server-Side Dashboard Fetching", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("<Pagination /> primitive", () => {
    it("hides when total is zero or single page by default", () => {
      const { rerender } = renderWithProviders(
        <Pagination
          page={1}
          totalPages={1}
          total={0}
          limit={10}
          onPageChange={vi.fn()}
          itemLabel="pedidos"
        />
      );
      expect(screen.queryByRole("navigation", { name: "Paginação" })).not.toBeInTheDocument();

      rerender(
        <Pagination
          page={1}
          totalPages={1}
          total={5}
          limit={10}
          onPageChange={vi.fn()}
          itemLabel="pedidos"
        />
      );
      expect(screen.queryByRole("navigation", { name: "Paginação" })).not.toBeInTheDocument();
    });

    it("renders range summary, ellipsis for large page counts, and invokes onPageChange", async () => {
      const onPageChange = vi.fn();
      const user = userEvent.setup();

      renderWithProviders(
        <Pagination
          page={5}
          totalPages={12}
          total={115}
          limit={10}
          onPageChange={onPageChange}
          itemLabel="pedidos"
        />
      );

      const nav = screen.getByRole("navigation", { name: "Paginação" });
      expect(nav).toHaveTextContent("Mostrando 41–50 de 115 pedidos");

      await user.click(within(nav).getByRole("button", { name: "Próxima página" }));
      expect(onPageChange).toHaveBeenCalledWith(6);

      await user.click(within(nav).getByRole("button", { name: "Página anterior" }));
      expect(onPageChange).toHaveBeenCalledWith(4);

      await user.click(within(nav).getByRole("button", { name: "Página 12" }));
      expect(onPageChange).toHaveBeenCalledWith(12);
    });
  });

  describe("ClientDashboard server pagination & lazy showcase", () => {
    beforeEach(() => {
      vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({
        user: mockClientUser,
        loading: false,
        login: vi.fn(),
        logout: vi.fn(),
        reloadUser: vi.fn(),
      });
    });

    it("loads orders paginated without fetching showcase until showcase tab is visited", async () => {
      const getSpy = vi.spyOn(api, "get").mockImplementation(async (url: string, cfg?: any) => {
        if (url === "/services/my") {
          const page = cfg?.params?.page ?? 1;
          return {
            data: {
              items: [
                {
                  id: `ord-p${page}`,
                  title: page === 1 ? "Reparo Página 1" : "Reparo Página 2",
                  category: "Elétrica",
                  addressCity: "São Paulo",
                  addressState: "SP",
                  status: "OPEN",
                  createdAt: "2026-11-10T10:00:00Z",
                  proposalsCount: 0,
                },
              ],
              meta: {
                page,
                limit: 8,
                total: 12,
                totalPages: 2,
                hasNextPage: page === 1,
                hasPrevPage: page === 2,
              },
              summary: {
                totalOrders: 12,
                openCount: 7,
                inProgressCount: 3,
                finishedCount: 2,
              },
            },
          };
        }
        if (url === "/providers/showcase") {
          return {
            data: {
              items: [
                {
                  id: "prov-1",
                  userId: "u-prov-1",
                  status: "VERIFIED",
                  categories: ["Elétrica"],
                  serviceAreas: ["São Paulo"],
                  ratingAverage: 4.9,
                  ratingCount: 15,
                  user: { id: "u-prov-1", name: "Carlos Eletricista" },
                },
              ],
              meta: {
                page: 1,
                limit: 8,
                total: 1,
                totalPages: 1,
                hasNextPage: false,
                hasPrevPage: false,
              },
            },
          };
        }
        return { data: [] };
      });

      const user = userEvent.setup();
      renderWithProviders(<ClientDashboard />, { initialEntries: ["/dashboard/client"] });

      await waitFor(() => {
        expect(screen.getByText("Reparo Página 1")).toBeInTheDocument();
      });

      // Showcase was NOT fetched on orders tab
      expect(getSpy).not.toHaveBeenCalledWith("/providers/showcase", expect.anything());
      expect(screen.getByRole("navigation", { name: "Paginação" })).toHaveTextContent(
        "Mostrando 1–8 de 12 chamados"
      );

      // Navigate to page 2
      await user.click(screen.getByRole("button", { name: "Próxima página" }));
      await waitFor(() => {
        expect(screen.getByText("Reparo Página 2")).toBeInTheDocument();
      });
      expect(getSpy).toHaveBeenCalledWith("/services/my", {
        params: { page: 2, limit: 8 },
      });

      // Switch to Showcase tab -> lazily triggers /providers/showcase
      const aside = document.querySelector("aside") as HTMLElement;
      await user.click(within(aside).getByRole("button", { name: /Buscar Profissionais/ }));
      await waitFor(() => {
        expect(screen.getByText("Carlos Eletricista")).toBeInTheDocument();
      });
      expect(getSpy).toHaveBeenCalledWith("/providers/showcase", {
        params: { page: 1, limit: 8 },
      });
    });
  });

  describe("ProviderDashboard scoped lazy pagination", () => {
    beforeEach(() => {
      vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({
        user: mockProviderVerified,
        loading: false,
        login: vi.fn(),
        logout: vi.fn(),
        reloadUser: vi.fn(),
      });
    });

    it("only fetches active tab endpoint with pagination params and reads badge totals from wallet", async () => {
      const getSpy = vi.spyOn(api, "get").mockImplementation(async (url: string, cfg?: any) => {
        if (url === "/providers/wallet") {
          return {
            data: {
              heldCents: 20000,
              disputedCents: 0,
              availableNetCents: 50000,
              materialsAdvancedCents: 0,
              activeServicesCount: 2,
              activeJobsCount: 3,
              openOpportunitiesCount: 14,
              disputedServicesCount: 0,
              completedServicesCount: 5,
            },
          };
        }
        if (url === "/services/open") {
          const page = cfg?.params?.page ?? 1;
          return {
            data: {
              items: [
                {
                  id: `open-${page}`,
                  title: page === 1 ? "Mural Página 1" : "Mural Página 2",
                  category: "Elétrica",
                  addressCity: "Campinas",
                  addressState: "SP",
                  status: "OPEN",
                  createdAt: "2026-11-10T10:00:00Z",
                  proposalsCount: 1,
                  hasMyProposal: false,
                },
              ],
              meta: {
                page,
                limit: 8,
                total: 14,
                totalPages: 2,
                hasNextPage: page === 1,
                hasPrevPage: page === 2,
              },
              summary: { totalOpen: 14, availableOpenCount: 14 },
            },
          };
        }
        if (url === "/services/my") {
          return {
            data: {
              items: [
                {
                  id: "job-1",
                  title: "Execução Paginada",
                  category: "Hidráulica",
                  addressCity: "Santos",
                  addressState: "SP",
                  status: "IN_PROGRESS",
                  createdAt: "2026-11-10T10:00:00Z",
                  client: { name: "Maria" },
                  escrow: { grossAmountCents: 10000, laborAmountCents: 10000, netAmountCents: 9500 },
                },
              ],
              meta: {
                page: 1,
                limit: 8,
                total: 3,
                totalPages: 1,
                hasNextPage: false,
                hasPrevPage: false,
              },
              summary: { activeCount: 3, bidsCount: 1, historyCount: 5, finishedCount: 5 },
            },
          };
        }
        return { data: [] };
      });

      const user = userEvent.setup();
      renderWithProviders(<ProviderDashboard />, {
        initialEntries: ["/dashboard/provider?tab=mural"],
      });

      await waitFor(() => {
        expect(screen.getByText("Mural Página 1")).toBeInTheDocument();
      });

      // On mural tab, /services/my is NOT fetched upfront
      expect(getSpy).not.toHaveBeenCalledWith("/services/my", expect.anything());
      expect(screen.getByRole("navigation", { name: "Paginação" })).toHaveTextContent(
        "Mostrando 1–8 de 14 oportunidades"
      );

      await user.click(screen.getByRole("button", { name: "Próxima página" }));
      await waitFor(() => {
        expect(screen.getByText("Mural Página 2")).toBeInTheDocument();
      });
      expect(getSpy).toHaveBeenCalledWith("/services/open", {
        params: { page: 2, limit: 8 },
      });

      // Switch to active_jobs -> fetches scoped /services/my
      const aside = document.querySelector("aside") as HTMLElement;
      await user.click(within(aside).getByRole("button", { name: /Meus Serviços Ativos/ }));
      await waitFor(() => {
        expect(screen.getByText("Execução Paginada")).toBeInTheDocument();
      });
      expect(getSpy).toHaveBeenCalledWith("/services/my", {
        params: { scope: "active", page: 1, limit: 8 },
      });
    });
  });

  describe("AdminDashboard lazy tabs & table pagination", () => {
    beforeEach(() => {
      vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({
        user: mockAdminUser,
        loading: false,
        login: vi.fn(),
        logout: vi.fn(),
        reloadUser: vi.fn(),
      });
    });

    it("overview fetches only /admin/metrics, while all_orders paginates on demand", async () => {
      const getSpy = vi.spyOn(api, "get").mockImplementation(async (url: string, cfg?: any) => {
        if (url === "/admin/metrics") {
          return {
            data: {
              financial: {
                totalGMVCents: 100000,
                totalRevenueKuaraCents: 5000,
                activeEscrowCents: 20000,
                disputedEscrowCents: 0,
                refundedTotalCents: 0,
              },
              counts: {
                totalOrders: 24,
                totalUsers: 18,
                verifiedProviders: 6,
                pendingProviders: 2,
                activeDisputes: 1,
                ordersByStatus: { OPEN: 10 },
              },
            },
          };
        }
        if (url === "/admin/orders") {
          const page = cfg?.params?.page ?? 1;
          return {
            data: {
              items: [
                {
                  id: `ord-adm-${page}`,
                  title: page === 1 ? "Ordem Admin Pág 1" : "Ordem Admin Pág 2",
                  category: "Pintura",
                  addressCity: "São Paulo",
                  addressState: "SP",
                  status: "OPEN",
                  createdAt: "2026-11-10T10:00:00Z",
                  client: { name: "Cliente" },
                },
              ],
              meta: {
                page,
                limit: 10,
                total: 24,
                totalPages: 3,
                hasNextPage: page < 3,
                hasPrevPage: page > 1,
              },
            },
          };
        }
        return { data: { items: [], meta: { page: 1, limit: 10, total: 0, totalPages: 1 } } };
      });

      const user = userEvent.setup();
      renderWithProviders(<AdminDashboard />, {
        initialEntries: ["/dashboard/admin?tab=overview"],
      });

      await waitFor(() => {
        expect(screen.getByText("Distribuição Operacional de Chamados")).toBeInTheDocument();
      });

      // Overview must NOT trigger list endpoints upfront
      expect(getSpy).toHaveBeenCalledTimes(1);
      expect(getSpy).toHaveBeenCalledWith("/admin/metrics");

      // Navigating to Auditoria de Pedidos fetches page 1 with limit 10
      const aside = document.querySelector("aside") as HTMLElement;
      await user.click(within(aside).getByRole("button", { name: /Auditoria de Pedidos/ }));
      await waitFor(() => {
        expect(screen.getByText("Ordem Admin Pág 1")).toBeInTheDocument();
      });
      expect(getSpy).toHaveBeenCalledWith("/admin/orders", {
        params: { page: 1, limit: 10 },
      });

      expect(screen.getByRole("navigation", { name: "Paginação" })).toHaveTextContent(
        "Mostrando 1–10 de 24 chamados"
      );

      await user.click(screen.getByRole("button", { name: "Próxima página" }));
      await waitFor(() => {
        expect(screen.getByText("Ordem Admin Pág 2")).toBeInTheDocument();
      });
      expect(getSpy).toHaveBeenCalledWith("/admin/orders", {
        params: { page: 2, limit: 10 },
      });
    });
  });
});
