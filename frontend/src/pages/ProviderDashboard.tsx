import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import {
  createEmptyMeta,
  PaginationMeta,
  parsePaginatedResponse,
} from "../api/pagination";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { AppLayout } from "../components/AppLayout";
import { Badge, Tag } from "../components/Badge";
import {
  Alert,
  Button,
  ButtonGroup,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Divider,
  EmptyState,
  Input,
  Modal,
  Pagination,
  StatCard,
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
  TableSkeleton,
  Textarea,
  buttonVariants,
} from "../components/ui";
import {
  AlertTriangle,
  Briefcase,
  CheckCircle2,
  ChevronRight,
  Clock,
  ExternalLink,
  FileCheck,
  MapPin,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  Wallet,
} from "lucide-react";

const MURAL_PAGE_SIZE = 8;
const JOBS_PAGE_SIZE = 8;
const WALLET_PAGE_SIZE = 8;

interface OpenOrdersSummary {
  totalOpen: number;
  availableOpenCount: number;
}

interface ProviderOrdersSummary {
  activeCount: number;
  bidsCount: number;
  historyCount: number;
  finishedCount: number;
}
type ProviderTab = "mural" | "active_jobs" | "wallet" | "verification";
type JobFilter = "active" | "bids" | "history";

const CATEGORIES = ["", "Elétrica", "Hidráulica", "Pintura", "Alvenaria", "Outros"];

const formatBRL = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format((cents || 0) / 100);

function extractApiError(err: any, fallback: string): string {
  const data = err?.response?.data;
  if (!data) return fallback;
  if (Array.isArray(data.details) && data.details.length > 0) {
    const detailsText = data.details
      .map((d: any) => (d?.path ? `${d.path}: ${d.message}` : d?.message || String(d)))
      .join("; ");
    return data.error ? `${data.error} (${detailsText})` : detailsText;
  }
  return data.error || fallback;
}

function getProposalStatus(proposal: any, order?: any): "ACCEPTED" | "REJECTED" | "PENDING" {
  if (
    proposal?.status === "ACCEPTED" ||
    proposal?.status === "REJECTED" ||
    proposal?.status === "PENDING"
  ) {
    return proposal.status;
  }
  if (
    proposal?.isAccepted ||
    (order?.acceptedProposalId && order.acceptedProposalId === proposal?.id)
  ) {
    return "ACCEPTED";
  }
  if (order?.acceptedProposalId && order.acceptedProposalId !== proposal?.id) {
    return "REJECTED";
  }
  return "PENDING";
}

export const ProviderDashboard: React.FC = () => {
  const { user, reloadUser } = useAuth();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const rawTab = searchParams.get("tab") || "mural";
  const activeTab: ProviderTab = (["mural", "active_jobs", "wallet", "verification"] as const).includes(
    rawTab as ProviderTab
  )
    ? (rawTab as ProviderTab)
    : "mural";

  const [openOrders, setOpenOrders] = useState<any[]>([]);
  const [openOrdersMeta, setOpenOrdersMeta] = useState<PaginationMeta>(() =>
    createEmptyMeta(MURAL_PAGE_SIZE)
  );
  const [openSummary, setOpenSummary] = useState<OpenOrdersSummary | null>(null);
  const [isOpenServerPaginated, setIsOpenServerPaginated] = useState(false);
  const [muralPage, setMuralPage] = useState(1);
  const [loadingMural, setLoadingMural] = useState(false);

  const [myOrders, setMyOrders] = useState<any[]>([]);
  const [myOrdersMeta, setMyOrdersMeta] = useState<PaginationMeta>(() =>
    createEmptyMeta(JOBS_PAGE_SIZE)
  );
  const [mySummary, setMySummary] = useState<ProviderOrdersSummary | null>(null);
  const [isMyServerPaginated, setIsMyServerPaginated] = useState(false);
  const [jobsPage, setJobsPage] = useState(1);
  const [loadingJobs, setLoadingJobs] = useState(false);

  const [walletJobs, setWalletJobs] = useState<any[]>([]);
  const [walletJobsMeta, setWalletJobsMeta] = useState<PaginationMeta>(() =>
    createEmptyMeta(WALLET_PAGE_SIZE)
  );
  const [isWalletServerPaginated, setIsWalletServerPaginated] = useState(false);
  const [walletPage, setWalletPage] = useState(1);
  const [loadingWalletJobs, setLoadingWalletJobs] = useState(false);

  const [wallet, setWallet] = useState<any>({
    inEscrowCents: 0,
    disputedCents: 0,
    availableNetCents: 0,
    totalEarnedCents: 0,
    activeServicesCount: 0,
    disputedServicesCount: 0,
    completedServicesCount: 0,
  });
  const [loadingWallet, setLoadingWallet] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Mural filters
  const [categoryFilter, setCategoryFilter] = useState("");
  const [muralSearch, setMuralSearch] = useState("");
  const [debouncedMuralSearch, setDebouncedMuralSearch] = useState("");

  // Active jobs sub-filter
  const [jobFilter, setJobFilter] = useState<JobFilter>("active");

  // Proposal modal
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [description, setDescription] = useState("");
  const [laborCostReais, setLaborCostReais] = useState<string>("150");
  const [materialCostReais, setMaterialCostReais] = useState<string>("0");
  const [materialPolicy, setMaterialPolicy] = useState<"CLIENT_SUPPLIES" | "PROVIDER_ADVANCE">(
    "CLIENT_SUPPLIES"
  );
  const [materialsList, setMaterialsList] = useState<string>("");
  const [estimatedDays, setEstimatedDays] = useState<string>("1");
  const [submitting, setSubmitting] = useState(false);
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);

  // Docs verification form (never pre-fill dummy URLs)
  const [docUrl, setDocUrl] = useState<string>(user?.providerProfile?.documentUrl || "");
  const [addressUrl, setAddressUrl] = useState<string>(
    user?.providerProfile?.addressProofUrl || ""
  );
  const [sendingDocs, setSendingDocs] = useState(false);

  useEffect(() => {
    setDocUrl((prev) => prev || user?.providerProfile?.documentUrl || "");
    setAddressUrl((prev) => prev || user?.providerProfile?.addressProofUrl || "");
  }, [user?.providerProfile?.documentUrl, user?.providerProfile?.addressProofUrl]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedMuralSearch(muralSearch);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [muralSearch]);

  const fetchWallet = useCallback(async (): Promise<boolean> => {
    setLoadingWallet(true);
    try {
      const res = await api.get("/providers/wallet");
      setWallet(res.data || {});
      return true;
    } catch {
      return false;
    } finally {
      setLoadingWallet(false);
    }
  }, []);

  const fetchOpenOrders = useCallback(async (): Promise<boolean> => {
    setLoadingMural(true);
    try {
      const params: Record<string, string | number> = {
        page: muralPage,
        limit: MURAL_PAGE_SIZE,
      };
      if (categoryFilter) params.category = categoryFilter;
      if (debouncedMuralSearch.trim()) params.search = debouncedMuralSearch.trim();

      const res = await api.get("/services/open", { params });
      const parsed = parsePaginatedResponse<any, OpenOrdersSummary>(
        res.data,
        MURAL_PAGE_SIZE
      );
      setOpenOrders(parsed.items);
      setOpenOrdersMeta(parsed.meta);
      setOpenSummary(parsed.summary ?? null);
      setIsOpenServerPaginated(parsed.isServerPaginated);
      if (parsed.isServerPaginated && parsed.meta.page !== muralPage) {
        setMuralPage(parsed.meta.page);
      }
      return true;
    } catch {
      return false;
    } finally {
      setLoadingMural(false);
    }
  }, [muralPage, categoryFilter, debouncedMuralSearch]);

  const fetchMyOrders = useCallback(async (): Promise<boolean> => {
    setLoadingJobs(true);
    try {
      const params: Record<string, string | number> = {
        scope: jobFilter,
        page: jobsPage,
        limit: JOBS_PAGE_SIZE,
      };
      const res = await api.get("/services/my", { params });
      const parsed = parsePaginatedResponse<any, ProviderOrdersSummary>(
        res.data,
        JOBS_PAGE_SIZE
      );
      setMyOrders(parsed.items);
      setMyOrdersMeta(parsed.meta);
      setMySummary(parsed.summary ?? null);
      setIsMyServerPaginated(parsed.isServerPaginated);
      if (parsed.isServerPaginated && parsed.meta.page !== jobsPage) {
        setJobsPage(parsed.meta.page);
      }
      return true;
    } catch {
      return false;
    } finally {
      setLoadingJobs(false);
    }
  }, [jobFilter, jobsPage]);

  const fetchWalletLedger = useCallback(async (): Promise<boolean> => {
    setLoadingWalletJobs(true);
    try {
      const params: Record<string, string | number> = {
        scope: "finished",
        page: walletPage,
        limit: WALLET_PAGE_SIZE,
      };
      const res = await api.get("/services/my", { params });
      const parsed = parsePaginatedResponse<any, ProviderOrdersSummary>(
        res.data,
        WALLET_PAGE_SIZE
      );
      setWalletJobs(parsed.items);
      setWalletJobsMeta(parsed.meta);
      if (parsed.summary) setMySummary(parsed.summary);
      setIsWalletServerPaginated(parsed.isServerPaginated);
      if (parsed.isServerPaginated && parsed.meta.page !== walletPage) {
        setWalletPage(parsed.meta.page);
      }
      return true;
    } catch {
      return false;
    } finally {
      setLoadingWalletJobs(false);
    }
  }, [walletPage]);

  const fetchDashboardData = useCallback(async () => {
    setLoadError(null);
    const failedLabels: string[] = [];

    const tasks: Array<Promise<void>> = [
      fetchWallet().then((ok) => {
        if (!ok) failedLabels.push("carteira financeira");
      }),
    ];

    if (activeTab === "mural") {
      tasks.push(
        fetchOpenOrders().then((ok) => {
          if (!ok) failedLabels.push("oportunidades abertas");
        })
      );
    } else if (activeTab === "active_jobs") {
      tasks.push(
        fetchMyOrders().then((ok) => {
          if (!ok) failedLabels.push("meus serviços");
        })
      );
    } else if (activeTab === "wallet") {
      tasks.push(
        fetchWalletLedger().then((ok) => {
          if (!ok) failedLabels.push("histórico financeiro");
        })
      );
    }

    await Promise.all(tasks);

    if (failedLabels.length > 0) {
      const msg = `Falha ao carregar: ${failedLabels.join(", ")}.`;
      setLoadError(msg);
      toast.error(msg);
    }
  }, [activeTab, fetchWallet, fetchOpenOrders, fetchMyOrders, fetchWalletLedger, toast]);

  useEffect(() => {
    let active = true;
    setLoadError(null);
    fetchWallet().then((ok) => {
      if (active && !ok) {
        const msg = "Falha ao carregar: carteira financeira.";
        setLoadError(msg);
        toast.error(msg);
      }
    });
    return () => {
      active = false;
    };
  }, [fetchWallet, toast]);

  useEffect(() => {
    let active = true;
    if (activeTab === "mural") {
      fetchOpenOrders().then((ok) => {
        if (active && !ok) {
          const msg = "Falha ao carregar: oportunidades abertas.";
          setLoadError(msg);
          toast.error(msg);
        }
      });
    }
    return () => {
      active = false;
    };
  }, [activeTab, fetchOpenOrders, toast]);

  useEffect(() => {
    let active = true;
    if (activeTab === "active_jobs") {
      fetchMyOrders().then((ok) => {
        if (active && !ok) {
          const msg = "Falha ao carregar: meus serviços.";
          setLoadError(msg);
          toast.error(msg);
        }
      });
    }
    return () => {
      active = false;
    };
  }, [activeTab, fetchMyOrders, toast]);

  useEffect(() => {
    let active = true;
    if (activeTab === "wallet") {
      fetchWalletLedger().then((ok) => {
        if (active && !ok) {
          const msg = "Falha ao carregar: histórico financeiro.";
          setLoadError(msg);
          toast.error(msg);
        }
      });
    }
    return () => {
      active = false;
    };
  }, [activeTab, fetchWalletLedger, toast]);

  const loading =
    activeTab === "mural"
      ? loadingMural
      : activeTab === "active_jobs"
      ? loadingJobs
      : activeTab === "wallet"
      ? loadingWallet || loadingWalletJobs
      : loadingWallet;

  const providerStatus = user?.providerProfile?.status || "PENDING_VERIFICATION";
  const isVerified = providerStatus === "VERIFIED";
  const isSuspended = providerStatus === "SUSPENDED";
  const isRejected = providerStatus === "REJECTED";
  const rejectionReason = user?.providerProfile?.rejectionReason;

  // Integer-cent 5% fee preview on labor only (materials advance passes through without fee/hold)
  const laborCents = Math.max(0, Math.round((Number(laborCostReais) || 0) * 100));
  const materialCents = Math.max(0, Math.round((Number(materialCostReais) || 0) * 100));
  const effectivePolicy =
    materialCents > 0 ? "PROVIDER_ADVANCE" : materialPolicy;
  const totalProposalCents = laborCents + materialCents;
  const kuaraFeeCents = Math.round(laborCents * 0.05);
  const netLaborCents = laborCents - kuaraFeeCents;
  const netEarningsCents = netLaborCents;

  const myProposedOrderIds = useMemo(() => {
    const ids = new Set<string>();
    for (const o of myOrders) {
      const hasMyProp =
        Boolean(o.myProposal) ||
        (Array.isArray(o.proposals) && o.proposals.some((p: any) => p.providerId === user?.id)) ||
        o.acceptedProposal?.providerId === user?.id;
      if (hasMyProp) ids.add(o.id);
    }
    for (const o of openOrders) {
      if (
        o.hasMyProposal ||
        (Array.isArray(o.proposals) && o.proposals.some((p: any) => p.providerId === user?.id))
      ) {
        ids.add(o.id);
      }
    }
    return ids;
  }, [myOrders, openOrders, user?.id]);

  const activeJobs = useMemo(
    () =>
      myOrders.filter(
        (o) =>
          ["ESCROW_PENDING", "IN_PROGRESS", "COMPLETED_PENDING_APPROVAL", "IN_DISPUTE"].includes(
            o.status
          ) &&
          (!o.acceptedProposalId || o.acceptedProposal?.providerId === user?.id)
      ),
    [myOrders, user?.id]
  );

  const pendingBidOrders = useMemo(
    () => myOrders.filter((o) => ["OPEN", "PROPOSALS_RECEIVED"].includes(o.status)),
    [myOrders]
  );

  const historyJobs = useMemo(
    () => myOrders.filter((o) => ["FINISHED", "CANCELLED"].includes(o.status)),
    [myOrders]
  );

  const finishedJobs = useMemo(
    () =>
      myOrders.filter(
        (o) =>
          o.status === "FINISHED" &&
          (!o.acceptedProposalId || o.acceptedProposal?.providerId === user?.id)
      ),
    [myOrders, user?.id]
  );

  const availableOpenCount = useMemo(
    () =>
      openOrders.filter((o) => {
        const count = o.proposalsCount ?? o._count?.proposals ?? o.proposals?.length ?? 0;
        const already = Boolean(o.hasMyProposal) || myProposedOrderIds.has(o.id);
        return !already && count < 4;
      }).length,
    [openOrders, myProposedOrderIds]
  );

  const filteredOpenOrders = useMemo(() => {
    if (isOpenServerPaginated) return openOrders;
    const q = muralSearch.trim().toLowerCase();
    return openOrders.filter((o) => {
      if (categoryFilter && o.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        o.title?.toLowerCase().includes(q) ||
        o.addressCity?.toLowerCase().includes(q) ||
        o.category?.toLowerCase().includes(q)
      );
    });
  }, [isOpenServerPaginated, openOrders, categoryFilter, muralSearch]);

  const displayedJobs = useMemo(() => {
    if (isMyServerPaginated) return myOrders;
    if (jobFilter === "active") return activeJobs;
    if (jobFilter === "bids") return pendingBidOrders;
    return historyJobs;
  }, [isMyServerPaginated, myOrders, jobFilter, activeJobs, pendingBidOrders, historyJobs]);

  const displayedWalletJobs = useMemo(() => {
    if (isWalletServerPaginated) return walletJobs;
    const source = walletJobs.length > 0 ? walletJobs : myOrders;
    return source.filter(
      (o) =>
        o.status === "FINISHED" &&
        (!o.acceptedProposalId || o.acceptedProposal?.providerId === user?.id)
    );
  }, [isWalletServerPaginated, walletJobs, myOrders, user?.id]);

  const activeJobsBadgeCount =
    mySummary?.activeCount ??
    (typeof wallet.activeJobsCount === "number" ? wallet.activeJobsCount : activeJobs.length);
  const bidsCount = mySummary?.bidsCount ?? pendingBidOrders.length;
  const historyCount = mySummary?.historyCount ?? historyJobs.length;
  const finishedTotalCount = isWalletServerPaginated
    ? walletJobsMeta.total
    : mySummary?.finishedCount ??
      (typeof wallet.completedServicesCount === "number"
        ? wallet.completedServicesCount
        : finishedJobs.length);
  const muralBadgeCount =
    openSummary?.availableOpenCount ??
    (typeof wallet.openOpportunitiesCount === "number"
      ? wallet.openOpportunitiesCount
      : availableOpenCount);

  const handleOpenProposalModal = (order: any) => {
    setSelectedOrder(order);
    setDescription("");
    setLaborCostReais("150");
    setMaterialCostReais("0");
    setMaterialPolicy("CLIENT_SUPPLIES");
    setMaterialsList("");
    setEstimatedDays("1");
  };

  const handleSendProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    if (!isVerified) {
      toast.error("Apenas prestadores verificados podem enviar orçamentos.");
      return;
    }
    if (laborCents < 500) {
      toast.error("Mínimo de mão de obra permitido: R$ 5,00.");
      return;
    }

    setSubmitting(true);
    try {
      await api.post("/proposals", {
        serviceOrderId: selectedOrder.id,
        description: description.trim(),
        estimatedDays: Number(estimatedDays),
        laborCostCents: laborCents,
        materialCostCents: materialCents,
        materialPolicy: materialCents > 0 ? "PROVIDER_ADVANCE" : "CLIENT_SUPPLIES",
        ...(materialsList.trim() ? { materialsList: materialsList.trim() } : {}),
      });
      toast.success("Orçamento formalizado enviado! Sem custo por lead.");
      setSelectedOrder(null);
      setDescription("");
      setMaterialsList("");
      await fetchDashboardData();
    } catch (err: any) {
      toast.error(extractApiError(err, "Erro ao enviar orçamento."));
    } finally {
      setSubmitting(false);
    }
  };

  const handleWithdrawProposal = async (proposalId: string) => {
    setWithdrawingId(proposalId);
    try {
      await api.delete(`/proposals/${proposalId}`);
      toast.success("Orçamento retirado com sucesso.");
      await fetchDashboardData();
    } catch (err: any) {
      toast.error(extractApiError(err, "Erro ao retirar orçamento."));
    } finally {
      setWithdrawingId(null);
    }
  };

  const handleSubmitDocs = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSuspended) {
      toast.error("Contas suspensas não podem reenviar documentos por conta própria.");
      return;
    }
    if (isVerified) {
      toast.info("Seu perfil já está verificado.");
      return;
    }
    setSendingDocs(true);
    try {
      await api.post("/providers/verify", {
        documentUrl: docUrl.trim(),
        addressProofUrl: addressUrl.trim(),
      });
      toast.success("Documentos enviados para análise da moderação.");
      await reloadUser();
    } catch (err: any) {
      toast.error(extractApiError(err, "Erro ao submeter documentos."));
    } finally {
      setSendingDocs(false);
    }
  };

  const sidebarBadges: React.ComponentProps<typeof AppLayout>["sidebarBadges"] = {
    mural: { count: muralBadgeCount, tone: muralBadgeCount > 0 ? "amber" : "neutral" },
    active_jobs: {
      count: activeJobsBadgeCount,
      tone: activeJobsBadgeCount > 0 ? "blue" : "neutral",
    },
    ...(isRejected || isSuspended
      ? { verification: { count: "!", tone: "rose" as const } }
      : providerStatus === "PENDING_VERIFICATION"
      ? { verification: { count: "1", tone: "amber" as const } }
      : {}),
  };

  const disputedCents = Number(wallet.disputedCents || 0);
  const disputedCount = Number(wallet.disputedServicesCount || 0);
  const heldCents = Number(wallet.heldCents ?? wallet.inEscrowCents ?? 0);
  const activeExecutionCount = Math.max(
    0,
    Number(wallet.activeServicesCount ?? 0) - disputedCount
  );

  return (
    <AppLayout
      title="Painel do Profissional"
      subtitle="Atenda solicitações reais sem pagar por contatos frios e formalize cada combinado."
      activeTab={activeTab}
      onTabChange={(tab) => setSearchParams({ tab })}
      sidebarBadges={sidebarBadges}
      actions={
        <Button
          variant="outline"
          size="sm"
          onClick={fetchDashboardData}
          loading={loading}
          leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
        >
          Atualizar
        </Button>
      }
    >
      <div className="space-y-5">
        {loadError && (
          <Alert
            variant="danger"
            title="Erro parcial ao carregar painel"
            description={loadError}
            action={
              <Button variant="danger-outline" size="xs" onClick={fetchDashboardData}>
                Tentar novamente
              </Button>
            }
          />
        )}

        {/* KPI Cards Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
          <StatCard
            label="Custódia em Execução"
            value={formatBRL(heldCents)}
            hint={`${activeExecutionCount} serviço(s) com pagamento retido`}
            tone="amber"
            icon={<Clock className="w-4 h-4" />}
          />

          <StatCard
            label="Saldo Líquido Liberado"
            value={formatBRL(wallet.availableNetCents || 0)}
            hint={`${wallet.completedServicesCount ?? finishedJobs.length} repasse(s) pago(s)`}
            tone="emerald"
            icon={<TrendingUp className="w-4 h-4" />}
          />

          <StatCard
            label="Em Mediação / Disputa"
            value={formatBRL(disputedCents)}
            hint={
              disputedCount > 0
                ? `${disputedCount} serviço(s) em análise arbitral`
                : "Nenhuma disputa aberta"
            }
            tone={disputedCents > 0 ? "rose" : "neutral"}
            icon={<AlertTriangle className="w-4 h-4" />}
          />

          <StatCard
            label="Status do Cadastro"
            value={<Badge status={providerStatus} />}
            hint={`Pix: ${user?.providerProfile?.pixKey || "Pendente"}`}
            tone={isVerified ? "blue" : isRejected || isSuspended ? "rose" : "neutral"}
            icon={<ShieldCheck className="w-4 h-4" />}
          />
        </div>

        {/* Contextual Verification Banner (No duplicate tab-switch CTA when already on verification tab) */}
        {!isVerified && (
          <Alert
            variant={isRejected || isSuspended ? "danger" : "warning"}
            title={
              isSuspended
                ? "Conta Suspensa pela Moderação"
                : isRejected
                ? "Auditoria Documental Não Aprovada"
                : "Auditoria Documental Pendente"
            }
            description={
              <div className="space-y-1">
                <p>
                  {isSuspended
                    ? "Seu perfil está temporariamente suspenso para o envio de novos orçamentos."
                    : isRejected
                    ? "Sua documentação foi recusada. Revise os links abaixo e reenvie para nova validação."
                    : "Para enviar orçamentos aos clientes, envie seu documento com foto e comprovante de residência."}
                </p>
                {rejectionReason && (
                  <p className="font-medium">Motivo registrado: {rejectionReason}</p>
                )}
              </div>
            }
            action={
              activeTab !== "verification" && !isSuspended ? (
                <Button
                  variant={isRejected ? "danger" : "primary"}
                  size="sm"
                  onClick={() => setSearchParams({ tab: "verification" })}
                >
                  {isRejected ? "Corrigir Documentos" : "Enviar Documentos"}
                </Button>
              ) : undefined
            }
          />
        )}

        {/* TAB 1: MURAL DE OPORTUNIDADES ABERTAS */}
        {activeTab === "mural" && (
          <div className="space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <Input
                size="md"
                placeholder="Buscar por título, cidade ou categoria..."
                value={muralSearch}
                onChange={(e) => {
                  setMuralSearch(e.target.value);
                  setMuralPage(1);
                }}
                leftIcon={<Search className="w-3.5 h-3.5" />}
                containerClassName="w-full lg:max-w-xs"
              />

              <ButtonGroup
                size="sm"
                variant="attached"
                value={categoryFilter}
                onChange={(nextCategory) => {
                  setCategoryFilter(nextCategory);
                  setMuralPage(1);
                }}
                options={CATEGORIES.map((cat) => ({
                  value: cat,
                  label: cat || "Todas",
                }))}
              />
            </div>

            <Table>
              <TableHeader>
                <TableRow interactive={false}>
                  <TableHead>Data</TableHead>
                  <TableHead>Chamado / Região</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Concorrência</TableHead>
                  <TableHead align="right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingMural && (openOrders.length === 0 || isOpenServerPaginated) ? (
                  <TableEmpty colSpan={5}>
                    <TableSkeleton rows={4} />
                  </TableEmpty>
                ) : filteredOpenOrders.length === 0 ? (
                  <TableEmpty colSpan={5}>
                    <EmptyState
                      icon={<Search className="w-4 h-4" />}
                      title="Nenhuma oportunidade encontrada"
                      description="Ajuste os filtros de categoria ou busca para visualizar outros chamados em aberto."
                    />
                  </TableEmpty>
                ) : (
                  filteredOpenOrders.map((o) => {
                    const proposalCount =
                      o.proposalsCount ?? o._count?.proposals ?? o.proposals?.length ?? 0;
                    const hasProposed = Boolean(o.hasMyProposal) || myProposedOrderIds.has(o.id);
                    const isFull = proposalCount >= 4;
                    const isDirectToMe = Boolean(o.targetProviderId && o.targetProviderId === user?.id);
                    const canBid = isVerified && !hasProposed && !isFull;

                    return (
                      <TableRow key={o.id}>
                        <TableCell numeric className="text-[var(--kuara-fg-muted)] whitespace-nowrap">
                          {new Date(o.createdAt).toLocaleDateString("pt-BR")}
                        </TableCell>

                        <TableCell className="min-w-[220px] max-w-md">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Link
                              to={`/services/${o.id}`}
                              className="font-medium text-[var(--kuara-fg)] hover:text-[var(--kuara-primary)] transition-colors truncate"
                            >
                              {o.title}
                            </Link>
                            {isDirectToMe && (
                              <Tag tone="amber">Chamado Direto</Tag>
                            )}
                          </div>
                          <span className="text-[11px] text-[var(--kuara-fg-muted)] flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3 shrink-0 text-[var(--kuara-fg-subtle)]" />
                            <span>
                              {o.addressCity} - {o.addressState}
                            </span>
                          </span>
                        </TableCell>

                        <TableCell>
                          <Tag>{o.category}</Tag>
                        </TableCell>

                        <TableCell>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium tabular-nums text-[var(--kuara-fg)]">
                              {proposalCount}/4
                            </span>
                            {hasProposed ? (
                              <Badge status="PENDING" label="Orçamento Enviado" size="xs" />
                            ) : isFull ? (
                              <Tag tone="neutral">Limite atingido</Tag>
                            ) : (
                              <span className="text-[11px] text-[var(--kuara-fg-subtle)]">
                                vagas abertas
                              </span>
                            )}
                          </div>
                        </TableCell>

                        <TableCell align="right">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            {hasProposed ? (
                              <Link
                                to={`/services/${o.id}`}
                                className={buttonVariants({ variant: "outline", size: "sm" })}
                              >
                                Ver Proposta
                              </Link>
                            ) : (
                              <Button
                                variant={canBid ? "primary" : "outline"}
                                size="sm"
                                disabled={!canBid}
                                title={
                                  !isVerified
                                    ? "Verificação documental necessária para orçar"
                                    : isFull
                                    ? "Este chamado atingiu o limite de 4 propostas"
                                    : "Enviar orçamento formalizado"
                                }
                                onClick={() => handleOpenProposalModal(o)}
                              >
                                {isFull ? "Lotado" : "Orçar"}
                              </Button>
                            )}

                            <Link
                              to={`/services/${o.id}`}
                              title="Inspecionar detalhes"
                              className={buttonVariants({ variant: "ghost", size: "sm", iconOnly: true })}
                            >
                              <ChevronRight className="w-4 h-4" />
                            </Link>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>

            {!loadingMural && (
              <Pagination
                page={openOrdersMeta.page}
                totalPages={openOrdersMeta.totalPages}
                total={openOrdersMeta.total}
                limit={openOrdersMeta.limit}
                onPageChange={setMuralPage}
                itemLabel="oportunidades"
              />
            )}
          </div>
        )}

        {/* TAB 2: MEUS SERVIÇOS ATIVOS */}
        {activeTab === "active_jobs" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-[var(--kuara-fg)]">
                  Gerenciamento de Serviços e Propostas
                </h2>
                <p className="text-xs text-[var(--kuara-fg-muted)]">
                  Acompanhe serviços com custódia garantida, propostas em análise e histórico concluído.
                </p>
              </div>

              <ButtonGroup<JobFilter>
                size="sm"
                variant="segmented"
                value={jobFilter}
                onChange={(nextScope) => {
                  setJobFilter(nextScope);
                  setJobsPage(1);
                }}
                options={[
                  { value: "active", label: "Ativos", count: activeJobsBadgeCount },
                  { value: "bids", label: "Propostas", count: bidsCount },
                  { value: "history", label: "Histórico", count: historyCount },
                ]}
              />
            </div>

            <Table>
              <TableHeader>
                <TableRow interactive={false}>
                  <TableHead>Data</TableHead>
                  <TableHead>Chamado / Contratante</TableHead>
                  <TableHead>Valor Líquido</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead align="right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingJobs && (myOrders.length === 0 || isMyServerPaginated) ? (
                  <TableEmpty colSpan={5}>
                    <TableSkeleton rows={4} />
                  </TableEmpty>
                ) : displayedJobs.length === 0 ? (
                  <TableEmpty colSpan={5}>
                    <EmptyState
                      icon={<Briefcase className="w-4 h-4" />}
                      title={
                        jobFilter === "active"
                          ? "Nenhum serviço ativo no momento"
                          : jobFilter === "bids"
                          ? "Nenhuma proposta aguardando resposta"
                          : "Nenhum serviço finalizado ou cancelado"
                      }
                      description={
                        jobFilter === "active"
                          ? "Assim que um contratante aceitar sua proposta, o serviço aparecerá aqui."
                          : "Explore o Mural de Oportunidades para enviar novos orçamentos sem taxa por lead."
                      }
                      action={
                        jobFilter === "active" ? (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => setSearchParams({ tab: "mural" })}
                          >
                            Ver Oportunidades
                          </Button>
                        ) : undefined
                      }
                    />
                  </TableEmpty>
                ) : (
                  displayedJobs.map((o) => {
                    const myProp =
                      o.myProposal ||
                      o.proposals?.find((p: any) => p.providerId === user?.id);
                    const propStatus = myProp ? getProposalStatus(myProp, o) : null;
                    const grossCents =
                      o.escrow?.grossAmountCents ??
                      o.acceptedProposal?.totalCents ??
                      myProp?.totalCents ??
                      0;
                    const matCents =
                      o.escrow?.materialsAmountCents ??
                      o.acceptedProposal?.materialCostCents ??
                      myProp?.materialCostCents ??
                      0;
                    const laborGrossCents =
                      o.escrow?.laborAmountCents ??
                      o.acceptedProposal?.laborCostCents ??
                      myProp?.laborCostCents ??
                      Math.max(0, grossCents - matCents);
                    const netCents =
                      o.escrow?.netAmountCents ??
                      laborGrossCents - Math.round(laborGrossCents * 0.05);

                    return (
                      <TableRow key={o.id}>
                        <TableCell numeric className="text-[var(--kuara-fg-muted)] whitespace-nowrap">
                          {new Date(o.createdAt).toLocaleDateString("pt-BR")}
                        </TableCell>

                        <TableCell className="min-w-[220px] max-w-md">
                          <Link
                            to={`/services/${o.id}`}
                            className="font-medium text-[var(--kuara-fg)] hover:text-[var(--kuara-primary)] transition-colors block truncate"
                          >
                            {o.title}
                          </Link>
                          <span className="text-[11px] text-[var(--kuara-fg-muted)] block truncate mt-0.5">
                            Cliente: {o.client?.name || "Contratante"} ({o.addressCity} - {o.addressState})
                          </span>
                        </TableCell>

                        <TableCell numeric>
                          <span className="font-semibold text-[var(--kuara-success-text)] block">
                            {formatBRL(netCents)}
                          </span>
                          <span className="text-[11px] text-[var(--kuara-fg-subtle)] block">
                            {matCents > 0
                              ? `M.O. retida • Mat. adiant.: ${formatBRL(matCents)}`
                              : `Bruto: ${formatBRL(grossCents)}`}
                          </span>
                        </TableCell>

                        <TableCell>
                          <div className="flex flex-col items-start gap-1">
                            <Badge status={o.status} />
                            {propStatus && jobFilter === "bids" && (
                              <Badge
                                status={propStatus}
                                size="xs"
                                label={
                                  propStatus === "ACCEPTED"
                                    ? "Proposta Aceita"
                                    : propStatus === "REJECTED"
                                    ? "Não Selecionada"
                                    : "Orçamento Enviado"
                                }
                              />
                            )}
                          </div>
                        </TableCell>

                        <TableCell align="right">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            {jobFilter === "bids" &&
                              myProp?.id &&
                              propStatus === "PENDING" && (
                                <Button
                                  variant="danger-outline"
                                  size="sm"
                                  loading={withdrawingId === myProp.id}
                                  onClick={() => handleWithdrawProposal(myProp.id)}
                                >
                                  Retirar
                                </Button>
                              )}
                            <Link
                              to={`/services/${o.id}`}
                              className={buttonVariants({
                                variant:
                                  o.status === "IN_PROGRESS" || o.status === "IN_DISPUTE"
                                    ? "primary"
                                    : "outline",
                                size: "sm",
                              })}
                            >
                              {o.status === "IN_PROGRESS" ? "Gerenciar / Chat" : "Abrir Detalhes"}
                            </Link>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>

            {!loadingJobs && (
              <Pagination
                page={myOrdersMeta.page}
                totalPages={myOrdersMeta.totalPages}
                total={myOrdersMeta.total}
                limit={myOrdersMeta.limit}
                onPageChange={setJobsPage}
                itemLabel={
                  jobFilter === "bids"
                    ? "propostas"
                    : jobFilter === "history"
                    ? "registros"
                    : "serviços"
                }
              />
            )}
          </div>
        )}

        {/* TAB 3: CARTEIRA & REPASSES */}
        {activeTab === "wallet" && (
          <div className="space-y-5">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-[var(--kuara-primary)]" />
                  <CardTitle>Dados para Recebimento de Repasses</CardTitle>
                </div>
                <CardDescription>
                  Transferências realizadas automaticamente após a aprovação do contratante ou prazo de 72h.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  <div className="p-3.5 rounded-md border border-[var(--kuara-border)] bg-[var(--kuara-surface-muted)]">
                    <span className="text-[11px] font-medium text-[var(--kuara-fg-muted)] block">
                      Chave Pix Cadastrada
                    </span>
                    <p className="text-sm font-semibold text-[var(--kuara-fg)] mt-1 font-mono break-all">
                      {user?.providerProfile?.pixKey || "Não configurada"}
                    </p>
                  </div>

                  <div className="p-3.5 rounded-md border border-[var(--kuara-border)] bg-[var(--kuara-surface-muted)]">
                    <span className="text-[11px] font-medium text-[var(--kuara-fg-muted)] block">
                      Adiantamento de Materiais (Liberados)
                    </span>
                    <p className="text-sm font-semibold text-[var(--kuara-success-text)] mt-1 tabular-nums">
                      {formatBRL(wallet.materialsAdvancedCents || 0)}
                    </p>
                  </div>

                  <div className="p-3.5 rounded-md border border-[var(--kuara-border)] bg-[var(--kuara-surface-muted)]">
                    <span className="text-[11px] font-medium text-[var(--kuara-fg-muted)] block">
                      Documento Identificador (CPF / CNPJ)
                    </span>
                    <p className="text-sm font-semibold text-[var(--kuara-fg)] mt-1 font-mono tabular-nums">
                      {user?.providerProfile?.cpfCnpj || "Não informado"}
                    </p>
                  </div>
                </div>

                <Alert
                  variant="info"
                  title="Separação entre Mão de Obra e Materiais"
                  description="Valores de materiais inclusos no orçamento são liberados imediatamente após o pagamento do cliente para compra dos insumos. A mão de obra permanece retida em custódia até a aprovação ou prazo de 72h."
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Histórico de Faturamento ({finishedTotalCount} concluídos)</CardTitle>
                <CardDescription>
                  Detalhamento de materiais adiantados e repasses líquidos de mão de obra liberados.
                </CardDescription>
              </CardHeader>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <TableHeader>
                    <TableRow interactive={false}>
                      <TableHead>Data</TableHead>
                      <TableHead>Serviço</TableHead>
                      <TableHead align="right">Bruto</TableHead>
                      <TableHead align="right">Materiais (Adiant.)</TableHead>
                      <TableHead align="right">Taxa (5% M.O.)</TableHead>
                      <TableHead align="right">Líquido M.O.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingWalletJobs &&
                    (displayedWalletJobs.length === 0 || isWalletServerPaginated) ? (
                      <TableEmpty colSpan={6}>
                        <TableSkeleton rows={3} />
                      </TableEmpty>
                    ) : displayedWalletJobs.length === 0 ? (
                      <TableEmpty colSpan={6}>
                        <EmptyState
                          compact
                          icon={<Wallet className="w-4 h-4" />}
                          title="Nenhum repasse liquidado ainda"
                          description="Os valores concluídos e aprovados serão exibidos aqui com detalhamento da taxa."
                        />
                      </TableEmpty>
                    ) : (
                      displayedWalletJobs.map((j) => {
                        const gross = j.escrow?.grossAmountCents ?? j.acceptedProposal?.totalCents ?? 0;
                        const mat = j.escrow?.materialsAmountCents ?? j.acceptedProposal?.materialCostCents ?? 0;
                        const laborGross =
                          j.escrow?.laborAmountCents ??
                          j.acceptedProposal?.laborCostCents ??
                          Math.max(0, gross - mat);
                        const fee = j.escrow?.feeAmountCents ?? Math.round(laborGross * 0.05);
                        const net = j.escrow?.netAmountCents ?? laborGross - fee;
                        return (
                          <TableRow key={j.id}>
                            <TableCell numeric className="text-[var(--kuara-fg-muted)] whitespace-nowrap">
                              {new Date(j.completedAt || j.updatedAt).toLocaleDateString("pt-BR")}
                            </TableCell>
                            <TableCell>
                              <Link
                                to={`/services/${j.id}`}
                                className="font-medium text-[var(--kuara-fg)] hover:text-[var(--kuara-primary)]"
                              >
                                {j.title}
                              </Link>
                            </TableCell>
                            <TableCell align="right" numeric className="text-[var(--kuara-fg-muted)]">
                              {formatBRL(gross)}
                            </TableCell>
                            <TableCell align="right" numeric className="text-[var(--kuara-info-text)]">
                              {mat > 0 ? formatBRL(mat) : "—"}
                            </TableCell>
                            <TableCell align="right" numeric className="text-[var(--kuara-warning-text)]">
                              - {formatBRL(fee)}
                            </TableCell>
                            <TableCell align="right" numeric className="font-semibold text-[var(--kuara-success-text)]">
                              + {formatBRL(net)}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </table>
              </div>
            </Card>

            {!loadingWalletJobs && (
              <Pagination
                page={walletJobsMeta.page}
                totalPages={walletJobsMeta.totalPages}
                total={walletJobsMeta.total}
                limit={walletJobsMeta.limit}
                onPageChange={setWalletPage}
                itemLabel="repasses"
              />
            )}
          </div>
        )}

        {/* TAB 4: AUDITORIA DOCUMENTAL */}
        {activeTab === "verification" && (
          <Card className="max-w-2xl">
            <CardHeader
              actions={<Badge status={providerStatus} />}
            >
              <div className="flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-[var(--kuara-primary)]" />
                <CardTitle>Auditoria Cadastral e Documental</CardTitle>
              </div>
              <CardDescription>
                Documentos exigidos para validação do selo profissional na plataforma Kuara.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {(isRejected || isSuspended) && (
                <Alert
                  variant="danger"
                  icon={<ShieldAlert className="w-4 h-4 shrink-0" />}
                  title={
                    isSuspended
                      ? "Perfil suspenso pela equipe de moderação"
                      : "Documentação recusada na última análise"
                  }
                  description={
                    rejectionReason
                      ? `Justificativa: ${rejectionReason}`
                      : isSuspended
                      ? "Entre em contato com a administração Kuara para revisão da suspensão."
                      : "Corrija os links dos documentos abaixo e envie novamente para análise."
                  }
                />
              )}

              {isVerified && (
                <Alert
                  variant="success"
                  icon={<CheckCircle2 className="w-4 h-4 shrink-0" />}
                  title="Seu perfil já possui o Selo Verificado"
                  description="Sua documentação foi aprovada e você está habilitado para enviar orçamentos e receber chamados diretos. Caso precise atualizar documentos, entre em contato com a moderação."
                />
              )}

              <form onSubmit={handleSubmitDocs} className="space-y-4">
                <Input
                  label="Documento com Foto (RG ou CNH)"
                  type="url"
                  required
                  minLength={5}
                  disabled={isSuspended || isVerified}
                  placeholder="https://exemplo.com/meu-documento-rg-cnh.pdf"
                  hint="Informe a URL pública ou link seguro do seu documento oficial com foto."
                  value={docUrl}
                  onChange={(e) => setDocUrl(e.target.value)}
                  rightElement={
                    docUrl ? (
                      <a
                        href={docUrl}
                        target="_blank"
                        rel="noreferrer"
                        title="Abrir link"
                        className="text-[var(--kuara-fg-subtle)] hover:text-[var(--kuara-fg)]"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    ) : undefined
                  }
                />

                <Input
                  label="Comprovante de Residência Atualizado"
                  type="url"
                  required
                  minLength={5}
                  disabled={isSuspended || isVerified}
                  placeholder="https://exemplo.com/comprovante-residencia.pdf"
                  hint="Conta de água, luz ou telefone emitida nos últimos 90 dias."
                  value={addressUrl}
                  onChange={(e) => setAddressUrl(e.target.value)}
                  rightElement={
                    addressUrl ? (
                      <a
                        href={addressUrl}
                        target="_blank"
                        rel="noreferrer"
                        title="Abrir link"
                        className="text-[var(--kuara-fg-subtle)] hover:text-[var(--kuara-fg)]"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    ) : undefined
                  }
                />

                <Divider />

                <div className="flex items-center justify-end gap-2">
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    loading={sendingDocs}
                    disabled={isSuspended || isVerified}
                    leftIcon={<Send className="w-3.5 h-3.5" />}
                  >
                    {sendingDocs
                      ? "Submetendo..."
                      : isVerified
                      ? "Documentação Verificada"
                      : "Enviar Documentos para Análise"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Modal Enviar Orçamento */}
      <Modal
        isOpen={Boolean(selectedOrder)}
        onClose={() => setSelectedOrder(null)}
        title="Enviar Orçamento Formalizado"
        subtitle={selectedOrder?.title}
        icon={<Send className="w-4 h-4" />}
        size="lg"
      >
        <form onSubmit={handleSendProposal} className="space-y-4">
          <div className="space-y-1.5">
            <span className="block text-xs font-medium text-[var(--kuara-fg)]">
              Responsabilidade pelos Materiais
            </span>
            <ButtonGroup<"CLIENT_SUPPLIES" | "PROVIDER_ADVANCE">
              variant="segmented"
              size="sm"
              fullWidth
              value={effectivePolicy}
              onChange={(val) => {
                setMaterialPolicy(val);
                if (val === "CLIENT_SUPPLIES") {
                  setMaterialCostReais("0");
                }
              }}
              options={[
                { value: "CLIENT_SUPPLIES", label: "Contratante fornece os materiais" },
                { value: "PROVIDER_ADVANCE", label: "Prestador compra (adiantamento imediato)" },
              ]}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              label="Mão de Obra (R$)"
              type="number"
              min="5"
              step="0.01"
              required
              hint="Mínimo R$ 5,00"
              value={laborCostReais}
              onChange={(e) => setLaborCostReais(e.target.value)}
            />

            <Input
              label="Materiais (R$)"
              type="number"
              min="0"
              step="0.01"
              hint={materialCents > 0 ? "Liberado no pagamento" : "0 se cliente comprar"}
              value={materialCostReais}
              onChange={(e) => {
                setMaterialCostReais(e.target.value);
                if (Number(e.target.value) > 0) {
                  setMaterialPolicy("PROVIDER_ADVANCE");
                }
              }}
            />

            <Input
              label="Prazo Estimado (Dias)"
              type="number"
              min="1"
              step="1"
              required
              value={estimatedDays}
              onChange={(e) => setEstimatedDays(e.target.value)}
            />
          </div>

          <Input
            label="Lista de Materiais / Insumos (opcional)"
            maxLength={1000}
            placeholder="Ex: 2 disjuntores DIN 20A, 10m cabo 4mm, fita isolante..."
            value={materialsList}
            onChange={(e) => setMaterialsList(e.target.value)}
          />

          <Textarea
            label="Descrição do Escopo do Serviço"
            rows={3}
            required
            minLength={10}
            placeholder="Explique detalhadamente o que está incluso, ferramentas utilizadas e garantia oferecida (mínimo 10 caracteres)..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          <div className="p-3.5 rounded-md border border-[var(--kuara-border)] bg-[var(--kuara-surface-muted)] space-y-1.5 text-xs">
            <div className="flex justify-between text-[var(--kuara-fg-muted)]">
              <span>Valor Total da Proposta:</span>
              <span className="font-semibold text-[var(--kuara-fg)] tabular-nums">
                {formatBRL(totalProposalCents)}
              </span>
            </div>
            {materialCents > 0 && (
              <div className="flex justify-between text-[var(--kuara-success-text)]">
                <span>Adiantamento de materiais (liberado na hora, 0% taxa):</span>
                <span className="font-semibold tabular-nums">+ {formatBRL(materialCents)}</span>
              </div>
            )}
            <div className="flex justify-between text-[var(--kuara-fg-muted)]">
              <span>Taxa Kuara (5% sobre mão de obra):</span>
              <span className="text-[var(--kuara-warning-text)] tabular-nums">
                - {formatBRL(kuaraFeeCents)}
              </span>
            </div>
            <Divider />
            <div className="flex justify-between font-bold text-[var(--kuara-fg)] pt-0.5">
              <span>Mão de obra líquida retida (após entrega):</span>
              <span className="text-[var(--kuara-success-text)] tabular-nums">
                {formatBRL(netEarningsCents)}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--kuara-border)]">
            <Button
              variant="ghost"
              size="md"
              onClick={() => setSelectedOrder(null)}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              loading={submitting}
              leftIcon={<Send className="w-3.5 h-3.5" />}
            >
              {submitting ? "Enviando..." : "Formalizar Orçamento"}
            </Button>
          </div>
        </form>
      </Modal>
    </AppLayout>
  );
};
