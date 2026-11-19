import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { api } from "../api/client";
import * as AuthContextModule from "../contexts/AuthContext";
import { AdminDashboard } from "../pages/AdminDashboard";
import { mockAdminUser, renderWithProviders } from "./testUtils";

describe("AdminDashboard Logic & Requirements Compliance", () => {
  const metricsFixture = {
    financial: {
      totalGMVCents: 125000,
      totalRevenueKuaraCents: 15000,
      activeEscrowCents: 50000,
      disputedEscrowCents: 50000,
      refundedTotalCents: 10000,
    },
    counts: {
      totalOrders: 396,
      totalUsers: 42,
      verifiedProviders: 18,
      ordersByStatus: {
        OPEN: 11,
        PROPOSALS_RECEIVED: 22,
        ESCROW_PENDING: 33,
        IN_PROGRESS: 44,
        COMPLETED_PENDING_APPROVAL: 55,
        IN_DISPUTE: 66,
        FINISHED: 77,
        CANCELLED: 88,
      },
    },
  };

  const providersFixture = [
    {
      id: "prof-pend-1",
      userId: "user-prov-1",
      status: "PENDING_VERIFICATION",
      cpfCnpj: "111.222.333-44",
      pixKey: "joao@pix.test",
      categories: ["Hidráulica"],
      documentUrl: "https://cdn.kuara.test/rg.pdf",
      addressProofUrl: "https://cdn.kuara.test/comp.pdf",
      user: {
        id: "user-prov-1",
        name: "João Encanador",
        email: "joao@kuara.test",
        phone: "(11) 96666-3333",
      },
    },
  ];

  const disputesFixture = [
    {
      id: "disp-1",
      serviceOrderId: "order-disp-1234",
      status: "PENDING_REVIEW",
      reason: "Serviço entregue com vazamento persistente.",
      evidencePhotos: ["https://cdn.kuara.test/ev-1.jpg"],
      counterEvidenceReason: "Peça antiga estava trincada.",
      counterEvidencePhotos: [],
      createdAt: "2026-11-11T10:00:00Z",
      serviceOrder: {
        id: "order-disp-1234",
        title: "Troca de Registro Geral",
        completionPhotos: ["https://cdn.kuara.test/comp-1.jpg"],
        client: { name: "Maria Cliente", email: "maria@kuara.test", phone: "(11) 98888-1111" },
        acceptedProposal: {
          provider: { name: "João Encanador", email: "joao@kuara.test", phone: "(11) 96666-3333" },
        },
        escrow: {
          grossAmountCents: 50000,
          feeAmountCents: 2500,
          netAmountCents: 47500,
        },
      },
    },
  ];

  beforeEach(() => {
    vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({
      user: mockAdminUser,
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      reloadUser: vi.fn(),
    });

    vi.spyOn(api, "get").mockImplementation(async (url: string) => {
      if (url === "/admin/metrics") return { data: metricsFixture };
      if (url === "/admin/providers") return { data: providersFixture };
      if (url === "/admin/disputes") return { data: disputesFixture };
      if (url === "/admin/orders") return { data: [] };
      if (url === "/admin/users") return { data: [] };
      return { data: [] };
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders all 8 ordersByStatus keys in overview", async () => {
    renderWithProviders(<AdminDashboard />, { initialEntries: ["/dashboard/admin?tab=overview"] });

    await waitFor(() => {
      expect(screen.getByText("Distribuição Operacional de Chamados")).toBeInTheDocument();
    });

    const expectedStatuses: Array<[string, string]> = [
      ["Abertos", "11"],
      ["Com Orçamentos", "22"],
      ["Aguard. Custódia", "33"],
      ["Em Execução", "44"],
      ["Inspeção (72h)", "55"],
      ["Em Disputa", "66"],
      ["Finalizados", "77"],
      ["Cancelados", "88"],
    ];

    for (const [label, count] of expectedStatuses) {
      const cardBtn = screen.getByRole("button", { name: `${label} ${count}` });
      expect(within(cardBtn).getByText(label)).toBeInTheDocument();
      expect(within(cardBtn).getByText(count)).toBeInTheDocument();
    }
  });

  it("triggers error feedback on partial Promise.allSettled failure instead of silently hiding", async () => {
    const getSpy = vi.spyOn(api, "get").mockImplementation(async (url: string) => {
      if (url === "/admin/metrics") return { data: metricsFixture };
      if (url === "/admin/providers") return { data: providersFixture };
      if (url === "/admin/disputes") {
        throw { response: { data: { error: "Falha no módulo de disputas" } } };
      }
      if (url === "/admin/orders") return { data: [] };
      if (url === "/admin/users") {
        throw { response: { data: { error: "Timeout no diretório" } } };
      }
      return { data: [] };
    });

    const user = userEvent.setup();
    renderWithProviders(<AdminDashboard />, { initialEntries: ["/dashboard/admin?tab=disputes"] });

    await waitFor(() => {
      expect(
        screen.getByText("Falha parcial ao carregar dados administrativos")
      ).toBeInTheDocument();
    });

    expect(screen.getByText("Disputas: Falha no módulo de disputas")).toBeInTheDocument();
    expect(
      screen.getByText("Erro ao carregar 1 bloco(s) operacional(is).")
    ).toBeInTheDocument();

    // Fulfilled metrics data still powers overview tab cleanly when switching
    const aside = document.querySelector("aside") as HTMLElement;
    await user.click(within(aside).getByRole("button", { name: /Visão Geral/ }));
    expect(screen.getByText(/R\$\s*1\.250,00/)).toBeInTheDocument();
    expect(getSpy).toHaveBeenCalledWith("/admin/metrics");
  });

  it("enforces reason in moderation rejection and suspension modals before PATCH /providers/:id/status", async () => {
    const patchSpy = vi.spyOn(api, "patch").mockResolvedValue({ data: {} });
    const user = userEvent.setup();

    renderWithProviders(<AdminDashboard />, {
      initialEntries: ["/dashboard/admin?tab=verification"],
    });

    await waitFor(() => {
      expect(screen.getByText("João Encanador")).toBeInTheDocument();
    });

    // 1) Reject modal enforces required + minLength(5)
    await user.click(screen.getByRole("button", { name: "Rejeitar" }));
    let dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Rejeitar Documentação do Prestador")).toBeInTheDocument();

    let reasonTextarea = within(dialog).getByLabelText(
      "Justificativa / Motivo Registrado"
    ) as HTMLTextAreaElement;
    expect(reasonTextarea).toBeRequired();
    expect(reasonTextarea).toHaveAttribute("minLength", "5");

    // Empty reason blocks submission via required constraint validation
    expect(reasonTextarea.validity.valueMissing).toBe(true);
    expect(reasonTextarea.checkValidity()).toBe(false);
    await user.click(within(dialog).getByRole("button", { name: "Confirmar Rejeição" }));
    expect(patchSpy).not.toHaveBeenCalled();

    // Valid >= 5 chars submits
    await user.type(reasonTextarea, "Documento RG está cortado e ilegível.");
    expect(reasonTextarea.checkValidity()).toBe(true);
    await user.click(within(dialog).getByRole("button", { name: "Confirmar Rejeição" }));

    await waitFor(() => {
      expect(patchSpy).toHaveBeenCalledWith("/providers/prof-pend-1/status", {
        status: "REJECTED",
        rejectionReason: "Documento RG está cortado e ilegível.",
      });
    });

    // 2) Suspend modal enforces reason
    await user.click(screen.getByRole("button", { name: "Suspender" }));
    dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Suspender Conta de Prestador")).toBeInTheDocument();

    reasonTextarea = within(dialog).getByLabelText(
      "Justificativa / Motivo Registrado"
    ) as HTMLTextAreaElement;
    expect(reasonTextarea).toBeRequired();
    expect(reasonTextarea).toHaveAttribute("minLength", "5");
    expect(reasonTextarea.checkValidity()).toBe(false);
    await user.click(within(dialog).getByRole("button", { name: "Confirmar Suspensão" }));
    expect(patchSpy).toHaveBeenCalledTimes(1);

    await user.type(reasonTextarea, "Violação grave da regra anti-desintermediação.");
    await user.click(within(dialog).getByRole("button", { name: "Confirmar Suspensão" }));

    await waitFor(() => {
      expect(patchSpy).toHaveBeenCalledWith("/providers/prof-pend-1/status", {
        status: "SUSPENDED",
        rejectionReason: "Violação grave da regra anti-desintermediação.",
      });
    });
  });

  it("renders and submits SPLIT, REWORK, RELEASE_TO_PROVIDER, and REFUND_TO_CLIENT dispute decisions", async () => {
    const postSpy = vi.spyOn(api, "post").mockResolvedValue({ data: {} });
    const user = userEvent.setup();

    renderWithProviders(<AdminDashboard />, {
      initialEntries: ["/dashboard/admin?tab=disputes"],
    });

    await waitFor(() => {
      expect(screen.getByText("Troca de Registro Geral")).toBeInTheDocument();
    });

    const releaseBtn = screen.getByRole("button", { name: "Liberar 100% ao Prestador" });
    const refundBtn = screen.getByRole("button", { name: "Estornar 100% ao Cliente" });
    const splitBtn = screen.getByRole("button", { name: "Acordo / Divisão Parcial" });
    const reworkBtn = screen.getByRole("button", { name: "Retornar para Retrabalho" });

    expect(releaseBtn).toBeInTheDocument();
    expect(refundBtn).toBeInTheDocument();
    expect(splitBtn).toBeInTheDocument();
    expect(reworkBtn).toBeInTheDocument();

    // 1) SPLIT
    await user.click(splitBtn);
    let dialog = screen.getByRole("dialog");
    const pctInput = within(dialog).getByLabelText("Percentual destinado ao Prestador (%)");
    await user.clear(pctInput);
    await user.type(pctInput, "60");

    expect(within(dialog).getByText(/R\$\s*300,00/)).toBeInTheDocument();
    expect(within(dialog).getByText(/R\$\s*200,00/)).toBeInTheDocument();

    await user.type(
      within(dialog).getByLabelText("Parecer / Justificativa Administrativa"),
      "Acordo parcial de 60% devido a peça preexistente."
    );
    await user.click(within(dialog).getByRole("button", { name: "Confirmar Decisão Arbitral" }));

    await waitFor(() => {
      expect(postSpy).toHaveBeenCalledWith("/escrow/dispute/disp-1/resolve", {
        decision: "SPLIT",
        providerSharePercent: 60,
        notes: "Acordo parcial de 60% devido a peça preexistente.",
      });
    });

    // 2) REWORK
    await user.click(screen.getByRole("button", { name: "Retornar para Retrabalho" }));
    dialog = screen.getByRole("dialog");
    await user.type(
      within(dialog).getByLabelText("Parecer / Justificativa Administrativa"),
      "Retornar ao local para vedar a conexão."
    );
    await user.click(within(dialog).getByRole("button", { name: "Confirmar Decisão Arbitral" }));

    await waitFor(() => {
      expect(postSpy).toHaveBeenCalledWith("/escrow/dispute/disp-1/resolve", {
        decision: "REWORK",
        notes: "Retornar ao local para vedar a conexão.",
      });
    });

    // 3) RELEASE_TO_PROVIDER
    await user.click(screen.getByRole("button", { name: "Liberar 100% ao Prestador" }));
    dialog = screen.getByRole("dialog");
    await user.type(
      within(dialog).getByLabelText("Parecer / Justificativa Administrativa"),
      "Evidências confirmam entrega integral."
    );
    await user.click(within(dialog).getByRole("button", { name: "Confirmar Decisão Arbitral" }));

    await waitFor(() => {
      expect(postSpy).toHaveBeenCalledWith("/escrow/dispute/disp-1/resolve", {
        decision: "RELEASE_TO_PROVIDER",
        notes: "Evidências confirmam entrega integral.",
      });
    });

    // 4) REFUND_TO_CLIENT
    await user.click(screen.getByRole("button", { name: "Estornar 100% ao Cliente" }));
    dialog = screen.getByRole("dialog");
    await user.type(
      within(dialog).getByLabelText("Parecer / Justificativa Administrativa"),
      "Serviço não executado conforme contrato."
    );
    await user.click(within(dialog).getByRole("button", { name: "Confirmar Decisão Arbitral" }));

    await waitFor(() => {
      expect(postSpy).toHaveBeenCalledWith("/escrow/dispute/disp-1/resolve", {
        decision: "REFUND_TO_CLIENT",
        notes: "Serviço não executado conforme contrato.",
      });
    });
  });

  it("clearly distinguishes client-opened vs provider-opened disputes and calculates SPLIT on heldPoolCents", async () => {
    vi.spyOn(api, "get").mockImplementation(async (url: string) => {
      if (url === "/admin/metrics") return { data: metricsFixture };
      if (url === "/admin/disputes") {
        return {
          data: {
            items: [
              {
                id: "disp-client",
                serviceOrderId: "ord-client-1",
                openedById: "user-client-1",
                status: "PENDING_REVIEW",
                reason: "Pia voltou a vazar horas depois do reparo.",
                evidencePhotos: ["https://cdn.kuara.test/vazamento.jpg"],
                counterEvidenceReason: "Conexão externa estava oxidada.",
                counterEvidencePhotos: ["https://cdn.kuara.test/tubo.jpg"],
                createdAt: "2026-11-11T10:00:00Z",
                parties: {
                  openedByRole: "CLIENT",
                  contestedRole: "PROVIDER",
                  opener: {
                    role: "CLIENT",
                    label: "Contratante",
                    user: { id: "user-client-1", name: "Ana Contratante" },
                  },
                  contested: {
                    role: "PROVIDER",
                    label: "Contratado",
                    user: { id: "user-prov-1", name: "Bruno Encanador" },
                  },
                },
                serviceOrder: {
                  id: "ord-client-1",
                  title: "Reparo de Sifão da Cozinha",
                  clientId: "user-client-1",
                  client: { id: "user-client-1", name: "Ana Contratante", email: "ana@kuara.test" },
                  acceptedProposal: {
                    providerId: "user-prov-1",
                    provider: { id: "user-prov-1", name: "Bruno Encanador", email: "bruno@kuara.test" },
                  },
                  escrow: {
                    grossAmountCents: 40000,
                    laborAmountCents: 30000,
                    materialsAmountCents: 10000,
                    materialsReleasedAt: "2026-11-10T10:00:00Z",
                    feeAmountCents: 1500,
                    netAmountCents: 28500,
                  },
                },
              },
              {
                id: "disp-prov",
                serviceOrderId: "ord-prov-2",
                openedById: "user-prov-2",
                status: "PENDING_REVIEW",
                reason: "Cliente solicitou pintura adicional fora do escopo aprovado.",
                evidencePhotos: [],
                counterEvidenceReason: null,
                counterEvidencePhotos: [],
                createdAt: "2026-11-12T10:00:00Z",
                serviceOrder: {
                  id: "ord-prov-2",
                  title: "Pintura de Fachada Externa",
                  clientId: "user-client-2",
                  client: { id: "user-client-2", name: "Carlos Cliente", email: "carlos@kuara.test" },
                  acceptedProposal: {
                    providerId: "user-prov-2",
                    provider: { id: "user-prov-2", name: "Diego Pintor", email: "diego@kuara.test" },
                  },
                  escrow: {
                    grossAmountCents: 25000,
                    laborAmountCents: 25000,
                    materialsAmountCents: 0,
                    feeAmountCents: 1250,
                    netAmountCents: 23750,
                  },
                },
              },
            ],
            meta: {
              page: 1,
              limit: 6,
              total: 2,
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
    renderWithProviders(<AdminDashboard />, {
      initialEntries: ["/dashboard/admin?tab=disputes"],
    });

    await waitFor(() => {
      expect(screen.getByText("Reparo de Sifão da Cozinha")).toBeInTheDocument();
    });

    // Dispute 1: Client opened against Provider
    expect(screen.getByText("Contestante: Contratante")).toBeInTheDocument();
    expect(screen.getByText("Parte contestada: Contratado")).toBeInTheDocument();
    expect(screen.getByText("Contestação · Contratante")).toBeInTheDocument();
    expect(screen.getByText("Defesa · Contratado")).toBeInTheDocument();
    expect(screen.getByText(/Evidências enviadas por Contratante \(Ana Contratante\)/)).toBeInTheDocument();
    expect(screen.getByText(/Evidências enviadas por Contratado \(Bruno Encanador\)/)).toBeInTheDocument();

    // Dispute 2: Provider opened against Client + explicit pending counter-evidence indicator
    expect(screen.getByText("Contestante: Contratado")).toBeInTheDocument();
    expect(screen.getByText("Parte contestada: Contratante")).toBeInTheDocument();
    expect(screen.getByText("Contestação · Contratado")).toBeInTheDocument();
    expect(screen.getByText("Defesa · Contratante")).toBeInTheDocument();
    expect(
      screen.getByText(/Nenhuma contraprova enviada até o momento por Contratante \(Carlos Cliente\)/)
    ).toBeInTheDocument();

    // SPLIT modal computes percentages on heldPoolCents (30000 labor, excluding 10000 released materials)
    const splitButtons = screen.getAllByRole("button", { name: "Acordo / Divisão Parcial" });
    await user.click(splitButtons[0]);
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/R\$\s*300,00/)).toBeInTheDocument();
    const pctInput = within(dialog).getByLabelText("Percentual destinado ao Prestador (%)");
    await user.clear(pctInput);
    await user.type(pctInput, "60");
    expect(within(dialog).getByText(/R\$\s*180,00/)).toBeInTheDocument();
    expect(within(dialog).getByText(/R\$\s*120,00/)).toBeInTheDocument();
  });
});
