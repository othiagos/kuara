import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { api } from "../api/client";
import * as AuthContextModule from "../contexts/AuthContext";
import { ServiceDetails } from "../pages/ServiceDetails";
import {
  mockAdminUser,
  mockClientUser,
  mockProviderVerified,
  renderWithProviders,
} from "./testUtils";

function renderServiceDetails(orderId: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/services/:id" element={<ServiceDetails />} />
    </Routes>,
    { initialEntries: [`/services/${orderId}`] }
  );
}

describe("ServiceDetails Logic & Requirements Compliance", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("renders totalCents accurately in proposal/contract card and PixModal during ESCROW_PENDING (no NaN or R$ 0,00)", async () => {
    vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({
      user: mockClientUser,
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      reloadUser: vi.fn(),
    });

    const acceptedProposal = {
      id: "prop-1",
      providerId: "provider-1",
      laborCostCents: 35000,
      materialCostCents: 10000,
      totalCents: 45000,
      estimatedDays: 3,
      isAccepted: true,
      status: "ACCEPTED",
      description: "Substituição completa do quadro de distribuição.",
      provider: { id: "provider-1", name: "Carlos Eletricista" },
    };

    vi.spyOn(api, "get").mockImplementation(async (url: string) => {
      if (url === "/services/order-escrow-1") {
        return {
          data: {
            id: "order-escrow-1",
            title: "Troca de Quadro Elétrico",
            description: "Trocar quadro antigo por disjuntores DIN.",
            category: "Elétrica",
            status: "ESCROW_PENDING",
            clientId: "client-1",
            addressCity: "São Paulo",
            addressState: "SP",
            addressLine: "Rua Augusta, 100",
            addressZip: "01305-000",
            acceptedProposalId: "prop-1",
            acceptedProposal,
            proposals: [acceptedProposal],
            escrow: null,
            photos: [],
            completionPhotos: [],
          },
        };
      }
      if (url === "/chat/order-escrow-1") return { data: [] };
      return { data: [] };
    });

    const user = userEvent.setup();
    renderServiceDetails("order-escrow-1");

    await waitFor(() => {
      expect(screen.getByText("Termos do Contrato Digital")).toBeInTheDocument();
    });

    expect(document.body.textContent).not.toContain("NaN");
    expect(screen.getByText(/R\$\s*450,00/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Efetuar Pagamento em Custódia" }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/R\$\s*450,00/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Mão de obra \(retida em custódia\):/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Materiais \(liberação imediata p\/ compra\):/)).toBeInTheDocument();
    expect(within(dialog).getByText(/R\$\s*350,00/)).toBeInTheDocument();
    expect(within(dialog).getByText(/R\$\s*100,00/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Taxa Kuara \(5% s\/ mão de obra\):/)).toBeInTheDocument();
    expect(within(dialog).getByText(/R\$\s*17,50/)).toBeInTheDocument();
    expect(within(dialog).queryByText(/R\$\s*0,00/)).not.toBeInTheDocument();
  });

  it("renders only ONE proposal CTA for an eligible verified provider in pre-acceptance stage", async () => {
    vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({
      user: mockProviderVerified,
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      reloadUser: vi.fn(),
    });

    vi.spyOn(api, "get").mockImplementation(async (url: string) => {
      if (url === "/services/order-open-cta") {
        return {
          data: {
            id: "order-open-cta",
            title: "Instalação de Luminárias LED",
            description: "Instalar 6 luminárias no teto de gesso.",
            category: "Elétrica",
            status: "OPEN",
            clientId: "client-1",
            addressCity: "São Paulo",
            addressState: "SP",
            proposals: [],
            escrow: null,
          },
        };
      }
      return { data: [] };
    });

    renderServiceDetails("order-open-cta");

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { level: 2, name: "Instalação de Luminárias LED" })
      ).toBeInTheDocument();
    });

    const proposalButtons = screen.getAllByRole("button", { name: /Enviar Orçamento/i });
    expect(proposalButtons).toHaveLength(1);
    expect(proposalButtons[0]).toHaveTextContent("Enviar Orçamento Formalizado");
  });

  describe("Reviews visibility & existing order.reviews rendering", () => {
    const finishedOrder = {
      id: "order-fin-rev",
      title: "Manutenção de Ar Condicionado",
      description: "Limpeza e recarga de gás.",
      category: "Climatização",
      status: "FINISHED",
      clientId: "client-1",
      client: { id: "client-1", name: "Maria Contratante" },
      addressCity: "São Paulo",
      addressState: "SP",
      acceptedProposalId: "prop-fin-1",
      acceptedProposal: {
        id: "prop-fin-1",
        providerId: "provider-1",
        totalCents: 28000,
        laborCostCents: 20000,
        materialCostCents: 8000,
        estimatedDays: 1,
        provider: { id: "provider-1", name: "Carlos Eletricista" },
      },
      escrow: {
        status: "RELEASED",
        grossAmountCents: 28000,
        feeAmountCents: 1400,
        netAmountCents: 26600,
        paymentMethod: "PIX",
      },
      reviews: [
        {
          id: "rev-1",
          authorId: "client-1",
          rating: 5,
          tags: ["Pontualidade", "Qualidade do acabamento"],
          comment: "Serviço impecável e rápido!",
          createdAt: "2026-11-12T15:00:00Z",
          author: { name: "Maria Contratante" },
        },
      ],
    };

    beforeEach(() => {
      vi.spyOn(api, "get").mockImplementation(async (url: string) => {
        if (url === "/services/order-fin-rev") return { data: finishedOrder };
        if (url === "/chat/order-fin-rev") return { data: [] };
        return { data: [] };
      });
    });

    it("hides review form for ADMIN while rendering existing order.reviews cleanly", async () => {
      vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({
        user: mockAdminUser,
        loading: false,
        login: vi.fn(),
        logout: vi.fn(),
        reloadUser: vi.fn(),
      });

      renderServiceDetails("order-fin-rev");

      await waitFor(() => {
        expect(screen.getByText("Avaliações Mútuas do Serviço")).toBeInTheDocument();
      });

      expect(screen.getByText(/Serviço impecável e rápido!/)).toBeInTheDocument();
      expect(screen.getByText("Pontualidade")).toBeInTheDocument();
      expect(screen.getByText("5/5")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Publicar Avaliação" })).not.toBeInTheDocument();
    });

    it("hides review form if user already reviewed while rendering existing order.reviews cleanly", async () => {
      vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({
        user: mockClientUser,
        loading: false,
        login: vi.fn(),
        logout: vi.fn(),
        reloadUser: vi.fn(),
      });

      renderServiceDetails("order-fin-rev");

      await waitFor(() => {
        expect(
          screen.getByText("Você já enviou sua avaliação para este serviço.")
        ).toBeInTheDocument();
      });

      expect(screen.getByText(/Serviço impecável e rápido!/)).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Publicar Avaliação" })).not.toBeInTheDocument();
    });

    it("shows review form for accepted provider who has not yet reviewed", async () => {
      vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({
        user: mockProviderVerified,
        loading: false,
        login: vi.fn(),
        logout: vi.fn(),
        reloadUser: vi.fn(),
      });

      renderServiceDetails("order-fin-rev");

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Publicar Avaliação" })).toBeInTheDocument();
      });

      expect(screen.getByText(/Serviço impecável e rápido!/)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Escopo Claro" })).toBeInTheDocument();
    });
  });

  it("renders order.photos, order.completionPhotos, and order.dispute details cleanly", async () => {
    vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({
      user: mockClientUser,
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      reloadUser: vi.fn(),
    });

    vi.spyOn(api, "get").mockImplementation(async (url: string) => {
      if (url === "/services/order-dispute-1") {
        return {
          data: {
            id: "order-dispute-1",
            title: "Reforma de Tomadas",
            description: "Trocar 4 tomadas.",
            category: "Elétrica",
            status: "IN_DISPUTE",
            clientId: "client-1",
            addressCity: "São Paulo",
            addressState: "SP",
            photos: ["https://cdn.kuara.test/problema-1.jpg"],
            completionPhotos: ["https://cdn.kuara.test/entrega-1.jpg"],
            acceptedProposalId: "prop-d1",
            acceptedProposal: {
              id: "prop-d1",
              providerId: "provider-1",
              totalCents: 45000,
              laborCostCents: 35000,
              materialCostCents: 10000,
              estimatedDays: 2,
              provider: { id: "provider-1", name: "Carlos Eletricista" },
            },
            escrow: {
              status: "DISPUTED",
              grossAmountCents: 45000,
              feeAmountCents: 2250,
              netAmountCents: 42750,
              paymentMethod: "PIX",
            },
            dispute: {
              id: "disp-1",
              status: "RESOLVED",
              reason: "Uma das tomadas permaneceu sem aterramento.",
              evidencePhotos: ["https://cdn.kuara.test/disputa-ev.jpg"],
              counterEvidenceReason: "Caixa estava sem fio terra na parede.",
              counterEvidencePhotos: ["https://cdn.kuara.test/contra-ev.jpg"],
              decision: "SPLIT",
              resolutionNotes: "Acordo parcial definido pela mediação.",
              providerReleaseCents: 31500,
              clientRefundCents: 13500,
              createdAt: "2026-11-10T10:00:00Z",
              resolvedAt: "2026-11-11T10:00:00Z",
            },
          },
        };
      }
      if (url === "/chat/order-dispute-1") return { data: [] };
      return { data: [] };
    });

    renderServiceDetails("order-dispute-1");

    await waitFor(() => {
      expect(screen.getByText("Registro de Disputa Arbitral")).toBeInTheDocument();
    });

    expect(screen.getByText("Fotos do Problema / Local (1)")).toBeInTheDocument();
    expect(screen.getByText("Comprovação da Entrega do Serviço (1)")).toBeInTheDocument();
    expect(screen.getByText("Uma das tomadas permaneceu sem aterramento.")).toBeInTheDocument();
    expect(screen.getByText("Evidências da Disputa (1)")).toBeInTheDocument();
    expect(screen.getByText("Caixa estava sem fio terra na parede.")).toBeInTheDocument();
    expect(screen.getByText("Evidências da Contraprova (1)")).toBeInTheDocument();
    expect(screen.getByText("Acordo parcial definido pela mediação.")).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*315,00/)).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*135,00/)).toBeInTheDocument();
  });

  it("does NOT poll /chat/:id when provider lacks chat access, and DOES poll when user has chat access", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({
      user: mockProviderVerified,
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      reloadUser: vi.fn(),
    });

    const getSpy = vi.spyOn(api, "get").mockImplementation(async (url: string) => {
      if (url === "/services/order-no-chat") {
        return {
          data: {
            id: "order-no-chat",
            title: "Ordem Sem Proposta do Prestador",
            description: "Descrição do serviço.",
            category: "Elétrica",
            status: "OPEN",
            clientId: "client-1",
            addressCity: "São Paulo",
            addressState: "SP",
            proposals: [],
            escrow: null,
          },
        };
      }
      if (url === "/services/order-with-chat") {
        return {
          data: {
            id: "order-with-chat",
            title: "Ordem Com Acesso ao Chat",
            description: "Descrição do serviço.",
            category: "Elétrica",
            status: "IN_PROGRESS",
            clientId: "client-1",
            addressCity: "São Paulo",
            addressState: "SP",
            acceptedProposalId: "prop-mine",
            acceptedProposal: {
              id: "prop-mine",
              providerId: "provider-1",
              totalCents: 20000,
              laborCostCents: 20000,
              materialCostCents: 0,
              estimatedDays: 1,
            },
            proposals: [],
            escrow: {
              status: "HELD",
              grossAmountCents: 20000,
              feeAmountCents: 1000,
              netAmountCents: 19000,
            },
          },
        };
      }
      if (url === "/chat/order-with-chat") return { data: [] };
      return { data: [] };
    });

    // 1) Provider without proposal -> NO /chat polling
    const { unmount } = renderServiceDetails("order-no-chat");

    await waitFor(() => {
      expect(screen.getByText("Envie um orçamento para conversar")).toBeInTheDocument();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(9000);
    });

    const chatCallsWithoutAccess = getSpy.mock.calls.filter(([u]) =>
      String(u).startsWith("/chat/")
    );
    expect(chatCallsWithoutAccess).toHaveLength(0);

    unmount();
    getSpy.mockClear();

    // 2) Accepted provider -> /chat/:id IS fetched
    renderServiceDetails("order-with-chat");

    await waitFor(() => {
      expect(getSpy).toHaveBeenCalledWith("/chat/order-with-chat", { params: {} });
    });
  });

  it("hides counter-evidence button for the party that opened the dispute and attributes dispute parties cleanly", async () => {
    vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({
      user: mockClientUser,
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      reloadUser: vi.fn(),
    });

    vi.spyOn(api, "get").mockImplementation(async (url: string) => {
      if (url === "/services/order-disp-attr") {
        return {
          data: {
            id: "order-disp-attr",
            title: "Troca de Torneira",
            description: "Substituição de misturador.",
            category: "Hidráulica",
            status: "IN_DISPUTE",
            clientId: mockClientUser.id,
            client: { id: mockClientUser.id, name: mockClientUser.name },
            addressCity: "São Paulo",
            addressState: "SP",
            acceptedProposalId: "prop-1",
            acceptedProposal: {
              id: "prop-1",
              providerId: "prov-user-1",
              totalCents: 20000,
              laborCostCents: 20000,
              materialCostCents: 0,
              estimatedDays: 1,
              provider: { id: "prov-user-1", name: "João Encanador" },
            },
            escrow: {
              status: "DISPUTED",
              grossAmountCents: 20000,
              feeAmountCents: 1000,
              netAmountCents: 19000,
            },
            dispute: {
              id: "disp-attr",
              openedById: mockClientUser.id,
              status: "PENDING_REVIEW",
              reason: "Torneira continua pingando após instalação.",
              evidencePhotos: [],
              counterEvidencePhotos: [],
              createdAt: "2026-11-11T10:00:00Z",
            },
          },
        };
      }
      if (url === "/chat/order-disp-attr") return { data: [] };
      return { data: [] };
    });

    renderServiceDetails("order-disp-attr");

    await waitFor(() => {
      expect(screen.getByText("Registro de Disputa Arbitral")).toBeInTheDocument();
    });

    expect(
      screen.getByText(
        /Contestação de Contratante \(Maria Contratante\) contra Contratado \(João Encanador\)/
      )
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Enviar Contraprova / Defesa" })
    ).not.toBeInTheDocument();
  });
});
