import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { api } from "../api/client";
import * as AuthContextModule from "../contexts/AuthContext";
import { ProviderDashboard } from "../pages/ProviderDashboard";
import {
  mockProviderRejected,
  mockProviderSuspended,
  mockProviderVerified,
  renderWithProviders,
} from "./testUtils";

describe("ProviderDashboard Logic & Requirements Compliance", () => {
  const openOrdersFixture = [
    {
      id: "open-1",
      title: "Instalação de Quadro Elétrico",
      category: "Elétrica",
      addressCity: "São Paulo",
      addressState: "SP",
      createdAt: "2026-11-10T10:00:00Z",
      proposalsCount: 1,
      hasMyProposal: false,
    },
  ];

  const myOrdersFixture = [
    {
      id: "job-active-1",
      title: "Troca de Disjuntores Residenciais",
      status: "IN_PROGRESS",
      addressCity: "São Paulo",
      addressState: "SP",
      createdAt: "2026-11-08T10:00:00Z",
      client: { name: "Maria Cliente" },
      acceptedProposalId: "prop-win-1",
      acceptedProposal: { id: "prop-win-1", providerId: "provider-1", totalCents: 30000 },
      escrow: { grossAmountCents: 30000, feeAmountCents: 1500, netAmountCents: 28500 },
    },
    {
      id: "job-escrow-pending",
      title: "Reparo de Tomada 220V",
      status: "ESCROW_PENDING",
      addressCity: "Campinas",
      addressState: "SP",
      createdAt: "2026-11-09T10:00:00Z",
      client: { name: "João Cliente" },
      acceptedProposalId: "prop-win-2",
      acceptedProposal: { id: "prop-win-2", providerId: "provider-1", totalCents: 25000 },
      escrow: null,
    },
    {
      id: "job-open-bid",
      title: "Orçamento Ainda Aberto (Não Aceito)",
      status: "OPEN",
      addressCity: "Osasco",
      addressState: "SP",
      createdAt: "2026-11-09T11:00:00Z",
      client: { name: "Ana" },
      myProposal: { id: "prop-open-1", providerId: "provider-1", totalCents: 18000, status: "PENDING" },
    },
    {
      id: "job-lost-bid",
      title: "Licitação Perdida Para Concorrente",
      status: "IN_PROGRESS",
      addressCity: "Santo André",
      addressState: "SP",
      createdAt: "2026-11-07T10:00:00Z",
      client: { name: "Pedro" },
      acceptedProposalId: "prop-other-provider",
      acceptedProposal: { id: "prop-other-provider", providerId: "provider-999", totalCents: 40000 },
      myProposal: { id: "prop-lost-1", providerId: "provider-1", totalCents: 45000, status: "REJECTED" },
    },
    {
      id: "job-finished",
      title: "Serviço Já Concluído No Passado",
      status: "FINISHED",
      addressCity: "São Paulo",
      addressState: "SP",
      createdAt: "2026-11-01T10:00:00Z",
      completedAt: "2026-11-03T10:00:00Z",
      client: { name: "Lucia" },
      acceptedProposalId: "prop-fin-1",
      acceptedProposal: { id: "prop-fin-1", providerId: "provider-1", totalCents: 20000 },
    },
  ];

  const walletFixture = {
    inEscrowCents: 30000,
    heldCents: 30000,
    disputedCents: 0,
    availableNetCents: 19000,
    totalEarnedCents: 19000,
    activeServicesCount: 1,
    disputedServicesCount: 0,
    completedServicesCount: 1,
  };

  beforeEach(() => {
    vi.spyOn(api, "get").mockImplementation(async (url: string) => {
      if (url === "/services/open") return { data: openOrdersFixture };
      if (url === "/providers/wallet") return { data: walletFixture };
      if (url === "/services/my") return { data: myOrdersFixture };
      return { data: [] };
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("active_jobs tab renders only activeJobs and excludes OPEN, lost bids, and FINISHED jobs", async () => {
    vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({
      user: mockProviderVerified,
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      reloadUser: vi.fn(),
    });

    const user = userEvent.setup();
    renderWithProviders(<ProviderDashboard />, {
      initialEntries: ["/dashboard/provider?tab=active_jobs"],
    });

    await waitFor(() => {
      expect(screen.getByText("Troca de Disjuntores Residenciais")).toBeInTheDocument();
    });

    // Active jobs are visible (including ESCROW_PENDING won by provider)
    expect(screen.getByText("Reparo de Tomada 220V")).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*237,50/)).toBeInTheDocument();
    expect(screen.getByText(/Bruto:\s*R\$\s*250,00/)).toBeInTheDocument();

    // Raw OPEN, lost bids, and FINISHED must NOT render in activeJobs
    expect(screen.queryByText("Orçamento Ainda Aberto (Não Aceito)")).not.toBeInTheDocument();
    expect(screen.queryByText("Licitação Perdida Para Concorrente")).not.toBeInTheDocument();
    expect(screen.queryByText("Serviço Já Concluído No Passado")).not.toBeInTheDocument();

    // Switching sub-filter to Propostas shows OPEN bid; Histórico shows FINISHED
    await user.click(screen.getByRole("button", { name: /Propostas/ }));
    expect(screen.getByText("Orçamento Ainda Aberto (Não Aceito)")).toBeInTheDocument();
    expect(screen.queryByText("Troca de Disjuntores Residenciais")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Histórico/ }));
    expect(screen.getByText("Serviço Já Concluído No Passado")).toBeInTheDocument();
  });

  it("computes integer-cent 5% fee preview (Math.round(totalCents * 0.05)) and hides fee percentage outside order/ledger context", async () => {
    vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({
      user: mockProviderVerified,
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      reloadUser: vi.fn(),
    });
    const postSpy = vi.spyOn(api, "post").mockResolvedValue({ data: { id: "new-prop" } });

    const user = userEvent.setup();
    renderWithProviders(<ProviderDashboard />, {
      initialEntries: ["/dashboard/provider?tab=mural"],
    });

    await waitFor(() => {
      expect(screen.getByText("Instalação de Quadro Elétrico")).toBeInTheDocument();
    });

    // Outside proposal/order modals, header should NOT show 5% or 12% continuously
    expect(document.body.textContent).not.toMatch(/12%/);
    expect(document.body.textContent).not.toMatch(/5%/);

    await user.click(screen.getByRole("button", { name: "Orçar" }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/Taxa Kuara \(5% sobre mão de obra\):/)).toBeInTheDocument();

    const laborInput = within(dialog).getByLabelText("Mão de Obra (R$)");
    const materialInput = within(dialog).getByLabelText("Materiais (R$)");
    const scopeInput = within(dialog).getByLabelText("Descrição do Escopo do Serviço");

    // Edge case 1: labor = 1003 cents, materials = 0 -> Math.round(1003 * 0.05) = 50 cents (R$ 0,50), net = 953 cents (R$ 9,53)
    await user.clear(laborInput);
    await user.type(laborInput, "10.03");
    await user.clear(materialInput);
    await user.type(materialInput, "0");

    expect(within(dialog).getByText(/R\$\s*10,03/)).toBeInTheDocument();
    expect(within(dialog).getByText(/-\s*R\$\s*0,50/)).toBeInTheDocument();
    expect(within(dialog).getByText(/R\$\s*9,53/)).toBeInTheDocument();

    // Edge case 2: labor = 150.00 (15000 cents) + materials = 33.33 (3333 cents) ->
    // total = 18333 (R$ 183,33), materials advance = 3333 (+ R$ 33,33 immediate, 0% fee),
    // fee 5% on labor only = 750 (- R$ 7,50), net labor held = 14250 (R$ 142,50)
    await user.clear(laborInput);
    await user.type(laborInput, "150");
    await user.clear(materialInput);
    await user.type(materialInput, "33.33");

    expect(within(dialog).getByText(/R\$\s*183,33/)).toBeInTheDocument();
    expect(within(dialog).getByText(/\+\s*R\$\s*33,33/)).toBeInTheDocument();
    expect(within(dialog).getByText(/-\s*R\$\s*7,50/)).toBeInTheDocument();
    expect(within(dialog).getByText(/R\$\s*142,50/)).toBeInTheDocument();

    await user.type(scopeInput, "Substituição completa de disjuntores e barramento.");
    await user.click(within(dialog).getByRole("button", { name: "Formalizar Orçamento" }));

    await waitFor(() => {
      expect(postSpy).toHaveBeenCalledWith("/proposals", {
        serviceOrderId: "open-1",
        description: "Substituição completa de disjuntores e barramento.",
        estimatedDays: 1,
        laborCostCents: 15000,
        materialCostCents: 3333,
        materialPolicy: "PROVIDER_ADVANCE",
      });
    });
  });

  it("verification tab shows rejectionReason when REJECTED, has no dummy URLs, and submits verification docs", async () => {
    const reloadUser = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({
      user: mockProviderRejected,
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      reloadUser,
    });
    const postSpy = vi.spyOn(api, "post").mockResolvedValue({ data: {} });

    const user = userEvent.setup();
    renderWithProviders(<ProviderDashboard />, {
      initialEntries: ["/dashboard/provider?tab=verification"],
    });

    await waitFor(() => {
      expect(screen.getByText("Auditoria Cadastral e Documental")).toBeInTheDocument();
    });

    expect(
      screen.getByText(/Justificativa: Documento com foto ilegível e fora da validade\./)
    ).toBeInTheDocument();

    const docInput = screen.getByLabelText("Documento com Foto (RG ou CNH)") as HTMLInputElement;
    const addrInput = screen.getByLabelText(
      "Comprovante de Residência Atualizado"
    ) as HTMLInputElement;
    const submitBtn = screen.getByRole("button", { name: "Enviar Documentos para Análise" });

    // No hardcoded dummy URLs
    expect(docInput.value).toBe("");
    expect(addrInput.value).toBe("");
    expect(docInput).toBeEnabled();
    expect(addrInput).toBeEnabled();
    expect(submitBtn).toBeEnabled();

    await user.type(docInput, "https://storage.kuara.test/cnh-nova.pdf");
    await user.type(addrInput, "https://storage.kuara.test/conta-luz.pdf");
    await user.click(submitBtn);

    await waitFor(() => {
      expect(postSpy).toHaveBeenCalledWith("/providers/verify", {
        documentUrl: "https://storage.kuara.test/cnh-nova.pdf",
        addressProofUrl: "https://storage.kuara.test/conta-luz.pdf",
      });
    });
    expect(reloadUser).toHaveBeenCalled();
  });

  it("verification tab locks/disables submission when VERIFIED", async () => {
    vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({
      user: mockProviderVerified,
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      reloadUser: vi.fn(),
    });

    renderWithProviders(<ProviderDashboard />, {
      initialEntries: ["/dashboard/provider?tab=verification"],
    });

    await waitFor(() => {
      expect(screen.getByText("Seu perfil já possui o Selo Verificado")).toBeInTheDocument();
    });

    expect(screen.getByLabelText("Documento com Foto (RG ou CNH)")).toBeDisabled();
    expect(screen.getByLabelText("Comprovante de Residência Atualizado")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Documentação Verificada" })).toBeDisabled();
  });

  it("verification tab locks/disables submission and displays reason when SUSPENDED", async () => {
    vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({
      user: mockProviderSuspended,
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      reloadUser: vi.fn(),
    });

    renderWithProviders(<ProviderDashboard />, {
      initialEntries: ["/dashboard/provider?tab=verification"],
    });

    await waitFor(() => {
      expect(screen.getByText("Perfil suspenso pela equipe de moderação")).toBeInTheDocument();
    });

    expect(
      screen.getByText(/Justificativa: Tentativa reiterada de desintermediação\./)
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Documento com Foto (RG ou CNH)")).toBeDisabled();
    expect(screen.getByLabelText("Comprovante de Residência Atualizado")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Enviar Documentos para Análise" })).toBeDisabled();
  });
});
