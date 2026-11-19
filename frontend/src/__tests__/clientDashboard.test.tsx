import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { api } from "../api/client";
import * as AuthContextModule from "../contexts/AuthContext";
import { ClientDashboard } from "../pages/ClientDashboard";
import { mockClientUser, renderWithProviders } from "./testUtils";

describe("ClientDashboard Logic & Requirements Compliance", () => {
  const clientOrdersFixture = [
    {
      id: "order-open-1",
      title: "Vazamento na Pia da Cozinha",
      description: "Trocar sifão e vedação",
      category: "Hidráulica",
      addressCity: "São Paulo",
      addressState: "SP",
      status: "OPEN",
      createdAt: "2026-11-10T10:00:00Z",
      proposalsCount: 0,
    },
    {
      id: "order-prop-2",
      title: "Pintura Sala e Corredor",
      description: "Duas demãos em látex branco",
      category: "Pintura",
      addressCity: "Osasco",
      addressState: "SP",
      status: "PROPOSALS_RECEIVED",
      createdAt: "2026-11-09T10:00:00Z",
      proposalsCount: 2,
    },
    {
      id: "order-prog-3",
      title: "Revisão do Quadro Elétrico",
      description: "Troca de DR e disjuntores",
      category: "Elétrica",
      addressCity: "Campinas",
      addressState: "SP",
      status: "IN_PROGRESS",
      createdAt: "2026-11-08T10:00:00Z",
      proposalsCount: 1,
    },
    {
      id: "order-fin-4",
      title: "Instalação de Ar Condicionado",
      description: "Split 12000 BTUs",
      category: "Climatização",
      addressCity: "Santos",
      addressState: "SP",
      status: "FINISHED",
      completedAt: "2026-11-05T10:00:00Z",
      createdAt: "2026-11-01T10:00:00Z",
      proposalsCount: 3,
    },
    {
      id: "order-canc-5",
      title: "Reboco Muro Lateral",
      description: "Chapisco e emboço",
      category: "Alvenaria",
      addressCity: "Guarulhos",
      addressState: "SP",
      status: "CANCELLED",
      createdAt: "2026-10-29T10:00:00Z",
      proposalsCount: 0,
    },
  ];

  beforeEach(() => {
    vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({
      user: mockClientUser,
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      reloadUser: vi.fn(),
    });

    vi.spyOn(api, "get").mockImplementation(async (url: string) => {
      if (url === "/services/my") return { data: clientOrdersFixture };
      if (url === "/providers/showcase") return { data: [] };
      return { data: [] };
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("provides separate editable Cidade, Estado (UF), and CEP inputs in create order modal", async () => {
    const postSpy = vi.spyOn(api, "post").mockResolvedValue({ data: { id: "new-order" } });
    const user = userEvent.setup();

    renderWithProviders(<ClientDashboard />, { initialEntries: ["/dashboard/client"] });

    await waitFor(() => {
      expect(screen.getByText("Vazamento na Pia da Cozinha")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Nova Solicitação" }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).queryByLabelText(/Cidade \/ Estado/i)).not.toBeInTheDocument();

    const titleInput = within(dialog).getByLabelText("Título do Serviço");
    const zipInput = within(dialog).getByLabelText("CEP") as HTMLInputElement;
    const cityInput = within(dialog).getByLabelText("Cidade") as HTMLInputElement;
    const stateSelect = within(dialog).getByLabelText("Estado (UF)") as HTMLSelectElement;
    const addressLineInput = within(dialog).getByLabelText(
      "Endereço (Logradouro, Número e Bairro)"
    );
    const descInput = within(dialog).getByLabelText("Descrição Detalhada do Reparo");

    await user.type(titleInput, "Instalação de Chuveiro Elétrico");
    await user.type(zipInput, "20040020");
    expect(zipInput.value).toBe("20040-020");

    await user.type(cityInput, "Niterói");
    expect(cityInput.value).toBe("Niterói");

    await user.selectOptions(stateSelect, "RJ");
    expect(stateSelect.value).toBe("RJ");

    await user.type(addressLineInput, "Rua Moreira César, 210 - Icaraí");
    await user.type(descInput, "Substituir chuveiro antigo e revisar fiação 6mm.");

    await user.click(within(dialog).getByRole("button", { name: "Publicar Solicitação" }));

    await waitFor(() => {
      expect(postSpy).toHaveBeenCalledWith("/services", {
        title: "Instalação de Chuveiro Elétrico",
        description: "Substituir chuveiro antigo e revisar fiação 6mm.",
        category: "Elétrica",
        addressCity: "Niterói",
        addressState: "RJ",
        addressZip: "20040-020",
        addressLine: "Rua Moreira César, 210 - Icaraí",
      });
    });
  });

  it("filters orders accurately via the status filter ButtonGroup", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ClientDashboard />, { initialEntries: ["/dashboard/client"] });

    await waitFor(() => {
      expect(screen.getByText("Vazamento na Pia da Cozinha")).toBeInTheDocument();
    });

    const filterGroup = screen.getByRole("group");

    // Abertos -> OPEN + PROPOSALS_RECEIVED
    await user.click(within(filterGroup).getByRole("button", { name: /Abertos/ }));
    expect(screen.getByText("Vazamento na Pia da Cozinha")).toBeInTheDocument();
    expect(screen.getByText("Pintura Sala e Corredor")).toBeInTheDocument();
    expect(screen.queryByText("Revisão do Quadro Elétrico")).not.toBeInTheDocument();
    expect(screen.queryByText("Instalação de Ar Condicionado")).not.toBeInTheDocument();
    expect(screen.queryByText("Reboco Muro Lateral")).not.toBeInTheDocument();

    // Em Execução -> IN_PROGRESS
    await user.click(within(filterGroup).getByRole("button", { name: /Em Execução/ }));
    expect(screen.getByText("Revisão do Quadro Elétrico")).toBeInTheDocument();
    expect(screen.queryByText("Vazamento na Pia da Cozinha")).not.toBeInTheDocument();
    expect(screen.queryByText("Instalação de Ar Condicionado")).not.toBeInTheDocument();

    // Concluídos -> FINISHED
    await user.click(within(filterGroup).getByRole("button", { name: /Concluídos/ }));
    expect(screen.getByText("Instalação de Ar Condicionado")).toBeInTheDocument();
    expect(screen.queryByText("Revisão do Quadro Elétrico")).not.toBeInTheDocument();

    // Todos -> all 5
    await user.click(within(filterGroup).getByRole("button", { name: /Todos/ }));
    expect(screen.getByText("Vazamento na Pia da Cozinha")).toBeInTheDocument();
    expect(screen.getByText("Reboco Muro Lateral")).toBeInTheDocument();
  });

  it("cancels an order via modal and calls PATCH /services/:id/cancel", async () => {
    const patchSpy = vi.spyOn(api, "patch").mockResolvedValue({ data: { status: "CANCELLED" } });
    const user = userEvent.setup();

    renderWithProviders(<ClientDashboard />, { initialEntries: ["/dashboard/client"] });

    await waitFor(() => {
      expect(screen.getByText("Vazamento na Pia da Cozinha")).toBeInTheDocument();
    });

    const row = screen.getByText("Vazamento na Pia da Cozinha").closest("tr") as HTMLElement;
    await user.click(within(row).getByRole("button", { name: "Cancelar" }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Cancelar Solicitação")).toBeInTheDocument();

    await user.type(
      within(dialog).getByLabelText("Motivo do Cancelamento (Opcional)"),
      "Reforma adiada"
    );
    await user.click(within(dialog).getByRole("button", { name: "Confirmar Cancelamento" }));

    await waitFor(() => {
      expect(patchSpy).toHaveBeenCalledWith("/services/order-open-1/cancel", {
        reason: "Reforma adiada",
      });
    });
  });
});
