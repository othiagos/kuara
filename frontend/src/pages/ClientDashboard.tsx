import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
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
  buttonVariants,
  ButtonGroup,
  Card,
  CardContent,
  CardFooter,
  EmptyState,
  Input,
  Modal,
  Pagination,
  Select,
  Skeleton,
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
} from "../components/ui";
import {
  Plus,
  Search,
  ChevronRight,
  FileText,
  MapPin,
  Clock,
  CheckCircle2,
  Star,
  ImagePlus,
  Trash2,
  X,
  Ban,
  UserCheck,
} from "lucide-react";

interface ServiceOrderItem {
  id: string;
  title: string;
  description: string;
  category: string;
  addressCity: string;
  addressState: string;
  addressZip?: string;
  addressLine?: string;
  status: string;
  targetProviderId?: string | null;
  completedAt?: string | null;
  createdAt: string;
  proposalsCount?: number;
  proposals?: Array<{ id: string }>;
  escrow?: {
    status: string;
    grossAmountCents: number;
    laborAmountCents?: number;
    materialsAmountCents?: number;
    materialsReleasedAt?: string | null;
  } | null;
}

const formatBRL = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

interface ShowcaseProvider {
  id: string;
  userId: string;
  bio?: string | null;
  categories: string[];
  serviceAreas: string[];
  ratingAverage: number;
  ratingCount: number;
  status: string;
  user?: {
    id: string;
    name: string;
  } | null;
}

interface ParsedApiError {
  message: string;
  details: string[];
}

function parseApiError(err: any, fallback: string): ParsedApiError {
  const data = err?.response?.data;
  const message = data?.error || fallback;
  const details = Array.isArray(data?.details)
    ? data.details
        .map((d: any) =>
          typeof d === "string"
            ? d
            : d?.path
            ? `${d.path}: ${d.message}`
            : String(d?.message || "")
        )
        .filter(Boolean)
    : [];
  return { message, details };
}

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const CATEGORY_OPTIONS = [
  { value: "Elétrica", label: "Elétrica" },
  { value: "Hidráulica", label: "Hidráulica" },
  { value: "Pintura", label: "Pintura" },
  { value: "Alvenaria", label: "Alvenaria" },
  { value: "Climatização", label: "Climatização" },
  { value: "Marcenaria", label: "Marcenaria" },
  { value: "Outros", label: "Outros" },
];

const SHOWCASE_CATEGORY_FILTER_OPTIONS = [
  { value: "", label: "Todas as categorias" },
  ...CATEGORY_OPTIONS,
];

const UF_OPTIONS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO",
].map((uf) => ({ value: uf, label: uf }));

const formatCepInput = (raw: string) => {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length > 5) {
    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  }
  return digits;
};

const ORDERS_PAGE_SIZE = 8;
const SHOWCASE_PAGE_SIZE = 8;

interface ClientOrdersSummary {
  totalOrders: number;
  openCount: number;
  inProgressCount: number;
  finishedCount: number;
}

const isCancellableOrder = (order: ServiceOrderItem) => {
  if (["OPEN", "PROPOSALS_RECEIVED", "ESCROW_PENDING"].includes(order.status)) {
    return true;
  }
  return order.status === "IN_PROGRESS" && !order.completedAt;
};

export const ClientDashboard: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") === "showcase" ? "showcase" : "orders";

  const [orders, setOrders] = useState<ServiceOrderItem[]>([]);
  const [ordersMeta, setOrdersMeta] = useState<PaginationMeta>(() =>
    createEmptyMeta(ORDERS_PAGE_SIZE)
  );
  const [ordersSummary, setOrdersSummary] = useState<ClientOrdersSummary | null>(null);
  const [isOrdersServerPaginated, setIsOrdersServerPaginated] = useState(false);
  const [ordersPage, setOrdersPage] = useState(1);

  const [providers, setProviders] = useState<ShowcaseProvider[]>([]);
  const [providersMeta, setProvidersMeta] = useState<PaginationMeta>(() =>
    createEmptyMeta(SHOWCASE_PAGE_SIZE)
  );
  const [isProvidersServerPaginated, setIsProvidersServerPaginated] = useState(false);
  const [providersPage, setProvidersPage] = useState(1);
  const [hasLoadedProviders, setHasLoadedProviders] = useState(false);

  const [loadingOrders, setLoadingOrders] = useState(true);
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [ordersError, setOrdersError] = useState("");
  const [providersError, setProvidersError] = useState("");

  // Orders filters
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "OPEN" | "IN_PROGRESS" | "FINISHED">("ALL");

  // Showcase filters
  const [showcaseSearch, setShowcaseSearch] = useState("");
  const [debouncedShowcaseSearch, setDebouncedShowcaseSearch] = useState("");
  const [showcaseCity, setShowcaseCity] = useState("");
  const [debouncedShowcaseCity, setDebouncedShowcaseCity] = useState("");
  const [showcaseCategory, setShowcaseCategory] = useState("");

  // Create order modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [targetProvider, setTargetProvider] = useState<{ id: string; name: string } | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Elétrica");
  const [addressCity, setAddressCity] = useState("");
  const [addressState, setAddressState] = useState("SP");
  const [addressZip, setAddressZip] = useState("");
  const [addressLine, setAddressLine] = useState("");
  const [photoInput, setPhotoInput] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoInputError, setPhotoInputError] = useState("");
  const [formError, setFormError] = useState<ParsedApiError | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Cancel order modal state
  const [orderToCancel, setOrderToCancel] = useState<ServiceOrderItem | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelError, setCancelError] = useState("");
  const [cancelling, setCancelling] = useState(false);

  const toast = useToast();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedShowcaseSearch(showcaseSearch);
      setDebouncedShowcaseCity(showcaseCity);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [showcaseSearch, showcaseCity]);

  const fetchOrders = useCallback(async () => {
    setLoadingOrders(true);
    setOrdersError("");
    try {
      const params: Record<string, string | number> = {
        page: ordersPage,
        limit: ORDERS_PAGE_SIZE,
      };
      if (statusFilter !== "ALL") params.status = statusFilter;
      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();

      const res = await api.get("/services/my", { params });
      const parsed = parsePaginatedResponse<ServiceOrderItem, ClientOrdersSummary>(
        res.data,
        ORDERS_PAGE_SIZE
      );
      setOrders(parsed.items);
      setOrdersMeta(parsed.meta);
      setOrdersSummary(parsed.summary ?? null);
      setIsOrdersServerPaginated(parsed.isServerPaginated);
      if (parsed.isServerPaginated && parsed.meta.page !== ordersPage) {
        setOrdersPage(parsed.meta.page);
      }
    } catch (err: any) {
      const parsed = parseApiError(err, "Erro ao carregar suas solicitações.");
      setOrdersError(parsed.message);
      toast.error(parsed.message);
    } finally {
      setLoadingOrders(false);
    }
  }, [ordersPage, statusFilter, debouncedSearch, toast]);

  const fetchProviders = useCallback(async () => {
    setLoadingProviders(true);
    setProvidersError("");
    try {
      const params: Record<string, string | number> = {
        page: providersPage,
        limit: SHOWCASE_PAGE_SIZE,
      };
      if (showcaseCategory) params.category = showcaseCategory;
      if (debouncedShowcaseCity.trim()) params.city = debouncedShowcaseCity.trim();
      if (debouncedShowcaseSearch.trim()) params.search = debouncedShowcaseSearch.trim();

      const res = await api.get("/providers/showcase", { params });
      const parsed = parsePaginatedResponse<ShowcaseProvider>(
        res.data,
        SHOWCASE_PAGE_SIZE
      );
      setProviders(parsed.items);
      setProvidersMeta(parsed.meta);
      setIsProvidersServerPaginated(parsed.isServerPaginated);
      setHasLoadedProviders(true);
      if (parsed.isServerPaginated && parsed.meta.page !== providersPage) {
        setProvidersPage(parsed.meta.page);
      }
    } catch (err: any) {
      const parsed = parseApiError(err, "Erro ao carregar a vitrine de profissionais.");
      setProvidersError(parsed.message);
      toast.error(parsed.message);
    } finally {
      setLoadingProviders(false);
    }
  }, [providersPage, showcaseCategory, debouncedShowcaseCity, debouncedShowcaseSearch, toast]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    if (activeTab === "showcase" || searchParams.get("newRequest") === "1") {
      fetchProviders();
    }
  }, [activeTab, searchParams, fetchProviders]);

  const targetProviderDisplayName = useMemo(() => {
    if (!targetProvider) return "";
    const matched = providers.find(
      (p) => p.userId === targetProvider.id || p.user?.id === targetProvider.id
    );
    return matched?.user?.name || targetProvider.name;
  }, [targetProvider, providers]);

  const openCreateModal = useCallback(
    (opts?: { category?: string; provider?: { id: string; name: string } | null }) => {
      setFormError(null);
      setPhotoInputError("");
      if (opts?.category) {
        setCategory(opts.category);
      }
      setTargetProvider(opts?.provider ?? null);
      setShowCreateModal(true);
    },
    []
  );

  // Support deep link from Home showcase (e.g. ?tab=showcase&newRequest=1&providerId=...&category=...)
  useEffect(() => {
    if (searchParams.get("newRequest") !== "1") return;
    const paramProviderId = searchParams.get("providerId");
    const paramCategory = searchParams.get("category") || "Elétrica";
    const matchedProvider = paramProviderId
      ? providers.find((p) => p.userId === paramProviderId || p.user?.id === paramProviderId)
      : undefined;

    openCreateModal({
      category: paramCategory,
      provider: paramProviderId
        ? {
            id: paramProviderId,
            name: matchedProvider?.user?.name || "Profissional Selecionado",
          }
        : null,
    });

    const next = new URLSearchParams(searchParams);
    next.delete("newRequest");
    next.delete("providerId");
    next.delete("category");
    if (!next.get("tab")) next.set("tab", "showcase");
    setSearchParams(next, { replace: true });
  }, [searchParams, providers, openCreateModal, setSearchParams]);

  const handleAddPhotoUrl = () => {
    const trimmed = photoInput.trim();
    if (!trimmed) return;
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        setPhotoInputError("A URL deve começar com http:// ou https://");
        return;
      }
    } catch {
      setPhotoInputError("Informe uma URL válida (ex: https://...)");
      return;
    }

    if (photos.includes(trimmed)) {
      setPhotoInputError("Esta foto já foi adicionada.");
      return;
    }
    setPhotos((prev) => [...prev, trimmed]);
    setPhotoInput("");
    setPhotoInputError("");
  };

  const handleRemovePhotoUrl = (urlToRemove: string) => {
    setPhotos((prev) => prev.filter((url) => url !== urlToRemove));
  };

  const resetCreateForm = () => {
    setTitle("");
    setDescription("");
    setAddressLine("");
    setPhotoInput("");
    setPhotos([]);
    setPhotoInputError("");
    setFormError(null);
    setTargetProvider(null);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const zipDigits = addressZip.replace(/\D/g, "");
    if (zipDigits.length < 8) {
      setFormError({
        message: "Informe um CEP válido com 8 dígitos (ex: 01310-100).",
        details: [],
      });
      return;
    }

    if (photoInput.trim()) {
      setFormError({
        message: "Adicione ou limpe o campo de URL de foto antes de publicar.",
        details: [],
      });
      return;
    }

    setSubmitting(true);
    try {
      const payload: Record<string, any> = {
        title: title.trim(),
        description: description.trim(),
        category,
        addressCity: addressCity.trim(),
        addressState: addressState.trim().toUpperCase(),
        addressZip: addressZip.trim(),
        addressLine: addressLine.trim(),
      };

      if (photos.length > 0) {
        payload.photos = photos;
      }
      if (targetProvider?.id) {
        payload.targetProviderId = targetProvider.id;
      }

      await api.post("/services", payload);
      toast.success(
        targetProvider
          ? `Solicitação direcionada enviada para ${targetProviderDisplayName}!`
          : "Solicitação criada com sucesso! Profissionais da região serão notificados."
      );
      setShowCreateModal(false);
      resetCreateForm();
      setOrdersPage(1);
      await fetchOrders();
      setSearchParams({ tab: "orders" });
    } catch (err: any) {
      const parsed = parseApiError(err, "Erro ao criar pedido.");
      setFormError(parsed);
      toast.error(parsed.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmCancel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderToCancel) return;
    setCancelError("");

    const trimmedReason = cancelReason.trim();
    if (trimmedReason.length > 0 && trimmedReason.length < 3) {
      setCancelError("Se informar um motivo, escreva pelo menos 3 caracteres.");
      return;
    }

    setCancelling(true);
    try {
      await api.patch(`/services/${orderToCancel.id}/cancel`, {
        ...(trimmedReason ? { reason: trimmedReason } : {}),
      });
      toast.success(
        orderToCancel.status === "IN_PROGRESS"
          ? "Serviço cancelado e valor em custódia estornado."
          : "Solicitação cancelada com sucesso."
      );
      setOrderToCancel(null);
      setCancelReason("");
      await fetchOrders();
    } catch (err: any) {
      const parsed = parseApiError(err, "Não foi possível cancelar a solicitação.");
      setCancelError(parsed.message);
      toast.error(parsed.message);
    } finally {
      setCancelling(false);
    }
  };

  const openCount = useMemo(
    () =>
      ordersSummary?.openCount ??
      orders.filter((o) => o.status === "OPEN" || o.status === "PROPOSALS_RECEIVED").length,
    [ordersSummary, orders]
  );

  const inProgressCount = useMemo(
    () =>
      ordersSummary?.inProgressCount ??
      orders.filter((o) =>
        ["IN_PROGRESS", "COMPLETED_PENDING_APPROVAL", "ESCROW_PENDING", "IN_DISPUTE"].includes(
          o.status
        )
      ).length,
    [ordersSummary, orders]
  );

  const finishedCount = useMemo(
    () => ordersSummary?.finishedCount ?? orders.filter((o) => o.status === "FINISHED").length,
    [ordersSummary, orders]
  );

  const totalOrdersCount = ordersSummary?.totalOrders ?? orders.length;

  const filteredOrders = useMemo(() => {
    if (isOrdersServerPaginated) return orders;
    const q = normalizeText(search.trim());
    return orders.filter((o) => {
      const matchesSearch =
        !q ||
        normalizeText(o.title || "").includes(q) ||
        normalizeText(o.category || "").includes(q) ||
        normalizeText(o.addressCity || "").includes(q);
      if (!matchesSearch) return false;

      if (statusFilter === "IN_PROGRESS") {
        return ["IN_PROGRESS", "COMPLETED_PENDING_APPROVAL", "ESCROW_PENDING", "IN_DISPUTE"].includes(
          o.status
        );
      }
      if (statusFilter === "FINISHED") return o.status === "FINISHED";
      if (statusFilter === "OPEN") {
        return o.status === "OPEN" || o.status === "PROPOSALS_RECEIVED";
      }
      return true;
    });
  }, [isOrdersServerPaginated, orders, search, statusFilter]);

  const filteredProviders = useMemo(() => {
    if (isProvidersServerPaginated) return providers;
    const q = normalizeText(showcaseSearch.trim());
    const cityQ = normalizeText(showcaseCity.trim());

    return providers.filter((p) => {
      if (showcaseCategory) {
        const hasCat = (p.categories || []).some(
          (cat) => normalizeText(cat) === normalizeText(showcaseCategory)
        );
        if (!hasCat) return false;
      }

      if (cityQ) {
        const areasMatch = (p.serviceAreas || []).some((area) =>
          normalizeText(area).includes(cityQ)
        );
        if (!areasMatch) return false;
      }

      if (q) {
        const haystack = [
          p.user?.name || "",
          p.bio || "",
          ...(p.categories || []),
          ...(p.serviceAreas || []),
        ]
          .map(normalizeText)
          .join(" ");
        if (!haystack.includes(q)) return false;
      }

      return true;
    });
  }, [isProvidersServerPaginated, providers, showcaseSearch, showcaseCity, showcaseCategory]);

  const showcaseBadgeCount = hasLoadedProviders ? providersMeta.total : undefined;

  return (
    <AppLayout
      title="Painel do Contratante"
      subtitle="Acompanhe seus reparos, compare propostas claras e conte com entrega garantida."
      activeTab={activeTab}
      onTabChange={(tab) => setSearchParams({ tab })}
      sidebarBadges={{
        orders: { count: totalOrdersCount, tone: totalOrdersCount > 0 ? "amber" : "neutral" },
        ...(typeof showcaseBadgeCount === "number"
          ? { showcase: { count: showcaseBadgeCount, tone: "neutral" as const } }
          : {}),
      }}
      actions={
        <Button
          variant="primary"
          size="md"
          leftIcon={<Plus className="w-3.5 h-3.5" />}
          onClick={() => openCreateModal()}
        >
          Nova Solicitação
        </Button>
      }
    >
      <div className="space-y-6">
        {/* KPI Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            label="Total de Chamados"
            value={totalOrdersCount}
            hint="Reparos registrados por você"
            tone="amber"
            icon={<FileText className="w-4 h-4" />}
          />
          <StatCard
            label="Em Andamento / Inspeção"
            value={inProgressCount}
            hint="Serviços contratados ou em conferência"
            tone="blue"
            icon={<Clock className="w-4 h-4" />}
          />
          <StatCard
            label="Serviços Concluídos"
            value={finishedCount}
            hint="Entregas aprovadas e avaliadas"
            tone="emerald"
            icon={<CheckCircle2 className="w-4 h-4" />}
          />
        </div>

        {/* TAB 1: MINHAS SOLICITAÇÕES */}
        {activeTab === "orders" && (
          <div className="space-y-4">
            {ordersError && (
              <Alert
                variant="danger"
                compact
                title="Não foi possível atualizar suas solicitações"
                description={ordersError}
                action={
                  <Button variant="outline" size="xs" onClick={fetchOrders}>
                    Tentar novamente
                  </Button>
                }
              />
            )}

            {/* Filter and Search Bar */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <Input
                size="md"
                placeholder="Buscar por título, cidade ou especialidade..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setOrdersPage(1);
                }}
                leftIcon={<Search className="w-3.5 h-3.5" />}
                rightElement={
                  search ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSearch("");
                        setOrdersPage(1);
                      }}
                      aria-label="Limpar busca"
                      className="p-0.5 rounded text-[var(--kuara-fg-subtle)] hover:text-[var(--kuara-fg)]"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  ) : undefined
                }
                containerClassName="w-full lg:max-w-sm"
              />

              <ButtonGroup
                size="md"
                variant="attached"
                value={statusFilter}
                onChange={(nextStatus) => {
                  setStatusFilter(nextStatus);
                  setOrdersPage(1);
                }}
                options={[
                  { value: "ALL", label: "Todos", count: totalOrdersCount },
                  { value: "OPEN", label: "Abertos", count: openCount },
                  { value: "IN_PROGRESS", label: "Em Execução", count: inProgressCount },
                  { value: "FINISHED", label: "Concluídos", count: finishedCount },
                ]}
              />
            </div>

            {/* Structured Data Table */}
            {loadingOrders ? (
              <Card>
                <TableSkeleton rows={5} />
              </Card>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow interactive={false}>
                    <TableHead>Data</TableHead>
                    <TableHead>Serviço / Local</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Propostas</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead align="right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.length === 0 ? (
                    <TableEmpty colSpan={6}>
                      <EmptyState
                        icon={<FileText className="w-4 h-4" />}
                        title="Nenhum chamado encontrado"
                        description={
                          totalOrdersCount === 0 && !search.trim() && statusFilter === "ALL"
                            ? "Clique em Nova Solicitação para abrir um pedido sem custo inicial."
                            : "Ajuste sua busca ou o filtro de status para localizar o chamado."
                        }
                        action={
                          totalOrdersCount === 0 && !search.trim() && statusFilter === "ALL" ? (
                            <Button
                              variant="primary"
                              size="sm"
                              leftIcon={<Plus className="w-3.5 h-3.5" />}
                              onClick={() => openCreateModal()}
                            >
                              Nova Solicitação
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSearch("");
                                setStatusFilter("ALL");
                                setOrdersPage(1);
                              }}
                            >
                              Limpar filtros
                            </Button>
                          )
                        }
                      />
                    </TableEmpty>
                  ) : (
                    filteredOrders.map((o) => {
                      const proposalTotal = o.proposalsCount ?? o.proposals?.length ?? 0;
                      const canCancel = isCancellableOrder(o);

                      return (
                        <TableRow key={o.id}>
                          <TableCell numeric className="whitespace-nowrap text-[var(--kuara-fg-muted)]">
                            {new Date(o.createdAt).toLocaleDateString("pt-BR")}
                          </TableCell>

                          <TableCell className="min-w-[220px]">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <Link
                                to={`/services/${o.id}`}
                                className="font-medium text-xs text-[var(--kuara-fg)] hover:text-[var(--kuara-primary)] transition-colors"
                              >
                                {o.title}
                              </Link>
                              {o.targetProviderId && (
                                <Tag tone="blue" icon={<UserCheck className="w-2.5 h-2.5" />}>
                                  Direto
                                </Tag>
                              )}
                            </div>
                            <span className="text-[11px] text-[var(--kuara-fg-muted)] inline-flex items-center gap-1 mt-0.5">
                              <MapPin className="w-3 h-3 text-[var(--kuara-fg-subtle)] shrink-0" />
                              <span>
                                {o.addressCity} - {o.addressState}
                              </span>
                            </span>
                          </TableCell>

                          <TableCell>
                            <Tag>{o.category}</Tag>
                          </TableCell>

                          <TableCell numeric className="whitespace-nowrap text-[var(--kuara-fg-muted)]">
                            <span className="font-semibold text-[var(--kuara-fg)]">
                              {proposalTotal}
                            </span>{" "}
                            / 4
                          </TableCell>

                          <TableCell>
                            <Badge status={o.status} />
                          </TableCell>

                          <TableCell align="right" className="whitespace-nowrap">
                            <div className="inline-flex items-center justify-end gap-1.5">
                              {canCancel && (
                                <Button
                                  variant="danger-outline"
                                  size="xs"
                                  leftIcon={<Ban className="w-3 h-3" />}
                                  onClick={() => {
                                    setOrderToCancel(o);
                                    setCancelReason("");
                                    setCancelError("");
                                  }}
                                >
                                  Cancelar
                                </Button>
                              )}

                              <Link
                                to={`/services/${o.id}`}
                                className={buttonVariants({ variant: "outline", size: "xs" })}
                              >
                                <span>Detalhes</span>
                                <ChevronRight className="w-3 h-3" />
                              </Link>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            )}

            {!loadingOrders && (
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

        {/* TAB 2: BUSCAR PROFISSIONAIS VERIFICADOS */}
        {activeTab === "showcase" && (
          <div className="space-y-4">
            {providersError && (
              <Alert
                variant="danger"
                compact
                title="Não foi possível carregar os profissionais"
                description={providersError}
                action={
                  <Button variant="outline" size="xs" onClick={fetchProviders}>
                    Tentar novamente
                  </Button>
                }
              />
            )}

            <Card padding="sm">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <Input
                  size="md"
                  placeholder="Buscar por nome, bio ou especialidade..."
                  value={showcaseSearch}
                  onChange={(e) => {
                    setShowcaseSearch(e.target.value);
                    setProvidersPage(1);
                  }}
                  leftIcon={<Search className="w-3.5 h-3.5" />}
                  rightElement={
                    showcaseSearch ? (
                      <button
                        type="button"
                        onClick={() => {
                          setShowcaseSearch("");
                          setProvidersPage(1);
                        }}
                        aria-label="Limpar busca"
                        className="p-0.5 rounded text-[var(--kuara-fg-subtle)] hover:text-[var(--kuara-fg)]"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    ) : undefined
                  }
                />

                <Input
                  size="md"
                  placeholder="Filtrar por cidade ou bairro..."
                  value={showcaseCity}
                  onChange={(e) => {
                    setShowcaseCity(e.target.value);
                    setProvidersPage(1);
                  }}
                  leftIcon={<MapPin className="w-3.5 h-3.5" />}
                  rightElement={
                    showcaseCity ? (
                      <button
                        type="button"
                        onClick={() => {
                          setShowcaseCity("");
                          setProvidersPage(1);
                        }}
                        aria-label="Limpar cidade"
                        className="p-0.5 rounded text-[var(--kuara-fg-subtle)] hover:text-[var(--kuara-fg)]"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    ) : undefined
                  }
                />

                <Select
                  size="md"
                  aria-label="Filtrar por categoria"
                  value={showcaseCategory}
                  onChange={(e) => {
                    setShowcaseCategory(e.target.value);
                    setProvidersPage(1);
                  }}
                  options={SHOWCASE_CATEGORY_FILTER_OPTIONS}
                />
              </div>
            </Card>

            {loadingProviders ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[0, 1, 2, 3].map((idx) => (
                  <Card key={idx} padding="md" className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <Skeleton className="h-4 w-44" />
                      <Skeleton className="h-5 w-20" />
                    </div>
                    <Skeleton className="h-3.5 w-28" />
                    <Skeleton className="h-8 w-full" />
                    <div className="flex justify-between pt-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-7 w-28" />
                    </div>
                  </Card>
                ))}
              </div>
            ) : filteredProviders.length === 0 ? (
              <Card>
                <EmptyState
                  icon={<Search className="w-4 h-4" />}
                  title="Nenhum profissional encontrado"
                  description="Tente alterar os filtros de categoria, cidade ou termo de busca."
                  action={
                    (showcaseSearch || showcaseCity || showcaseCategory) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setShowcaseSearch("");
                          setShowcaseCity("");
                          setShowcaseCategory("");
                          setProvidersPage(1);
                        }}
                      >
                        Limpar filtros
                      </Button>
                    )
                  }
                />
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredProviders.map((p) => {
                  const providerName = p.user?.name || "Profissional Verificado";
                  const ratingAvg =
                    typeof p.ratingAverage === "number" ? p.ratingAverage.toFixed(1) : "5.0";
                  const ratingCount = p.ratingCount ?? 0;

                  return (
                    <Card key={p.id} variant="interactive" className="flex flex-col justify-between">
                      <CardContent className="space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-sm text-[var(--kuara-fg)] truncate">
                                {providerName}
                              </span>
                              <Badge status={p.status} size="xs" />
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-[var(--kuara-fg-muted)] mt-1 tabular-nums">
                              <span className="inline-flex items-center text-amber-600 dark:text-amber-400 font-semibold">
                                <Star className="w-3.5 h-3.5 fill-current mr-1" />
                                {ratingAvg}
                              </span>
                              <span>({ratingCount} avaliações)</span>
                            </div>
                          </div>
                        </div>

                        <p className="text-xs text-[var(--kuara-fg-muted)] line-clamp-2 leading-relaxed">
                          {p.bio || "Profissional autônomo auditado na plataforma Kuara."}
                        </p>

                        {p.categories && p.categories.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {p.categories.map((cat) => (
                              <Tag key={cat}>{cat}</Tag>
                            ))}
                          </div>
                        )}
                      </CardContent>

                      <CardFooter className="py-2.5 gap-3">
                        <span className="inline-flex items-center gap-1 text-[11px] text-[var(--kuara-fg-muted)] min-w-0 truncate">
                          <MapPin className="w-3 h-3 text-[var(--kuara-fg-subtle)] shrink-0" />
                          <span className="truncate">
                            {p.serviceAreas?.length ? p.serviceAreas.join(", ") : "São Paulo"}
                          </span>
                        </span>

                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() =>
                            openCreateModal({
                              category: p.categories?.[0] || "Elétrica",
                              provider: {
                                id: p.userId || p.user?.id || p.id,
                                name: providerName,
                              },
                            })
                          }
                        >
                          Pedir Orçamento Direto
                        </Button>
                      </CardFooter>
                    </Card>
                  );
                })}
              </div>
            )}

            {!loadingProviders && (
              <Pagination
                page={providersMeta.page}
                totalPages={providersMeta.totalPages}
                total={providersMeta.total}
                limit={providersMeta.limit}
                onPageChange={setProvidersPage}
                itemLabel="profissionais"
              />
            )}
          </div>
        )}
      </div>

      {/* Modal Criar Solicitação */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Nova Solicitação de Manutenção"
        subtitle="Descreva o problema com fotos para comparar propostas — seu contato e endereço exato ficam protegidos até contratar"
        size="lg"
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => setShowCreateModal(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              form="client-create-order-form"
              variant="primary"
              size="md"
              loading={submitting}
            >
              {submitting ? "Publicando..." : "Publicar Solicitação"}
            </Button>
          </>
        }
      >
        <form id="client-create-order-form" onSubmit={handleCreate} className="space-y-3.5">
          {targetProvider && (
            <Alert
              variant="info"
              compact
              title={`Solicitação direcionada para ${targetProviderDisplayName}`}
              description="Apenas este profissional receberá a solicitação diretamente."
              action={
                <Button
                  variant="outline"
                  size="xs"
                  onClick={() => setTargetProvider(null)}
                >
                  Tornar pública
                </Button>
              }
            />
          )}

          {formError && (
            <Alert
              variant="danger"
              compact
              title={formError.message}
              description={
                formError.details.length > 0 ? (
                  <ul className="list-disc pl-4 mt-1 space-y-0.5 text-[11px]">
                    {formError.details.map((detail, idx) => (
                      <li key={idx}>{detail}</li>
                    ))}
                  </ul>
                ) : undefined
              }
            />
          )}

          <Input
            label="Título do Serviço"
            type="text"
            required
            minLength={5}
            placeholder="Ex: Instalação de Ventilador de Teto"
            hint="Mínimo de 5 caracteres"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Categoria"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              options={CATEGORY_OPTIONS}
            />

            <Input
              label="CEP"
              type="text"
              required
              minLength={8}
              maxLength={9}
              placeholder="00000-000"
              hint="8 dígitos (ex: 01310-100)"
              value={addressZip}
              onChange={(e) => setAddressZip(formatCepInput(e.target.value))}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              label="Cidade"
              type="text"
              required
              minLength={2}
              placeholder="Ex: São Paulo"
              value={addressCity}
              onChange={(e) => setAddressCity(e.target.value)}
              containerClassName="sm:col-span-2"
            />

            <Select
              label="Estado (UF)"
              required
              value={addressState}
              onChange={(e) => setAddressState(e.target.value)}
              options={UF_OPTIONS}
            />
          </div>

          <Input
            label="Endereço (Logradouro, Número e Bairro)"
            type="text"
            required
            minLength={5}
            placeholder="Ex: Rua dos Pinheiros, 120 - Pinheiros"
            hint="Visível apenas após o pagamento da custódia"
            value={addressLine}
            onChange={(e) => setAddressLine(e.target.value)}
          />

          <Textarea
            label="Descrição Detalhada do Reparo"
            rows={3}
            required
            minLength={10}
            placeholder="Explique o problema, medidas aproximadas e condições do local para receber orçamentos precisos..."
            hint="Mínimo de 10 caracteres"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          <div className="space-y-1.5 pt-1">
            <label
              htmlFor="order-photo-url-input"
              className="block text-xs font-medium text-[var(--kuara-fg)]"
            >
              Fotos do Local (Opcional)
            </label>
            <div className="flex items-center gap-2">
              <Input
                id="order-photo-url-input"
                type="url"
                placeholder="https://exemplo.com/foto-problema.jpg"
                value={photoInput}
                onChange={(e) => {
                  setPhotoInput(e.target.value);
                  if (photoInputError) setPhotoInputError("");
                }}
                containerClassName="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="md"
                leftIcon={<ImagePlus className="w-3.5 h-3.5" />}
                onClick={handleAddPhotoUrl}
              >
                Adicionar
              </Button>
            </div>
            {photoInputError && (
              <p className="text-[11px] text-[var(--kuara-danger-text)]">{photoInputError}</p>
            )}

            {photos.length > 0 && (
              <div className="space-y-1.5 pt-1">
                {photos.map((url) => (
                  <div
                    key={url}
                    className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md border border-[var(--kuara-border)] bg-[var(--kuara-surface-muted)] text-[11px]"
                  >
                    <span className="truncate text-[var(--kuara-fg-muted)]">{url}</span>
                    <button
                      type="button"
                      onClick={() => handleRemovePhotoUrl(url)}
                      aria-label="Remover foto"
                      className="p-0.5 text-[var(--kuara-danger-text)] hover:opacity-80 shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </form>
      </Modal>

      {/* Modal Cancelar Solicitação */}
      <Modal
        isOpen={Boolean(orderToCancel)}
        onClose={() => setOrderToCancel(null)}
        title="Cancelar Solicitação"
        subtitle={orderToCancel?.title}
        size="md"
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => setOrderToCancel(null)}
            >
              Voltar
            </Button>
            <Button
              type="submit"
              form="client-cancel-order-form"
              variant="danger"
              size="md"
              loading={cancelling}
            >
              {cancelling ? "Cancelando..." : "Confirmar Cancelamento"}
            </Button>
          </>
        }
      >
        {orderToCancel && (
          <form id="client-cancel-order-form" onSubmit={handleConfirmCancel} className="space-y-3.5">
            {orderToCancel.status === "IN_PROGRESS" ? (
              <Alert
                variant="warning"
                compact
                title="Estorno da Custódia de Mão de Obra"
                description={
                  (orderToCancel.escrow?.materialsAmountCents ?? 0) > 0 &&
                  orderToCancel.escrow?.materialsReleasedAt
                    ? `A mão de obra retida em custódia (${formatBRL(
                        orderToCancel.escrow.laborAmountCents ?? 0
                      )}) será estornada automaticamente. O adiantamento de materiais já liberado (${formatBRL(
                        orderToCancel.escrow.materialsAmountCents ?? 0
                      )}) não integra o estorno automático.`
                    : "Este serviço ainda não foi finalizado. Ao cancelar, a mão de obra retida em custódia será estornada integralmente."
                }
              />
            ) : (
              <Alert
                variant="neutral"
                compact
                description="Esta solicitação será encerrada e deixará de receber orçamentos."
              />
            )}

            {cancelError && <Alert variant="danger" compact description={cancelError} />}

            <Textarea
              label="Motivo do Cancelamento (Opcional)"
              rows={3}
              maxLength={500}
              placeholder="Explique brevemente o motivo do cancelamento..."
              hint="Se preenchido, informe pelo menos 3 caracteres"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />
          </form>
        )}
      </Modal>
    </AppLayout>
  );
};
