import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { resolveDisputeParties } from "../api/disputes";
import {
  createEmptyMeta,
  PaginationMeta,
  parsePaginatedResponse,
} from "../api/pagination";
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
  Select,
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
  ArrowRight,
  Ban,
  Camera,
  Check,
  DollarSign,
  ExternalLink,
  FileText,
  RefreshCw,
  Scale,
  Search,
  ShieldCheck,
  ShieldX,
  Star,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";

const PROVIDERS_PAGE_SIZE = 8;
const DISPUTES_PAGE_SIZE = 6;
const ADMIN_ORDERS_PAGE_SIZE = 10;
const ADMIN_USERS_PAGE_SIZE = 10;

type AdminTab = "overview" | "verification" | "disputes" | "all_orders" | "all_users";
type DisputeDecision = "RELEASE_TO_PROVIDER" | "REFUND_TO_CLIENT" | "SPLIT" | "REWORK";
type ProviderModerationAction = "VERIFIED" | "REJECTED" | "SUSPENDED";

const ORDER_STATUS_CARDS = [
  { key: "OPEN", label: "Abertos", tone: "text-[var(--kuara-fg)]" },
  { key: "PROPOSALS_RECEIVED", label: "Com Orçamentos", tone: "text-blue-600 dark:text-blue-400" },
  { key: "ESCROW_PENDING", label: "Aguard. Custódia", tone: "text-violet-600 dark:text-violet-400" },
  { key: "IN_PROGRESS", label: "Em Execução", tone: "text-amber-600 dark:text-amber-400" },
  {
    key: "COMPLETED_PENDING_APPROVAL",
    label: "Inspeção (72h)",
    tone: "text-amber-600 dark:text-amber-400",
  },
  { key: "IN_DISPUTE", label: "Em Disputa", tone: "text-rose-600 dark:text-rose-400" },
  { key: "FINISHED", label: "Finalizados", tone: "text-emerald-600 dark:text-emerald-400" },
  { key: "CANCELLED", label: "Cancelados", tone: "text-[var(--kuara-fg-muted)]" },
];

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

const DISPUTE_DECISION_LABELS: Record<string, string> = {
  RELEASE_TO_PROVIDER: "Repasse integral ao prestador",
  REFUND_TO_CLIENT: "Estorno integral ao contratante",
  SPLIT: "Acordo com divisão parcial",
  REWORK: "Retrabalho determinado",
};

const PhotoEvidenceGrid: React.FC<{ title: string; photos?: string[] }> = ({ title, photos }) => {
  const [failedImages, setFailedImages] = useState<Record<number, boolean>>({});
  if (!photos || photos.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <span className="text-[11px] font-medium text-[var(--kuara-fg-muted)] flex items-center gap-1">
        <Camera className="w-3 h-3" />
        {title} ({photos.length})
      </span>
      <div className="grid grid-cols-2 gap-2">
        {photos.map((url, idx) => (
          <a
            key={`${url}-${idx}`}
            href={url}
            target="_blank"
            rel="noreferrer"
            className="group rounded-md border border-[var(--kuara-border)] bg-[var(--kuara-surface-muted)] hover:border-[var(--kuara-border-strong)] overflow-hidden transition-colors flex flex-col"
          >
            {!failedImages[idx] ? (
              <div className="h-20 w-full bg-[var(--kuara-surface)] overflow-hidden">
                <img
                  src={url}
                  alt={`${title} ${idx + 1}`}
                  onError={() => setFailedImages((prev) => ({ ...prev, [idx]: true }))}
                  className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform"
                />
              </div>
            ) : (
              <div className="h-12 w-full flex items-center justify-center text-[var(--kuara-fg-subtle)] bg-[var(--kuara-surface)]">
                <Camera className="w-3.5 h-3.5" />
              </div>
            )}
            <div className="px-2 py-1 flex items-center justify-between gap-1 text-[11px] text-[var(--kuara-fg-muted)]">
              <span className="truncate">Evidência #{idx + 1}</span>
              <ExternalLink className="w-3 h-3 shrink-0 text-[var(--kuara-primary)]" />
            </div>
          </a>
        ))}
      </div>
    </div>
  );
};

export const AdminDashboard: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get("tab") || "overview";
  const activeTab: AdminTab = (
    ["overview", "verification", "disputes", "all_orders", "all_users"] as const
  ).includes(rawTab as AdminTab)
    ? (rawTab as AdminTab)
    : "overview";

  const toast = useToast();

  const [metrics, setMetrics] = useState<any | null>(null);
  const [allProviders, setAllProviders] = useState<any[]>([]);
  const [providersMeta, setProvidersMeta] = useState<PaginationMeta>(() =>
    createEmptyMeta(PROVIDERS_PAGE_SIZE)
  );
  const [isProvidersServerPaginated, setIsProvidersServerPaginated] = useState(false);
  const [providersPage, setProvidersPage] = useState(1);

  const [disputes, setDisputes] = useState<any[]>([]);
  const [disputesMeta, setDisputesMeta] = useState<PaginationMeta>(() =>
    createEmptyMeta(DISPUTES_PAGE_SIZE)
  );
  const [disputesTotalAll, setDisputesTotalAll] = useState<number | null>(null);
  const [isDisputesServerPaginated, setIsDisputesServerPaginated] = useState(false);
  const [disputesPage, setDisputesPage] = useState(1);

  const [allOrders, setAllOrders] = useState<any[]>([]);
  const [ordersMeta, setOrdersMeta] = useState<PaginationMeta>(() =>
    createEmptyMeta(ADMIN_ORDERS_PAGE_SIZE)
  );
  const [isOrdersServerPaginated, setIsOrdersServerPaginated] = useState(false);
  const [ordersPage, setOrdersPage] = useState(1);

  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [usersMeta, setUsersMeta] = useState<PaginationMeta>(() =>
    createEmptyMeta(ADMIN_USERS_PAGE_SIZE)
  );
  const [isUsersServerPaginated, setIsUsersServerPaginated] = useState(false);
  const [usersPage, setUsersPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [partialErrors, setPartialErrors] = useState<string[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Filters
  const [providerStatusFilter, setProviderStatusFilter] = useState<string>("PENDING_VERIFICATION");
  const [disputeFilter, setDisputeFilter] = useState<string>("ALL");
  const [orderSearch, setOrderSearch] = useState("");
  const [debouncedOrderSearch, setDebouncedOrderSearch] = useState("");
  const [orderStatusFilter, setOrderStatusFilter] = useState("ALL");
  const [userSearch, setUserSearch] = useState("");
  const [debouncedUserSearch, setDebouncedUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState("ALL");

  // Provider moderation modal (for REJECTED / SUSPENDED justification)
  const [moderationModal, setModerationModal] = useState<{
    profileId: string;
    providerName: string;
    targetStatus: ProviderModerationAction;
  } | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  // Dispute resolution modal state
  const [disputeModal, setDisputeModal] = useState<{
    disputeId: string;
    decision: DisputeDecision;
    grossCents: number;
    clientName: string;
    providerName: string;
    openerSummary: string;
  } | null>(null);
  const [arbitrationNotes, setArbitrationNotes] = useState("");
  const [splitProviderPercent, setSplitProviderPercent] = useState<string>("50");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedOrderSearch(orderSearch);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [orderSearch]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedUserSearch(userSearch);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [userSearch]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setPartialErrors([]);

    const requests: Array<{ label: string; handler: () => Promise<any> }> = [
      {
        label: "Métricas",
        handler: async () => {
          const res = await api.get("/admin/metrics");
          setMetrics(res.data);
        },
      },
    ];

    if (activeTab === "verification") {
      requests.push({
        label: "Prestadores",
        handler: async () => {
          const params: Record<string, string | number> = {
            page: providersPage,
            limit: PROVIDERS_PAGE_SIZE,
          };
          if (providerStatusFilter !== "ALL") params.status = providerStatusFilter;
          const res = await api.get("/admin/providers", { params });
          const parsed = parsePaginatedResponse<any>(res.data, PROVIDERS_PAGE_SIZE);
          setAllProviders(parsed.items);
          setProvidersMeta(parsed.meta);
          setIsProvidersServerPaginated(parsed.isServerPaginated);
          if (parsed.isServerPaginated && parsed.meta.page !== providersPage) {
            setProvidersPage(parsed.meta.page);
          }
        },
      });
    } else if (activeTab === "disputes") {
      requests.push({
        label: "Disputas",
        handler: async () => {
          const params: Record<string, string | number> = {
            page: disputesPage,
            limit: DISPUTES_PAGE_SIZE,
          };
          if (disputeFilter !== "ALL") params.status = disputeFilter;
          const res = await api.get("/admin/disputes", { params });
          const parsed = parsePaginatedResponse<any>(res.data, DISPUTES_PAGE_SIZE);
          setDisputes(parsed.items);
          setDisputesMeta(parsed.meta);
          setIsDisputesServerPaginated(parsed.isServerPaginated);
          if (disputeFilter === "ALL") {
            setDisputesTotalAll(parsed.meta.total);
          }
          if (parsed.isServerPaginated && parsed.meta.page !== disputesPage) {
            setDisputesPage(parsed.meta.page);
          }
        },
      });
    } else if (activeTab === "all_orders") {
      requests.push({
        label: "Pedidos",
        handler: async () => {
          const params: Record<string, string | number> = {
            page: ordersPage,
            limit: ADMIN_ORDERS_PAGE_SIZE,
          };
          if (orderStatusFilter !== "ALL") params.status = orderStatusFilter;
          if (debouncedOrderSearch.trim()) params.search = debouncedOrderSearch.trim();
          const res = await api.get("/admin/orders", { params });
          const parsed = parsePaginatedResponse<any>(res.data, ADMIN_ORDERS_PAGE_SIZE);
          setAllOrders(parsed.items);
          setOrdersMeta(parsed.meta);
          setIsOrdersServerPaginated(parsed.isServerPaginated);
          if (parsed.isServerPaginated && parsed.meta.page !== ordersPage) {
            setOrdersPage(parsed.meta.page);
          }
        },
      });
    } else if (activeTab === "all_users") {
      requests.push({
        label: "Usuários",
        handler: async () => {
          const params: Record<string, string | number> = {
            page: usersPage,
            limit: ADMIN_USERS_PAGE_SIZE,
          };
          if (userRoleFilter !== "ALL") params.role = userRoleFilter;
          if (debouncedUserSearch.trim()) params.search = debouncedUserSearch.trim();
          const res = await api.get("/admin/users", { params });
          const parsed = parsePaginatedResponse<any>(res.data, ADMIN_USERS_PAGE_SIZE);
          setAllUsers(parsed.items);
          setUsersMeta(parsed.meta);
          setIsUsersServerPaginated(parsed.isServerPaginated);
          if (parsed.isServerPaginated && parsed.meta.page !== usersPage) {
            setUsersPage(parsed.meta.page);
          }
        },
      });
    }

    const results = await Promise.allSettled(requests.map((r) => r.handler()));
    const failedMessages: string[] = [];

    results.forEach((result, idx) => {
      if (result.status === "rejected") {
        failedMessages.push(
          `${requests[idx].label}: ${extractApiError(result.reason, "erro ao carregar")}`
        );
      }
    });

    if (failedMessages.length > 0) {
      setPartialErrors(failedMessages);
      toast.error(`Erro ao carregar ${failedMessages.length} bloco(s) operacional(is).`);
    }

    setLoading(false);
  }, [
    activeTab,
    providersPage,
    providerStatusFilter,
    disputesPage,
    disputeFilter,
    ordersPage,
    orderStatusFilter,
    debouncedOrderSearch,
    usersPage,
    userRoleFilter,
    debouncedUserSearch,
    toast,
  ]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleUpdateProvider = async (
    profileId: string,
    status: ProviderModerationAction,
    reason?: string
  ) => {
    setProcessingId(profileId);
    try {
      await api.patch(`/providers/${profileId}/status`, {
        status,
        ...(reason ? { rejectionReason: reason.trim() } : {}),
      });
      toast.success(
        status === "VERIFIED"
          ? "Prestador aprovado com selo oficial."
          : status === "SUSPENDED"
          ? "Prestador suspenso pela moderação."
          : "Documentação rejeitada com justificativa."
      );
      setModerationModal(null);
      setRejectionReason("");
      await loadData();
    } catch (err: any) {
      toast.error(extractApiError(err, "Erro ao atualizar status do prestador."));
    } finally {
      setProcessingId(null);
    }
  };

  const handleConfirmModerationModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!moderationModal) return;
    await handleUpdateProvider(
      moderationModal.profileId,
      moderationModal.targetStatus,
      rejectionReason
    );
  };

  const handleConfirmDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disputeModal) return;
    const pct = Math.round(Number(splitProviderPercent));
    if (disputeModal.decision === "SPLIT" && (!Number.isFinite(pct) || pct < 1 || pct > 99)) {
      toast.error("Informe um percentual entre 1% e 99% para o acordo parcial.");
      return;
    }

    setProcessingId(disputeModal.disputeId);
    try {
      const payload: Record<string, any> = {
        decision: disputeModal.decision,
        notes: arbitrationNotes.trim(),
      };
      if (disputeModal.decision === "SPLIT") {
        payload.providerSharePercent = pct;
      }
      await api.post(`/escrow/dispute/${disputeModal.disputeId}/resolve`, payload);
      toast.success("Decisão arbitral registrada com sucesso!");
      setDisputeModal(null);
      setArbitrationNotes("");
      await loadData();
    } catch (err: any) {
      toast.error(extractApiError(err, "Erro ao proferir decisão arbitral."));
    } finally {
      setProcessingId(null);
    }
  };

  const handleTabChange = (tab: string) => {
    setSearchParams({ tab });
  };

  const ordersByStatus = metrics?.counts?.ordersByStatus || {};
  const activeDisputesCount =
    typeof metrics?.counts?.activeDisputes === "number"
      ? metrics.counts.activeDisputes
      : disputes.filter((d) => d.status !== "RESOLVED").length;

  // Build unified provider directory fallback for unpaginated mocks
  const allProviderProfiles = useMemo(() => {
    if (isProvidersServerPaginated) return allProviders;
    const byProfileId = new Map<string, any>();

    for (const u of allUsers) {
      if (u.role === "PROVIDER" && u.providerProfile) {
        const p = u.providerProfile;
        const key = p.id || u.id;
        byProfileId.set(key, {
          ...p,
          id: p.id,
          userId: u.id,
          user: { id: u.id, name: u.name, email: u.email, phone: u.phone },
        });
      }
    }

    for (const p of allProviders) {
      const existing = byProfileId.get(p.id) || {};
      byProfileId.set(p.id, { ...existing, ...p });
    }

    return Array.from(byProfileId.values());
  }, [isProvidersServerPaginated, allUsers, allProviders]);

  const pendingProvidersCount =
    typeof metrics?.counts?.pendingProviders === "number"
      ? metrics.counts.pendingProviders
      : allProviderProfiles.filter((p) => p.status === "PENDING_VERIFICATION").length;
  const verifiedProvidersCount =
    typeof metrics?.counts?.verifiedProviders === "number"
      ? metrics.counts.verifiedProviders
      : allProviderProfiles.filter((p) => p.status === "VERIFIED").length;
  const rejectedProvidersCount =
    typeof metrics?.counts?.rejectedProviders === "number"
      ? metrics.counts.rejectedProviders
      : allProviderProfiles.filter((p) => p.status === "REJECTED").length;
  const suspendedProvidersCount =
    typeof metrics?.counts?.suspendedProviders === "number"
      ? metrics.counts.suspendedProviders
      : allProviderProfiles.filter((p) => p.status === "SUSPENDED").length;
  const totalProvidersCount =
    typeof metrics?.counts?.pendingProviders === "number"
      ? pendingProvidersCount +
        verifiedProvidersCount +
        rejectedProvidersCount +
        suspendedProvidersCount
      : allProviderProfiles.length;

  const filteredProviders = useMemo(() => {
    if (isProvidersServerPaginated) return allProviders;
    if (providerStatusFilter === "ALL") return allProviderProfiles;
    return allProviderProfiles.filter((p) => p.status === providerStatusFilter);
  }, [isProvidersServerPaginated, allProviders, allProviderProfiles, providerStatusFilter]);

  const filteredDisputes = useMemo(() => {
    if (isDisputesServerPaginated) return disputes;
    if (disputeFilter === "PENDING_REVIEW") {
      return disputes.filter((d) => d.status !== "RESOLVED");
    }
    if (disputeFilter === "RESOLVED") {
      return disputes.filter((d) => d.status === "RESOLVED");
    }
    return disputes;
  }, [isDisputesServerPaginated, disputes, disputeFilter]);

  const filteredOrders = useMemo(() => {
    if (isOrdersServerPaginated) return allOrders;
    const q = orderSearch.trim().toLowerCase();
    return allOrders.filter((o) => {
      if (orderStatusFilter !== "ALL" && o.status !== orderStatusFilter) return false;
      if (!q) return true;
      return (
        o.title?.toLowerCase().includes(q) ||
        o.id?.toLowerCase().includes(q) ||
        o.client?.name?.toLowerCase().includes(q) ||
        o.acceptedProposal?.provider?.name?.toLowerCase().includes(q) ||
        o.addressCity?.toLowerCase().includes(q) ||
        o.category?.toLowerCase().includes(q)
      );
    });
  }, [isOrdersServerPaginated, allOrders, orderSearch, orderStatusFilter]);

  const filteredUsers = useMemo(() => {
    if (isUsersServerPaginated) return allUsers;
    const q = userSearch.trim().toLowerCase();
    return allUsers.filter((u) => {
      if (userRoleFilter !== "ALL" && u.role !== userRoleFilter) return false;
      if (!q) return true;
      return (
        u.name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.phone?.toLowerCase().includes(q)
      );
    });
  }, [isUsersServerPaginated, allUsers, userSearch, userRoleFilter]);

  const totalOrdersCount = metrics?.counts?.totalOrders ?? allOrders.length;
  const totalUsersCount = metrics?.counts?.totalUsers ?? allUsers.length;

  const sidebarBadges = {
    verification: {
      count: pendingProvidersCount,
      tone: pendingProvidersCount > 0 ? ("amber" as const) : ("neutral" as const),
    },
    disputes: {
      count: activeDisputesCount,
      tone: activeDisputesCount > 0 ? ("rose" as const) : ("neutral" as const),
    },
    all_orders: { count: totalOrdersCount, tone: "neutral" as const },
    all_users: { count: totalUsersCount, tone: "neutral" as const },
  };

  return (
    <AppLayout
      title="Operações & Mediação Admin"
      subtitle="Controle financeiro, moderação documental e auditoria"
      activeTab={activeTab}
      onTabChange={handleTabChange}
      sidebarBadges={sidebarBadges}
      actions={
        <Button
          variant="outline"
          size="sm"
          onClick={loadData}
          loading={loading}
          leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
        >
          Atualizar
        </Button>
      }
    >
      <div className="space-y-5">
        {partialErrors.length > 0 && (
          <Alert
            variant="danger"
            title="Falha parcial ao carregar dados administrativos"
            description={
              <ul className="list-disc pl-4 space-y-0.5 mt-1">
                {partialErrors.map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
              </ul>
            }
            action={
              <Button variant="danger-outline" size="xs" onClick={loadData}>
                Recarregar
              </Button>
            }
          />
        )}

        {/* VISTA 1: OVERVIEW / KPIS FINANCEIROS */}
        {activeTab === "overview" && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <StatCard
                label="GMV Total Transacionado"
                value={formatBRL(metrics?.financial?.totalGMVCents || 0)}
                hint="Total movimentado em custódias Kuara"
                tone="neutral"
                icon={<DollarSign className="w-4 h-4" />}
              />

              <StatCard
                label="Receita Kuara (5%)"
                value={formatBRL(metrics?.financial?.totalRevenueKuaraCents || 0)}
                hint="Comissão líquida sobre serviços concluídos"
                tone="emerald"
                icon={<TrendingUp className="w-4 h-4" />}
              />

              <StatCard
                label="Saldo sob Custódia Ativa"
                value={formatBRL(metrics?.financial?.activeEscrowCents || 0)}
                hint={
                  (metrics?.financial?.disputedEscrowCents || 0) > 0
                    ? `Inclui ${formatBRL(metrics.financial.disputedEscrowCents)} em disputa`
                    : (metrics?.financial?.materialsAdvancedTotalCents || 0) > 0
                    ? `Mão de obra retida • Materiais adiantados: ${formatBRL(
                        metrics.financial.materialsAdvancedTotalCents
                      )}`
                    : "Mão de obra retida aguardando conclusão"
                }
                tone="amber"
                icon={<Wallet className="w-4 h-4" />}
              />
            </div>

            {(metrics?.financial?.refundedTotalCents || 0) > 0 && (
              <Alert
                variant="neutral"
                compact
                description={`Total estornado a contratantes em cancelamentos ou disputas: ${formatBRL(
                  metrics.financial.refundedTotalCents
                )}`}
              />
            )}

            <Card>
              <CardHeader
                actions={
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() => handleTabChange("all_orders")}
                  >
                    Ver Auditoria de Pedidos
                  </Button>
                }
              >
                <CardTitle>Distribuição Operacional de Chamados</CardTitle>
                <CardDescription>
                  Contagem completa de todas as ordens por estágio da máquina de estados ({metrics?.counts?.totalOrders ?? allOrders.length} no total).
                </CardDescription>
              </CardHeader>

              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {ORDER_STATUS_CARDS.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => {
                        setOrderStatusFilter(item.key);
                        setOrdersPage(1);
                        handleTabChange("all_orders");
                      }}
                      className="p-3 rounded-md border border-[var(--kuara-border)] bg-[var(--kuara-surface-muted)]/60 hover:bg-[var(--kuara-surface-hover)] hover:border-[var(--kuara-border-strong)] transition-colors text-left"
                    >
                      <span className="text-[11px] font-medium text-[var(--kuara-fg-muted)] block truncate">
                        {item.label}
                      </span>
                      <p className={`text-lg font-bold tabular-nums mt-1 ${item.tone}`}>
                        {ordersByStatus[item.key] || 0}
                      </p>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <StatCard
                label="Total de Usuários"
                value={totalUsersCount}
                hint="Contratantes, prestadores e moderadores"
                icon={<Users className="w-4 h-4" />}
              />

              <StatCard
                label="Prestadores Verificados"
                value={metrics?.counts?.verifiedProviders ?? verifiedProvidersCount}
                hint={`${pendingProvidersCount} aguardando moderação`}
                tone="emerald"
                icon={<ShieldCheck className="w-4 h-4" />}
              />

              <StatCard
                label="Disputas Pendentes"
                value={activeDisputesCount}
                hint={`${ordersByStatus.IN_DISPUTE ?? activeDisputesCount} chamado(s) em disputa ativa`}
                tone={activeDisputesCount > 0 ? "rose" : "neutral"}
                icon={<AlertTriangle className="w-4 h-4" />}
              />
            </div>
          </div>
        )}

        {/* VISTA 2: MODERAÇÃO DOCUMENTAL */}
        {activeTab === "verification" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-[var(--kuara-fg)]">
                  Moderação e Auditoria de Prestadores
                </h2>
                <p className="text-xs text-[var(--kuara-fg-muted)]">
                  Aprove documentos com selo verificado, rejeite com justificativa ou gerencie suspensões.
                </p>
              </div>

              <ButtonGroup
                size="sm"
                variant="segmented"
                value={providerStatusFilter}
                onChange={(nextStatus) => {
                  setProviderStatusFilter(nextStatus);
                  setProvidersPage(1);
                }}
                options={[
                  {
                    value: "PENDING_VERIFICATION",
                    label: "Pendentes",
                    count: pendingProvidersCount,
                  },
                  {
                    value: "VERIFIED",
                    label: "Verificados",
                    count: verifiedProvidersCount,
                  },
                  {
                    value: "REJECTED",
                    label: "Rejeitados",
                    count: rejectedProvidersCount,
                  },
                  {
                    value: "SUSPENDED",
                    label: "Suspensos",
                    count: suspendedProvidersCount,
                  },
                  { value: "ALL", label: "Todos", count: totalProvidersCount },
                ]}
              />
            </div>

            <Card>
              {loading ? (
                <TableSkeleton rows={4} />
              ) : filteredProviders.length === 0 ? (
                <EmptyState
                  icon={<ShieldCheck className="w-4 h-4" />}
                  title="Nenhum prestador neste filtro"
                  description="Alterne os filtros acima para inspecionar prestadores verificados, rejeitados ou suspensos."
                />
              ) : (
                <div className="divide-y divide-[var(--kuara-border)]">
                  {filteredProviders.map((p) => (
                    <div
                      key={p.id || p.userId}
                      className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 text-xs"
                    >
                      <div className="space-y-1.5 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-[var(--kuara-fg)] text-sm">
                            {p.user?.name || "Prestador"}
                          </span>
                          <Badge status={p.status} />
                          <span className="text-[var(--kuara-fg-muted)]">
                            {p.user?.email}
                          </span>
                          {p.user?.phone && (
                            <span className="text-[var(--kuara-fg-subtle)] tabular-nums">
                              • {p.user.phone}
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-[11px] text-[var(--kuara-fg-muted)]">
                          {p.cpfCnpj && (
                            <span className="font-mono">CPF/CNPJ: {p.cpfCnpj}</span>
                          )}
                          {p.pixKey && <span className="font-mono">Pix: {p.pixKey}</span>}
                          {Array.isArray(p.categories) && p.categories.length > 0 && (
                            <div className="flex items-center gap-1 flex-wrap">
                              {p.categories.map((c: string) => (
                                <Tag key={c}>{c}</Tag>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-3 pt-0.5 text-[11px]">
                          {p.documentUrl ? (
                            <a
                              href={p.documentUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[var(--kuara-primary)] hover:underline inline-flex items-center gap-1 font-medium"
                            >
                              <ExternalLink className="w-3 h-3" /> Documento RG/CNH
                            </a>
                          ) : (
                            <span className="text-[var(--kuara-fg-subtle)]">
                              Documento RG/CNH não anexado
                            </span>
                          )}

                          {p.addressProofUrl ? (
                            <a
                              href={p.addressProofUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[var(--kuara-primary)] hover:underline inline-flex items-center gap-1 font-medium"
                            >
                              <ExternalLink className="w-3 h-3" /> Comprovante de Residência
                            </a>
                          ) : (
                            <span className="text-[var(--kuara-fg-subtle)]">
                              Comprovante não anexado
                            </span>
                          )}
                        </div>

                        {p.rejectionReason && (
                          <div className="mt-1 px-2.5 py-1.5 rounded border border-[var(--kuara-danger-border)] bg-[var(--kuara-danger-soft)] text-[var(--kuara-danger-text)] text-[11px]">
                            <strong>Motivo registrado:</strong> {p.rejectionReason}
                          </div>
                        )}
                      </div>

                      {p.id && (
                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          {p.status !== "VERIFIED" && (
                            <Button
                              variant="success"
                              size="sm"
                              disabled={processingId === p.id}
                              loading={processingId === p.id}
                              leftIcon={<Check className="w-3.5 h-3.5" />}
                              onClick={() => handleUpdateProvider(p.id, "VERIFIED")}
                            >
                              {p.status === "SUSPENDED" ? "Reativar / Verificar" : "Aprovar"}
                            </Button>
                          )}

                          {p.status !== "REJECTED" && (
                            <Button
                              variant="danger-outline"
                              size="sm"
                              disabled={processingId === p.id}
                              leftIcon={<ShieldX className="w-3.5 h-3.5" />}
                              onClick={() => {
                                setRejectionReason(p.rejectionReason || "");
                                setModerationModal({
                                  profileId: p.id,
                                  providerName: p.user?.name || "Prestador",
                                  targetStatus: "REJECTED",
                                });
                              }}
                            >
                              Rejeitar
                            </Button>
                          )}

                          {p.status !== "SUSPENDED" && (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={processingId === p.id}
                              leftIcon={<Ban className="w-3.5 h-3.5" />}
                              onClick={() => {
                                setRejectionReason(p.rejectionReason || "");
                                setModerationModal({
                                  profileId: p.id,
                                  providerName: p.user?.name || "Prestador",
                                  targetStatus: "SUSPENDED",
                                });
                              }}
                            >
                              Suspender
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {!loading && (
              <Pagination
                page={providersMeta.page}
                totalPages={providersMeta.totalPages}
                total={providersMeta.total}
                limit={providersMeta.limit}
                onPageChange={setProvidersPage}
                itemLabel="prestadores"
              />
            )}
          </div>
        )}

        {/* VISTA 3: CENTRAL DE DISPUTAS */}
        {activeTab === "disputes" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-[var(--kuara-fg)]">
                  Central de Mediação & Arbitragem
                </h2>
                <p className="text-xs text-[var(--kuara-fg-muted)]">
                  Identifique quem abriu a contestação, compare as alegações de contratante e contratado lado a lado e decida sobre a custódia.
                </p>
              </div>

              <ButtonGroup
                size="sm"
                variant="segmented"
                value={disputeFilter}
                onChange={(nextFilter) => {
                  setDisputeFilter(nextFilter);
                  setDisputesPage(1);
                }}
                options={[
                  {
                    value: "ALL",
                    label: "Todas",
                    ...(typeof (disputesTotalAll ?? (!isDisputesServerPaginated ? disputes.length : null)) ===
                    "number"
                      ? {
                          count:
                            disputesTotalAll ?? (!isDisputesServerPaginated ? disputes.length : 0),
                        }
                      : {}),
                  },
                  {
                    value: "PENDING_REVIEW",
                    label: "Pendentes",
                    count: activeDisputesCount,
                  },
                  {
                    value: "RESOLVED",
                    label: "Resolvidas",
                    ...(disputesTotalAll !== null
                      ? { count: Math.max(0, disputesTotalAll - activeDisputesCount) }
                      : !isDisputesServerPaginated
                      ? { count: Math.max(0, disputes.length - activeDisputesCount) }
                      : {}),
                  },
                ]}
              />
            </div>

            {loading ? (
              <Card>
                <TableSkeleton rows={3} />
              </Card>
            ) : filteredDisputes.length === 0 ? (
              <Card>
                <EmptyState
                  icon={<Scale className="w-4 h-4" />}
                  title="Nenhuma disputa encontrada"
                  description="Não há contestações registradas para o filtro selecionado."
                />
              </Card>
            ) : (
              <div className="space-y-4">
                {filteredDisputes.map((d) => {
                  const order = d.serviceOrder;
                  const escrow = order?.escrow;
                  const provider = order?.acceptedProposal?.provider;
                  const grossCents = escrow?.grossAmountCents ?? 0;
                  const heldPoolCents = escrow?.materialsReleasedAt
                    ? escrow?.laborAmountCents ?? 0
                    : grossCents;
                  const parties = resolveDisputeParties(d);
                  const isClientOpener = parties.openedByRole === "CLIENT";
                  const isProviderOpener = parties.openedByRole === "PROVIDER";
                  const openerSummary =
                    parties.opener && parties.contested
                      ? `${parties.opener.label} (${parties.opener.name}) contestou contra ${parties.contested.label} (${parties.contested.name})`
                      : `Contratante (${parties.client.name}) x Contratado (${parties.provider.name})`;

                  return (
                    <Card key={d.id}>
                      <CardHeader
                        actions={
                          <div className="flex items-center gap-2">
                            <Badge
                              status={d.status === "PENDING_REVIEW" ? "IN_DISPUTE" : d.status}
                            />
                            <Link
                              to={`/services/${d.serviceOrderId}`}
                              className={buttonVariants({ variant: "outline", size: "xs" })}
                            >
                              Inspecionar Pedido & Chat
                            </Link>
                          </div>
                        }
                      >
                        <Link
                          to={`/services/${d.serviceOrderId}`}
                          className="text-sm font-semibold text-[var(--kuara-fg)] hover:text-[var(--kuara-primary)] transition-colors"
                        >
                          {order?.title || `Ordem #${d.serviceOrderId.slice(0, 8)}`}
                        </Link>
                        <CardDescription>
                          Protocolo #{d.serviceOrderId.slice(0, 8)} • Aberto em{" "}
                          {new Date(d.createdAt).toLocaleString("pt-BR")}
                          {order?.category ? ` • ${order.category}` : ""}
                          {order?.addressCity
                            ? ` • ${order.addressCity}${order.addressState ? ` - ${order.addressState}` : ""}`
                            : ""}
                        </CardDescription>
                      </CardHeader>

                      <CardContent className="space-y-4 text-xs">
                        {/* Resumo direcional: Quem contestou contra quem */}
                        <div className="p-2.5 rounded-md border border-[var(--kuara-border)] bg-[var(--kuara-surface-muted)] flex flex-wrap items-center gap-2">
                          {parties.opener && parties.contested ? (
                            <>
                              <Tag tone="rose">
                                Contestante: {parties.opener.label}
                              </Tag>
                              <span className="font-semibold text-[var(--kuara-fg)]">
                                {parties.opener.name}
                              </span>
                              <span className="inline-flex items-center gap-1 text-[var(--kuara-fg-muted)]">
                                <ArrowRight className="w-3 h-3 shrink-0" />
                                <span>contestou contra</span>
                              </span>
                              <Tag tone="blue">
                                Parte contestada: {parties.contested.label}
                              </Tag>
                              <span className="font-semibold text-[var(--kuara-fg)]">
                                {parties.contested.name}
                              </span>
                            </>
                          ) : (
                            <span className="text-[11px] text-[var(--kuara-fg-muted)]">
                              Autor da abertura não identificado neste registro •{" "}
                              <strong className="text-[var(--kuara-fg)]">Contratante:</strong>{" "}
                              {parties.client.name} •{" "}
                              <strong className="text-[var(--kuara-fg)]">Contratado:</strong>{" "}
                              {parties.provider.name}
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div
                            className={`p-3 rounded-md border ${
                              isClientOpener
                                ? "border-[var(--kuara-danger-border)] bg-[var(--kuara-danger-soft)]/30"
                                : "border-[var(--kuara-border)] bg-[var(--kuara-surface-muted)]"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <span className="text-[11px] font-medium text-[var(--kuara-fg-subtle)]">
                                Contratante (Cliente)
                              </span>
                              {isClientOpener ? (
                                <Tag tone="rose">Abriu a contestação</Tag>
                              ) : isProviderOpener ? (
                                <Tag tone="blue">Parte contestada</Tag>
                              ) : null}
                            </div>
                            <p className="font-semibold text-[var(--kuara-fg)] mt-1">
                              {order?.client?.name || "—"}
                            </p>
                            <p className="text-[11px] text-[var(--kuara-fg-muted)] truncate">
                              {order?.client?.email || "—"}
                            </p>
                            {order?.client?.phone && (
                              <p className="text-[11px] text-[var(--kuara-fg-muted)] tabular-nums">
                                {order.client.phone}
                              </p>
                            )}
                          </div>

                          <div
                            className={`p-3 rounded-md border ${
                              isProviderOpener
                                ? "border-[var(--kuara-danger-border)] bg-[var(--kuara-danger-soft)]/30"
                                : "border-[var(--kuara-border)] bg-[var(--kuara-surface-muted)]"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <span className="text-[11px] font-medium text-[var(--kuara-fg-subtle)]">
                                Contratado (Prestador)
                              </span>
                              {isProviderOpener ? (
                                <Tag tone="rose">Abriu a contestação</Tag>
                              ) : isClientOpener ? (
                                <Tag tone="blue">Parte contestada</Tag>
                              ) : null}
                            </div>
                            <p className="font-semibold text-[var(--kuara-fg)] mt-1">
                              {provider?.name || "—"}
                            </p>
                            <p className="text-[11px] text-[var(--kuara-fg-muted)] truncate">
                              {provider?.email || "—"}
                            </p>
                            {provider?.phone && (
                              <p className="text-[11px] text-[var(--kuara-fg-muted)] tabular-nums">
                                {provider.phone}
                              </p>
                            )}
                          </div>

                          <div className="p-3 rounded-md border border-[var(--kuara-border)] bg-[var(--kuara-surface-muted)]">
                            <span className="text-[11px] font-medium text-[var(--kuara-fg-subtle)] block">
                              Custódia em Disputa
                            </span>
                            <p className="font-bold text-sm text-[var(--kuara-fg)] tabular-nums mt-1">
                              {formatBRL(heldPoolCents)}
                            </p>
                            {escrow && (
                              <p className="text-[11px] text-[var(--kuara-fg-muted)] tabular-nums mt-0.5">
                                Líquido M.O.: {formatBRL(escrow.netAmountCents)} • Taxa:{" "}
                                {formatBRL(escrow.feeAmountCents)}
                                {(escrow.materialsAmountCents ?? 0) > 0
                                  ? ` • Mat. já liberado: ${formatBRL(escrow.materialsAmountCents)}`
                                  : ""}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Comparativo lado a lado: Contestação x Defesa */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
                          <div className="p-3.5 rounded-md border border-[var(--kuara-danger-border)] bg-[var(--kuara-danger-soft)]/50 space-y-3">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <Tag tone="rose">
                                  {parties.opener
                                    ? `Contestação · ${parties.opener.label}`
                                    : "Contestação Inicial"}
                                </Tag>
                                <span className="font-semibold text-[var(--kuara-danger-text)]">
                                  {parties.opener ? parties.opener.name : "Relato do Contestante"}
                                </span>
                              </div>
                              <span className="text-[11px] text-[var(--kuara-danger-text)] font-medium">
                                Motivo alegado
                              </span>
                            </div>

                            <p className="text-[var(--kuara-fg)] leading-relaxed">{d.reason}</p>

                            <PhotoEvidenceGrid
                              title={
                                parties.opener
                                  ? `Evidências enviadas por ${parties.opener.label} (${parties.opener.name})`
                                  : "Evidências da Contestação"
                              }
                              photos={d.evidencePhotos}
                            />
                          </div>

                          <div
                            className={`p-3.5 rounded-md border space-y-3 ${
                              d.counterEvidenceReason || (d.counterEvidencePhotos?.length ?? 0) > 0
                                ? "border-[var(--kuara-info-border)] bg-[var(--kuara-info-soft)]/50"
                                : "border-dashed border-[var(--kuara-border)] bg-[var(--kuara-surface-muted)]/50"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <Tag tone="blue">
                                  {parties.contested
                                    ? `Defesa · ${parties.contested.label}`
                                    : "Contraprova / Defesa"}
                                </Tag>
                                <span className="font-semibold text-[var(--kuara-info-text)]">
                                  {parties.contested
                                    ? parties.contested.name
                                    : "Resposta Registrada"}
                                </span>
                              </div>
                              <span className="text-[11px] text-[var(--kuara-info-text)] font-medium">
                                Resposta da outra parte
                              </span>
                            </div>

                            {d.counterEvidenceReason ? (
                              <p className="text-[var(--kuara-fg)] leading-relaxed">
                                {d.counterEvidenceReason}
                              </p>
                            ) : (
                              <p className="text-[11px] text-[var(--kuara-fg-muted)] italic">
                                Nenhuma contraprova enviada até o momento
                                {parties.contested
                                  ? ` por ${parties.contested.label} (${parties.contested.name})`
                                  : ""}
                                .
                              </p>
                            )}

                            <PhotoEvidenceGrid
                              title={
                                parties.contested
                                  ? `Evidências enviadas por ${parties.contested.label} (${parties.contested.name})`
                                  : "Evidências da Contraprova"
                              }
                              photos={d.counterEvidencePhotos}
                            />
                          </div>
                        </div>

                        {((order?.photos?.length ?? 0) > 0 ||
                          (order?.completionPhotos?.length ?? 0) > 0) && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                            <PhotoEvidenceGrid
                              title={`Fotos iniciais do problema — Contratante (${parties.client.name})`}
                              photos={order?.photos}
                            />
                            <PhotoEvidenceGrid
                              title={`Fotos de entrega — Contratado (${parties.provider.name})`}
                              photos={order?.completionPhotos}
                            />
                          </div>
                        )}

                        {d.status !== "RESOLVED" ? (
                          <>
                            <Divider />
                            <div className="space-y-2.5">
                              <p className="text-[11px] text-[var(--kuara-fg-muted)]">
                                Decisão arbitral sobre{" "}
                                <strong className="text-[var(--kuara-fg)] tabular-nums">
                                  {formatBRL(heldPoolCents)}
                                </strong>{" "}
                                em custódia (Contratante:{" "}
                                <strong className="text-[var(--kuara-fg)]">
                                  {parties.client.name}
                                </strong>{" "}
                                • Contratado:{" "}
                                <strong className="text-[var(--kuara-fg)]">
                                  {parties.provider.name}
                                </strong>
                                ):
                              </p>
                              <div className="flex flex-wrap items-center gap-2">
                                <Button
                                  variant="success"
                                  size="sm"
                                  disabled={processingId === d.id}
                                  onClick={() => {
                                    setArbitrationNotes("");
                                    setDisputeModal({
                                      disputeId: d.id,
                                      decision: "RELEASE_TO_PROVIDER",
                                      grossCents: heldPoolCents,
                                      clientName: parties.client.name,
                                      providerName: parties.provider.name,
                                      openerSummary,
                                    });
                                  }}
                                >
                                  Liberar 100% ao Prestador
                                </Button>

                                <Button
                                  variant="danger"
                                  size="sm"
                                  disabled={processingId === d.id}
                                  onClick={() => {
                                    setArbitrationNotes("");
                                    setDisputeModal({
                                      disputeId: d.id,
                                      decision: "REFUND_TO_CLIENT",
                                      grossCents: heldPoolCents,
                                      clientName: parties.client.name,
                                      providerName: parties.provider.name,
                                      openerSummary,
                                    });
                                  }}
                                >
                                  Estornar 100% ao Cliente
                                </Button>

                                <Button
                                  variant="warning"
                                  size="sm"
                                  disabled={processingId === d.id}
                                  onClick={() => {
                                    setArbitrationNotes("");
                                    setSplitProviderPercent("50");
                                    setDisputeModal({
                                      disputeId: d.id,
                                      decision: "SPLIT",
                                      grossCents: heldPoolCents,
                                      clientName: parties.client.name,
                                      providerName: parties.provider.name,
                                      openerSummary,
                                    });
                                  }}
                                >
                                  Acordo / Divisão Parcial
                                </Button>

                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={processingId === d.id}
                                  onClick={() => {
                                    setArbitrationNotes("");
                                    setDisputeModal({
                                      disputeId: d.id,
                                      decision: "REWORK",
                                      grossCents: heldPoolCents,
                                      clientName: parties.client.name,
                                      providerName: parties.provider.name,
                                      openerSummary,
                                    });
                                  }}
                                >
                                  Retornar para Retrabalho
                                </Button>
                              </div>
                            </div>
                          </>
                        ) : (
                          <Alert
                            variant="neutral"
                            compact
                            title={`Disputa resolvida${
                              d.decision
                                ? ` — ${DISPUTE_DECISION_LABELS[d.decision] || d.decision}`
                                : ""
                            }${
                              d.resolvedAt
                                ? ` em ${new Date(d.resolvedAt).toLocaleString("pt-BR")}`
                                : ""
                            }`}
                            description={
                              <div className="space-y-1">
                                <p>
                                  {d.resolutionNotes ||
                                    "Decisão arbitral registrada sem observações adicionais."}
                                </p>
                                {(d.providerReleaseCents !== null &&
                                  d.providerReleaseCents !== undefined) ||
                                (d.clientRefundCents !== null &&
                                  d.clientRefundCents !== undefined) ? (
                                  <p className="text-[11px] tabular-nums font-medium">
                                    Repasse Prestador: {formatBRL(d.providerReleaseCents || 0)} •
                                    Estorno Cliente: {formatBRL(d.clientRefundCents || 0)}
                                  </p>
                                ) : null}
                              </div>
                            }
                          />
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            {!loading && (
              <Pagination
                page={disputesMeta.page}
                totalPages={disputesMeta.totalPages}
                total={disputesMeta.total}
                limit={disputesMeta.limit}
                onPageChange={setDisputesPage}
                itemLabel="disputas"
              />
            )}
          </div>
        )}

        {/* VISTA 4: AUDITORIA DE PEDIDOS */}
        {activeTab === "all_orders" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <Input
                size="md"
                placeholder="Buscar por título, ID, cliente, prestador ou cidade..."
                value={orderSearch}
                onChange={(e) => {
                  setOrderSearch(e.target.value);
                  setOrdersPage(1);
                }}
                leftIcon={<Search className="w-3.5 h-3.5" />}
                containerClassName="w-full sm:max-w-sm"
              />

              <Select
                size="md"
                value={orderStatusFilter}
                onChange={(e) => {
                  setOrderStatusFilter(e.target.value);
                  setOrdersPage(1);
                }}
                containerClassName="w-full sm:w-56"
                options={[
                  { value: "ALL", label: "Todos os Status" },
                  { value: "OPEN", label: "Aberto" },
                  { value: "PROPOSALS_RECEIVED", label: "Orçamentos Recebidos" },
                  { value: "ESCROW_PENDING", label: "Aguardando Custódia" },
                  { value: "IN_PROGRESS", label: "Em Andamento" },
                  { value: "COMPLETED_PENDING_APPROVAL", label: "Inspeção (72h)" },
                  { value: "IN_DISPUTE", label: "Em Disputa" },
                  { value: "FINISHED", label: "Concluído & Pago" },
                  { value: "CANCELLED", label: "Cancelado" },
                ]}
              />
            </div>

            <Table>
              <TableHeader>
                <TableRow interactive={false}>
                  <TableHead>Data</TableHead>
                  <TableHead>Chamado / Local</TableHead>
                  <TableHead>Partes</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead align="right">Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead align="right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableEmpty colSpan={7}>
                    <TableSkeleton rows={5} />
                  </TableEmpty>
                ) : filteredOrders.length === 0 ? (
                  <TableEmpty colSpan={7}>
                    <EmptyState
                      icon={<FileText className="w-4 h-4" />}
                      title="Nenhum chamado encontrado"
                      description="Ajuste a busca ou o filtro de status para localizar pedidos."
                    />
                  </TableEmpty>
                ) : (
                  filteredOrders.map((o) => {
                    const gross =
                      o.escrow?.grossAmountCents ?? o.acceptedProposal?.totalCents ?? null;
                    return (
                      <TableRow key={o.id}>
                        <TableCell numeric className="text-[var(--kuara-fg-muted)] whitespace-nowrap">
                          {new Date(o.createdAt).toLocaleDateString("pt-BR")}
                        </TableCell>
                        <TableCell className="min-w-[200px] max-w-xs">
                          <Link
                            to={`/services/${o.id}`}
                            className="font-medium text-[var(--kuara-fg)] hover:text-[var(--kuara-primary)] block truncate"
                          >
                            {o.title}
                          </Link>
                          <span className="text-[11px] text-[var(--kuara-fg-subtle)] block truncate">
                            #{o.id.slice(0, 8)} • {o.addressCity} - {o.addressState}
                          </span>
                        </TableCell>
                        <TableCell className="min-w-[160px]">
                          <span className="block text-[var(--kuara-fg)] truncate">
                            {o.client?.name || "—"}
                          </span>
                          <span className="block text-[11px] text-[var(--kuara-fg-muted)] truncate">
                            {o.acceptedProposal?.provider?.name
                              ? `Prest.: ${o.acceptedProposal.provider.name}`
                              : "Sem prestador definido"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Tag>{o.category}</Tag>
                        </TableCell>
                        <TableCell align="right" numeric className="font-medium whitespace-nowrap">
                          {gross !== null ? formatBRL(gross) : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge status={o.status} />
                        </TableCell>
                        <TableCell align="right">
                          <Link
                            to={`/services/${o.id}`}
                            className={buttonVariants({ variant: "outline", size: "xs" })}
                          >
                            Inspecionar
                          </Link>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>

            {!loading && (
              <Pagination
                page={ordersMeta.page}
                totalPages={ordersMeta.totalPages}
                total={ordersMeta.total}
                limit={ordersMeta.limit}
                onPageChange={setOrdersPage}
                itemLabel="chamados"
              />
            )}
          </div>
        )}

        {/* VISTA 5: DIRETÓRIO DE USUÁRIOS */}
        {activeTab === "all_users" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <Input
                size="md"
                placeholder="Buscar por nome, e-mail ou telefone..."
                value={userSearch}
                onChange={(e) => {
                  setUserSearch(e.target.value);
                  setUsersPage(1);
                }}
                leftIcon={<Search className="w-3.5 h-3.5" />}
                containerClassName="w-full sm:max-w-sm"
              />

              <ButtonGroup
                size="sm"
                variant="segmented"
                value={userRoleFilter}
                onChange={(nextRole) => {
                  setUserRoleFilter(nextRole);
                  setUsersPage(1);
                }}
                options={[
                  {
                    value: "ALL",
                    label: "Todos",
                    count: totalUsersCount,
                  },
                  {
                    value: "CLIENT",
                    label: "Contratantes",
                    ...(!isUsersServerPaginated
                      ? { count: allUsers.filter((u) => u.role === "CLIENT").length }
                      : {}),
                  },
                  {
                    value: "PROVIDER",
                    label: "Prestadores",
                    ...(!isUsersServerPaginated
                      ? { count: allUsers.filter((u) => u.role === "PROVIDER").length }
                      : {}),
                  },
                  {
                    value: "ADMIN",
                    label: "Admins",
                    ...(!isUsersServerPaginated
                      ? { count: allUsers.filter((u) => u.role === "ADMIN").length }
                      : {}),
                  },
                ]}
              />
            </div>

            <Table>
              <TableHeader>
                <TableRow interactive={false}>
                  <TableHead>Usuário / E-mail</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Papel</TableHead>
                  <TableHead>Verificação</TableHead>
                  <TableHead>Reputação</TableHead>
                  <TableHead align="right">Cadastro</TableHead>
                  <TableHead align="right">Moderação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableEmpty colSpan={7}>
                    <TableSkeleton rows={5} />
                  </TableEmpty>
                ) : filteredUsers.length === 0 ? (
                  <TableEmpty colSpan={7}>
                    <EmptyState
                      icon={<Users className="w-4 h-4" />}
                      title="Nenhum usuário encontrado"
                      description="Ajuste a busca ou filtro de papel para visualizar os registros."
                    />
                  </TableEmpty>
                ) : (
                  filteredUsers.map((u) => {
                    const profile = u.providerProfile;
                    return (
                      <TableRow key={u.id}>
                        <TableCell className="min-w-[200px]">
                          <p className="font-medium text-[var(--kuara-fg)] truncate">{u.name}</p>
                          <span className="text-[11px] text-[var(--kuara-fg-muted)] block truncate">
                            {u.email}
                          </span>
                        </TableCell>
                        <TableCell numeric className="text-[var(--kuara-fg-muted)] whitespace-nowrap">
                          {u.phone || "—"}
                        </TableCell>
                        <TableCell>
                          <Badge status={u.role} />
                        </TableCell>
                        <TableCell>
                          {profile ? (
                            <Badge status={profile.status} />
                          ) : (
                            <span className="text-[var(--kuara-fg-subtle)]">—</span>
                          )}
                        </TableCell>
                        <TableCell numeric>
                          {profile ? (
                            <div className="inline-flex items-center gap-1 text-[var(--kuara-fg)]">
                              <Star className="w-3.5 h-3.5 text-amber-500 fill-current" />
                              <span className="font-medium">
                                {Number(profile.ratingAverage || 0).toFixed(1)}
                              </span>
                              <span className="text-[var(--kuara-fg-subtle)]">
                                ({profile.ratingCount || 0})
                              </span>
                            </div>
                          ) : (
                            <span className="text-[var(--kuara-fg-subtle)]">—</span>
                          )}
                        </TableCell>
                        <TableCell
                          align="right"
                          numeric
                          className="text-[var(--kuara-fg-muted)] whitespace-nowrap"
                        >
                          {new Date(u.createdAt).toLocaleDateString("pt-BR")}
                        </TableCell>
                        <TableCell align="right">
                          {profile?.id ? (
                            <div className="inline-flex items-center justify-end gap-1">
                              {profile.status !== "VERIFIED" && (
                                <Button
                                  variant="success"
                                  size="xs"
                                  disabled={processingId === profile.id}
                                  onClick={() => handleUpdateProvider(profile.id, "VERIFIED")}
                                >
                                  Verificar
                                </Button>
                              )}
                              {profile.status !== "SUSPENDED" && (
                                <Button
                                  variant="danger-outline"
                                  size="xs"
                                  disabled={processingId === profile.id}
                                  onClick={() => {
                                    setRejectionReason(profile.rejectionReason || "");
                                    setModerationModal({
                                      profileId: profile.id,
                                      providerName: u.name,
                                      targetStatus: "SUSPENDED",
                                    });
                                  }}
                                >
                                  Suspender
                                </Button>
                              )}
                            </div>
                          ) : (
                            <span className="text-[var(--kuara-fg-subtle)]">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>

            {!loading && (
              <Pagination
                page={usersMeta.page}
                totalPages={usersMeta.totalPages}
                total={usersMeta.total}
                limit={usersMeta.limit}
                onPageChange={setUsersPage}
                itemLabel="usuários"
              />
            )}
          </div>
        )}
      </div>

      {/* Modal Justificativa de Rejeição / Suspensão */}
      <Modal
        isOpen={Boolean(moderationModal)}
        onClose={() => setModerationModal(null)}
        title={
          moderationModal?.targetStatus === "SUSPENDED"
            ? "Suspender Conta de Prestador"
            : "Rejeitar Documentação do Prestador"
        }
        subtitle={moderationModal?.providerName}
        icon={<ShieldX className="w-4 h-4 text-[var(--kuara-danger-text)]" />}
        size="md"
      >
        <form onSubmit={handleConfirmModerationModal} className="space-y-4">
          <Alert
            variant="danger"
            compact
            description={
              moderationModal?.targetStatus === "SUSPENDED"
                ? "O prestador ficará impedido de enviar orçamentos e não poderá se reativar sozinho."
                : "O prestador visualizará este motivo no painel para corrigir e reenviar os documentos."
            }
          />

          <Textarea
            label="Justificativa / Motivo Registrado"
            required
            minLength={5}
            rows={3}
            placeholder="Ex: Documento ilegível ou comprovante fora do prazo de 90 dias..."
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
          />

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--kuara-border)]">
            <Button
              variant="ghost"
              size="md"
              onClick={() => setModerationModal(null)}
              disabled={processingId !== null}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="danger"
              size="md"
              loading={processingId !== null}
            >
              {moderationModal?.targetStatus === "SUSPENDED"
                ? "Confirmar Suspensão"
                : "Confirmar Rejeição"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal Decisão Arbitral de Disputa */}
      <Modal
        isOpen={Boolean(disputeModal)}
        onClose={() => setDisputeModal(null)}
        title="Registrar Decisão Arbitral"
        subtitle={
          disputeModal?.decision === "RELEASE_TO_PROVIDER"
            ? "Liberar 100% da custódia ao prestador"
            : disputeModal?.decision === "REFUND_TO_CLIENT"
            ? "Estornar 100% da custódia ao contratante"
            : disputeModal?.decision === "SPLIT"
            ? "Acordo com divisão parcial entre as partes"
            : "Determinar retrabalho e retornar para execução"
        }
        icon={<Scale className="w-4 h-4" />}
        size="md"
      >
        <form onSubmit={handleConfirmDispute} className="space-y-4">
          {disputeModal && (
            <div className="p-2.5 rounded-md border border-[var(--kuara-border)] bg-[var(--kuara-surface-muted)] text-[11px] text-[var(--kuara-fg-muted)] space-y-0.5">
              <p className="font-medium text-[var(--kuara-fg)]">{disputeModal.openerSummary}</p>
              <p className="tabular-nums">
                Contratante: <strong>{disputeModal.clientName}</strong> • Contratado:{" "}
                <strong>{disputeModal.providerName}</strong> • Custódia:{" "}
                <strong>{formatBRL(disputeModal.grossCents)}</strong>
              </p>
            </div>
          )}

          {disputeModal?.decision === "SPLIT" && (() => {
            const pct = Math.min(99, Math.max(1, Math.round(Number(splitProviderPercent) || 50)));
            const providerShare = Math.round((disputeModal.grossCents * pct) / 100);
            const clientShare = disputeModal.grossCents - providerShare;
            return (
              <div className="p-3 rounded-md border border-[var(--kuara-border)] bg-[var(--kuara-surface-muted)] space-y-2.5 text-xs">
                <Input
                  label="Percentual destinado ao Prestador (%)"
                  type="number"
                  min={1}
                  max={99}
                  required
                  value={splitProviderPercent}
                  onChange={(e) => setSplitProviderPercent(e.target.value)}
                />
                {disputeModal.grossCents > 0 && (
                  <div className="flex justify-between text-[11px] text-[var(--kuara-fg-muted)] tabular-nums gap-2 flex-wrap">
                    <span>
                      Contratado ({disputeModal.providerName}, {pct}% bruto):{" "}
                      <strong className="text-[var(--kuara-fg)]">
                        {formatBRL(providerShare)}
                      </strong>
                    </span>
                    <span>
                      Contratante ({disputeModal.clientName}, {100 - pct}%):{" "}
                      <strong className="text-[var(--kuara-fg)]">
                        {formatBRL(clientShare)}
                      </strong>
                    </span>
                  </div>
                )}
              </div>
            );
          })()}

          <Textarea
            label="Parecer / Justificativa Administrativa"
            required
            minLength={5}
            rows={4}
            value={arbitrationNotes}
            onChange={(e) => setArbitrationNotes(e.target.value)}
            placeholder="Descreva a análise das evidências, fotos e fundamentação da decisão Kuara (mínimo 5 caracteres)..."
          />

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--kuara-border)]">
            <Button
              variant="ghost"
              size="md"
              onClick={() => setDisputeModal(null)}
              disabled={processingId !== null}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              loading={processingId !== null}
            >
              Confirmar Decisão Arbitral
            </Button>
          </div>
        </form>
      </Modal>
    </AppLayout>
  );
};
