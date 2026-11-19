import { describe, it, expect, vi, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { api } from "../api/client";
import * as AuthContextModule from "../contexts/AuthContext";
import { Navbar } from "../components/Navbar";
import { Home } from "../pages/Home";
import { mockClientUser, mockProviderVerified, renderWithProviders } from "./testUtils";

describe("Home Landing Page Redesign & Fee Visibility", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does NOT render professionals directory or platform fee percentage on Home or Navbar", () => {
    vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({
      user: null,
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      reloadUser: vi.fn(),
    });
    const getSpy = vi.spyOn(api, "get");

    renderWithProviders(
      <>
        <Navbar />
        <Home />
      </>
    );

    expect(getSpy).not.toHaveBeenCalledWith("/providers/showcase", expect.anything());
    expect(getSpy).not.toHaveBeenCalled();

    expect(screen.queryByText(/Vitrine de Profissionais/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Profissionais Verificados na Região/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Taxa por Sucesso/i)).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/12%|5%|R\$/);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Resolva reparos em casa com profissionais verificados e serviço garantido",
      })
    ).toBeInTheDocument();
  });

  it("switches interactive service cycle stages focusing on the hiring and delivery problems solved", async () => {
    vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({
      user: null,
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      reloadUser: vi.fn(),
    });

    const user = userEvent.setup();
    renderWithProviders(<Home />);

    // Default stage is 3. Execução (no material lockup, contact & materials unlocked upon agreement)
    expect(screen.getByText("Combinado formalizado para os dois lados")).toBeInTheDocument();
    expect(screen.getByText("Insumos da obra")).toBeInTheDocument();
    expect(screen.getByText("Disponíveis")).toBeInTheDocument();
    expect(screen.getByText("Contatos e endereço")).toBeInTheDocument();
    expect(screen.getByText("Liberados")).toBeInTheDocument();

    // Switch to 1. Pedido -> privacy active before hiring
    await user.click(screen.getByRole("button", { name: "1. Pedido" }));
    expect(screen.getByText("Privacidade antes de contratar")).toBeInTheDocument();
    expect(screen.getByText("Oculto")).toBeInTheDocument();

    // Switch to 2. Propostas -> transparent comparison without predatory price war
    await user.click(screen.getByRole("button", { name: "2. Propostas" }));
    expect(screen.getByText("Comparação transparente")).toBeInTheDocument();

    // Switch to 4. Entrega -> 72h home verification and mediation
    await user.click(screen.getByRole("button", { name: "4. Entrega" }));
    expect(screen.getByText("Garantia pós-serviço e mediação")).toBeInTheDocument();
  });

  it("adapts Hero CTAs cleanly for logged-in CLIENT and PROVIDER sessions", () => {
    vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({
      user: mockClientUser,
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      reloadUser: vi.fn(),
    });

    const { unmount } = renderWithProviders(<Home />);
    expect(
      screen.getByRole("link", { name: /Nova Solicitação de Serviço/i })
    ).toHaveAttribute("href", "/dashboard/client?newRequest=1");
    expect(screen.getByRole("link", { name: "Acompanhar Meus Pedidos" })).toHaveAttribute(
      "href",
      "/dashboard/client"
    );
    expect(screen.getByRole("link", { name: "Elétrica" })).toHaveAttribute(
      "href",
      "/dashboard/client?tab=orders&newRequest=1&category=El%C3%A9trica"
    );
    unmount();

    vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({
      user: mockProviderVerified,
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      reloadUser: vi.fn(),
    });

    renderWithProviders(<Home />);
    expect(
      screen.getByRole("link", { name: /Ver Oportunidades Abertas/i })
    ).toHaveAttribute("href", "/dashboard/provider?tab=mural");
    expect(screen.getByRole("link", { name: "Meus Serviços Ativos" })).toHaveAttribute(
      "href",
      "/dashboard/provider?tab=active_jobs"
    );
  });
});
