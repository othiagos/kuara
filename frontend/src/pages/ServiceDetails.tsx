import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import { resolveDisputeParties } from "../api/disputes";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { AppLayout } from "../components/AppLayout";
import { Stepper } from "../components/Stepper";
import { EscrowPaymentMethod, PixModal } from "../components/PixModal";
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
  Skeleton,
  Textarea,
  buttonVariants,
} from "../components/ui";
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  Camera,
  CheckCircle2,
  Clock,
  ExternalLink,
  Lock,
  MapPin,
  MessageSquare,
  Phone,
  Scale,
  Send,
  ShieldCheck,
  Star,
  Unlock,
} from "lucide-react";

const CLIENT_REVIEW_TAGS = [
  "Qualidade do acabamento",
  "Pontualidade",
  "Limpeza/Segurança",
  "Comunicação",
  "Preço Justo",
];

const PROVIDER_REVIEW_TAGS = [
  "Escopo Claro",
  "Cordialidade",
  "Acesso Facilitado",
  "Aprovação Rápida",
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

function parsePhotoUrls(raw: string): string[] {
  return raw
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function findInvalidPhotoUrl(urls: string[]): string | null {
  for (const url of urls) {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return url;
      }
    } catch {
      return url;
    }
  }
  return null;
}

const PhotoGallery: React.FC<{ title: string; urls?: string[] }> = ({ title, urls }) => {
  const [failedImages, setFailedImages] = useState<Record<number, boolean>>({});

  if (!urls || urls.length === 0) return null;

  return (
    <div className="space-y-2">
      <span className="text-[11px] font-medium text-[var(--kuara-fg-muted)] flex items-center gap-1.5">
        <Camera className="w-3.5 h-3.5 text-[var(--kuara-fg-subtle)]" />
        {title} ({urls.length})
      </span>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {urls.map((url, idx) => (
          <a
            key={`${url}-${idx}`}
            href={url}
            target="_blank"
            rel="noreferrer"
            className="group rounded-md border border-[var(--kuara-border)] bg-[var(--kuara-surface-muted)] hover:border-[var(--kuara-border-strong)] overflow-hidden transition-colors flex flex-col"
          >
            {!failedImages[idx] ? (
              <div className="h-24 w-full bg-[var(--kuara-surface)] overflow-hidden">
                <img
                  src={url}
                  alt={`${title} ${idx + 1}`}
                  onError={() => setFailedImages((prev) => ({ ...prev, [idx]: true }))}
                  className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform"
                />
              </div>
            ) : (
              <div className="h-16 w-full flex items-center justify-center text-[var(--kuara-fg-subtle)] bg-[var(--kuara-surface)]">
                <Camera className="w-4 h-4" />
              </div>
            )}
            <div className="px-2 py-1.5 flex items-center justify-between gap-1 text-[11px] text-[var(--kuara-fg-muted)]">
              <span className="truncate">Foto #{idx + 1}</span>
              <ExternalLink className="w-3 h-3 shrink-0 text-[var(--kuara-fg-subtle)]" />
            </div>
          </a>
        ))}
      </div>
    </div>
  );
};

export const ServiceDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const toast = useToast();

  const [order, setOrder] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [selectedChatProposalId, setSelectedChatProposalId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Modals
  const [showPixModal, setShowPixModal] = useState(false);
  const [showProposalModal, setShowProposalModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showMaterialProofModal, setShowMaterialProofModal] = useState(false);
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [showCounterEvidenceModal, setShowCounterEvidenceModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  // Proposal submission state
  const [proposalDesc, setProposalDesc] = useState("");
  const [laborCostReais, setLaborCostReais] = useState<string>("150");
  const [materialCostReais, setMaterialCostReais] = useState<string>("0");
  const [materialPolicy, setMaterialPolicy] = useState<"CLIENT_SUPPLIES" | "PROVIDER_ADVANCE">(
    "CLIENT_SUPPLIES"
  );
  const [materialsList, setMaterialsList] = useState<string>("");
  const [estimatedDays, setEstimatedDays] = useState<string>("1");

  // Completion & Material proofs state
  const [completionPhotosText, setCompletionPhotosText] = useState("");
  const [materialProofText, setMaterialProofText] = useState("");

  // Dispute & counter-evidence state
  const [disputeReason, setDisputeReason] = useState("");
  const [disputePhotosText, setDisputePhotosText] = useState("");
  const [counterReason, setCounterReason] = useState("");
  const [counterPhotosText, setCounterPhotosText] = useState("");

  // Cancellation state
  const [cancelReason, setCancelReason] = useState("");

  // Review state
  const [rating, setRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const getDashboardBackUrl = () => {
    if (user?.role === "CLIENT") return "/dashboard/client";
    if (user?.role === "PROVIDER") return "/dashboard/provider";
    return "/dashboard/admin";
  };

  const silentFetchOrder = useCallback(async () => {
    if (!id) return null;
    try {
      const res = await api.get(`/services/${id}`);
      setOrder(res.data);
      return res.data;
    } catch {
      return null;
    }
  }, [id]);

  const fetchDetails = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await api.get(`/services/${id}`);
      setOrder(res.data);
    } catch (err: any) {
      setOrder(null);
      if (err?.response?.status === 403) {
        toast.error("Você não tem permissão para visualizar este chamado.");
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  const isClient = Boolean(user?.id && order?.clientId === user.id);
  const isAdmin = user?.role === "ADMIN";
  const isProvider = user?.role === "PROVIDER";
  const isVerifiedProvider = user?.providerProfile?.status === "VERIFIED";

  const acceptedProposal = useMemo(() => {
    if (!order) return null;
    return (
      order.proposals?.find(
        (p: any) => p.isAccepted || p.status === "ACCEPTED" || p.id === order.acceptedProposalId
      ) ||
      order.acceptedProposal ||
      null
    );
  }, [order]);

  const isAcceptedProvider = Boolean(
    user?.id &&
      (acceptedProposal?.providerId === user.id || order?.acceptedProposal?.providerId === user.id)
  );

  const myProposal = useMemo(() => {
    if (!order || !user?.id) return null;
    return (
      order.myProposal ||
      order.proposals?.find((p: any) => p.providerId === user.id) ||
      null
    );
  }, [order, user?.id]);

  const isPreAcceptanceStage = Boolean(
    order && ["OPEN", "PROPOSALS_RECEIVED"].includes(order.status)
  );
  const isEscrowFunded = Boolean(
    order &&
      ["IN_PROGRESS", "COMPLETED_PENDING_APPROVAL", "FINISHED", "IN_DISPUTE"].includes(
        order.status
      )
  );

  const hasChatAccess = useMemo(() => {
    if (!order || !user) return false;
    if (isAdmin || isClient || isAcceptedProvider) return true;
    if (isProvider && isPreAcceptanceStage && Boolean(myProposal)) return true;
    return false;
  }, [order, user, isAdmin, isClient, isAcceptedProvider, isProvider, isPreAcceptanceStage, myProposal]);

  const canSendChat = Boolean(
    hasChatAccess &&
      order?.status !== "CANCELLED" &&
      !(isClient && isPreAcceptanceStage && (order?.proposals?.length ?? 0) === 0)
  );

  // Default selected proposal thread for client during pre-acceptance if proposals exist
  useEffect(() => {
    if (!order || !isClient || !isPreAcceptanceStage) return;
    const proposals: any[] = order.proposals || [];
    if (proposals.length === 0) {
      if (selectedChatProposalId) setSelectedChatProposalId("");
      return;
    }
    const stillExists = proposals.some((p) => p.id === selectedChatProposalId);
    if (!selectedChatProposalId || !stillExists) {
      setSelectedChatProposalId(proposals[0].id);
    }
  }, [order, isClient, isPreAcceptanceStage, selectedChatProposalId]);

  const fetchMessages = useCallback(async () => {
    if (!id || !hasChatAccess) return;
    try {
      const params: Record<string, string> = {};
      if (isPreAcceptanceStage) {
        if (isClient && selectedChatProposalId) {
          params.proposalId = selectedChatProposalId;
        } else if (isProvider && myProposal?.id) {
          params.proposalId = myProposal.id;
        }
      }
      const res = await api.get(`/chat/${id}`, { params });
      setMessages(Array.isArray(res.data) ? res.data : []);
    } catch {
      // Avoid noisy errors during background polling
    }
  }, [id, hasChatAccess, isPreAcceptanceStage, isClient, isProvider, selectedChatProposalId, myProposal?.id]);

  // Poll chat (only when user has access) + softly refresh order state
  useEffect(() => {
    if (!id || !order) return;

    if (hasChatAccess) {
      fetchMessages();
    } else {
      setMessages([]);
    }

    const chatTimer = hasChatAccess ? setInterval(fetchMessages, 4000) : null;
    const orderTimer = setInterval(silentFetchOrder, 10000);
    const onFocus = () => {
      silentFetchOrder();
      if (hasChatAccess) fetchMessages();
    };
    window.addEventListener("focus", onFocus);

    return () => {
      if (chatTimer) clearInterval(chatTimer);
      clearInterval(orderTimer);
      window.removeEventListener("focus", onFocus);
    };
  }, [id, Boolean(order), hasChatAccess, fetchMessages, silentFetchOrder]);

  // Initialize default review tag by role
  useEffect(() => {
    if (!order) return;
    if (isClient) {
      setSelectedTags([CLIENT_REVIEW_TAGS[0]]);
    } else if (isAcceptedProvider) {
      setSelectedTags([PROVIDER_REVIEW_TAGS[0]]);
    }
  }, [order?.id, isClient, isAcceptedProvider]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !id || !canSendChat) return;
    try {
      const payload: Record<string, any> = { content: newMessage.trim() };
      if (isPreAcceptanceStage) {
        if (isClient && selectedChatProposalId) {
          payload.proposalId = selectedChatProposalId;
        } else if (isProvider && myProposal?.id) {
          payload.proposalId = myProposal.id;
        }
      }
      await api.post(`/chat/${id}`, payload);
      setNewMessage("");
      fetchMessages();
    } catch (err: any) {
      toast.error(extractApiError(err, "Erro ao enviar mensagem."));
    }
  };

  const handleAcceptProposal = async (proposalId: string) => {
    setActionLoading(true);
    try {
      await api.patch(`/proposals/${proposalId}/accept`);
      toast.success("Orçamento aceito! Efetue o depósito em custódia para iniciar o serviço.");
      await silentFetchOrder();
    } catch (err: any) {
      toast.error(extractApiError(err, "Erro ao aceitar orçamento."));
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    const laborCents = Math.round((Number(laborCostReais) || 0) * 100);
    const materialCents = Math.round((Number(materialCostReais) || 0) * 100);

    if (laborCents < 500) {
      toast.error("Mínimo de mão de obra permitido: R$ 5,00.");
      return;
    }

    setActionLoading(true);
    try {
      await api.post("/proposals", {
        serviceOrderId: id,
        description: proposalDesc.trim(),
        estimatedDays: Number(estimatedDays),
        laborCostCents: laborCents,
        materialCostCents: materialCents,
        materialPolicy: materialCents > 0 ? "PROVIDER_ADVANCE" : "CLIENT_SUPPLIES",
        ...(materialsList.trim() ? { materialsList: materialsList.trim() } : {}),
      });
      toast.success("Orçamento formalizado enviado com sucesso! Sem taxa por lead.");
      setShowProposalModal(false);
      setProposalDesc("");
      setMaterialsList("");
      await silentFetchOrder();
    } catch (err: any) {
      toast.error(extractApiError(err, "Erro ao enviar proposta."));
    } finally {
      setActionLoading(false);
    }
  };

  const handleSubmitMaterialProof = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    const proofUrls = parsePhotoUrls(materialProofText);
    if (proofUrls.length === 0) {
      toast.error("Informe ao menos uma URL válida de nota fiscal ou foto dos materiais.");
      return;
    }

    setActionLoading(true);
    try {
      await api.post("/escrow/materials-proof", {
        serviceOrderId: id,
        proofUrls,
      });
      toast.success("Comprovantes de compra dos materiais anexados.");
      setShowMaterialProofModal(false);
      setMaterialProofText("");
      await silentFetchOrder();
    } catch (err: any) {
      toast.error(extractApiError(err, "Erro ao enviar comprovantes."));
    } finally {
      setActionLoading(false);
    }
  };

  const handleWithdrawProposal = async (proposalId: string) => {
    setActionLoading(true);
    try {
      await api.delete(`/proposals/${proposalId}`);
      toast.success("Proposta retirada com sucesso.");
      await silentFetchOrder();
    } catch (err: any) {
      toast.error(extractApiError(err, "Erro ao retirar proposta."));
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmPixPayment = async (paymentMethod: EscrowPaymentMethod) => {
    if (!id) return;
    setActionLoading(true);
    try {
      await api.post("/escrow/pay", {
        serviceOrderId: id,
        paymentMethod,
      });
      setShowPixModal(false);
      toast.success(
        (acceptedProposal?.materialCostCents ?? 0) > 0
          ? "Custódia confirmada! Mão de obra protegida, materiais liberados para compra e contatos desbloqueados."
          : "Mão de obra protegida em custódia! Contatos liberados."
      );
      await silentFetchOrder();
    } catch (err: any) {
      toast.error(extractApiError(err, "Erro ao confirmar custódia."));
    } finally {
      setActionLoading(false);
    }
  };

  const handleCompleteService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    const photos = parsePhotoUrls(completionPhotosText);
    const badUrl = findInvalidPhotoUrl(photos);
    if (badUrl) {
      toast.error(`URL de foto inválida: ${badUrl}`);
      return;
    }

    setActionLoading(true);
    try {
      await api.post("/escrow/complete", {
        serviceOrderId: id,
        ...(photos.length > 0 ? { completionPhotos: photos } : {}),
      });
      setShowCompleteModal(false);
      setCompletionPhotosText("");
      toast.success("Serviço sinalizado como concluído! Cliente notificado para aprovação de 72h.");
      await silentFetchOrder();
    } catch (err: any) {
      toast.error(extractApiError(err, "Erro ao concluir serviço."));
    } finally {
      setActionLoading(false);
    }
  };

  const handleApproveService = async () => {
    if (!id) return;
    setActionLoading(true);
    try {
      await api.post(`/escrow/release/${id}`);
      toast.success("Serviço aprovado e repasse líquido liberado ao profissional!");
      await silentFetchOrder();
    } catch (err: any) {
      toast.error(extractApiError(err, "Erro ao aprovar serviço."));
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    const evidencePhotos = parsePhotoUrls(disputePhotosText);
    const badUrl = findInvalidPhotoUrl(evidencePhotos);
    if (badUrl) {
      toast.error(`URL de evidência inválida: ${badUrl}`);
      return;
    }

    setActionLoading(true);
    try {
      await api.post("/escrow/dispute", {
        serviceOrderId: id,
        reason: disputeReason.trim(),
        ...(evidencePhotos.length > 0 ? { evidencePhotos } : {}),
      });
      setShowDisputeModal(false);
      setDisputeReason("");
      setDisputePhotosText("");
      toast.info("Disputa registrada! O saldo permanece retido sob mediação Kuara.");
      await silentFetchOrder();
    } catch (err: any) {
      toast.error(extractApiError(err, "Erro ao abrir disputa."));
    } finally {
      setActionLoading(false);
    }
  };

  const handleSubmitCounterEvidence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order?.dispute?.id) return;
    const evidencePhotos = parsePhotoUrls(counterPhotosText);
    const badUrl = findInvalidPhotoUrl(evidencePhotos);
    if (badUrl) {
      toast.error(`URL de evidência inválida: ${badUrl}`);
      return;
    }

    setActionLoading(true);
    try {
      await api.post(`/escrow/dispute/${order.dispute.id}/evidence`, {
        reason: counterReason.trim(),
        ...(evidencePhotos.length > 0 ? { evidencePhotos } : {}),
      });
      setShowCounterEvidenceModal(false);
      setCounterReason("");
      setCounterPhotosText("");
      toast.success("Contraprova e evidências registradas para o mediador.");
      await silentFetchOrder();
    } catch (err: any) {
      toast.error(extractApiError(err, "Erro ao enviar contraprova."));
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    const trimmedReason = cancelReason.trim();
    if (trimmedReason.length > 0 && trimmedReason.length < 3) {
      toast.error("Se informar um motivo, escreva pelo menos 3 caracteres.");
      return;
    }
    setActionLoading(true);
    try {
      await api.patch(`/services/${id}/cancel`, {
        ...(trimmedReason ? { reason: trimmedReason } : {}),
      });
      setShowCancelModal(false);
      setCancelReason("");
      toast.success("Solicitação cancelada com sucesso.");
      await silentFetchOrder();
    } catch (err: any) {
      toast.error(extractApiError(err, "Erro ao cancelar solicitação."));
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setActionLoading(true);
    try {
      await api.post("/reviews", {
        serviceOrderId: id,
        rating: Number(rating),
        tags: selectedTags,
        ...(reviewComment.trim() ? { comment: reviewComment.trim() } : {}),
      });
      toast.success("Avaliação publicada com sucesso!");
      setReviewComment("");
      await silentFetchOrder();
    } catch (err: any) {
      toast.error(extractApiError(err, "Erro ao enviar avaliação."));
    } finally {
      setActionLoading(false);
    }
  };

  // Integer-cent 5% fee preview on labor only (materials advance passes through without hold/fee)
  const modalLaborCents = Math.max(0, Math.round((Number(laborCostReais) || 0) * 100));
  const modalMaterialCents = Math.max(0, Math.round((Number(materialCostReais) || 0) * 100));
  const effectiveModalPolicy = modalMaterialCents > 0 ? "PROVIDER_ADVANCE" : materialPolicy;
  const modalTotalCents = modalLaborCents + modalMaterialCents;
  const modalFeeCents = Math.round(modalLaborCents * 0.05);
  const modalNetCents = modalLaborCents - modalFeeCents;

  if (loading) {
    return (
      <AppLayout
        title="Carregando chamado..."
        breadcrumbs={[{ label: "Painel", to: getDashboardBackUrl() }, { label: "Detalhes" }]}
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-4">
            <Skeleton className="h-52 w-full" />
            <Skeleton className="h-44 w-full" />
          </div>
          <div className="lg:col-span-4">
            <Skeleton className="h-[520px] w-full" />
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!order) {
    return (
      <AppLayout
        title="Chamado não encontrado"
        breadcrumbs={[{ label: "Painel", to: getDashboardBackUrl() }, { label: "Não encontrado" }]}
      >
        <Card>
          <EmptyState
            icon={<AlertTriangle className="w-4 h-4" />}
            title="Chamado não localizado ou acesso restrito"
            description="Verifique se o link está correto ou se sua conta possui autorização para este pedido."
            action={
              <Link
                to={getDashboardBackUrl()}
                className={buttonVariants({ variant: "primary", size: "md" })}
              >
                Voltar para o Meu Painel
              </Link>
            }
          />
        </Card>
      </AppLayout>
    );
  }

  const proposalCount =
    order.proposalsCount ?? order._count?.proposals ?? order.proposals?.length ?? 0;
  const canProviderPropose =
    isProvider &&
    isVerifiedProvider &&
    isPreAcceptanceStage &&
    !myProposal &&
    proposalCount < 4;

  const canClientCancel =
    (isClient || isAdmin) &&
    (["OPEN", "PROPOSALS_RECEIVED", "ESCROW_PENDING"].includes(order.status) ||
      (order.status === "IN_PROGRESS" && !order.completedAt));

  const canOpenDispute =
    (isClient || isAcceptedProvider) &&
    ["IN_PROGRESS", "COMPLETED_PENDING_APPROVAL"].includes(order.status) &&
    !order.dispute;

  const canSubmitCounterEvidence =
    (isClient || isAcceptedProvider) &&
    order.status === "IN_DISPUTE" &&
    order.dispute?.status === "PENDING_REVIEW" &&
    (!order.dispute?.openedById || order.dispute.openedById !== user?.id);

  const alreadyReviewed = Boolean(
    user?.id && order.reviews?.some((r: any) => r.authorId === user.id)
  );
  const canSubmitReview =
    order.status === "FINISHED" &&
    !isAdmin &&
    (isClient || isAcceptedProvider) &&
    !alreadyReviewed;

  const availableReviewTags = isClient ? CLIENT_REVIEW_TAGS : PROVIDER_REVIEW_TAGS;

  const formattedAddress = [
    order.addressLine,
    [order.addressCity, order.addressState].filter(Boolean).join(" - "),
    order.addressZip,
  ]
    .filter(Boolean)
    .join(", ");

  const proposalAmountForPix =
    order.escrow?.grossAmountCents ?? acceptedProposal?.totalCents ?? 0;

  return (
    <AppLayout
      title={order.title}
      subtitle={`Protocolo #${order.id.slice(0, 8)}`}
      breadcrumbs={[
        { label: "Painel", to: getDashboardBackUrl() },
        { label: order.title },
      ]}
      actions={
        <Link
          to={getDashboardBackUrl()}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Voltar</span>
        </Link>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* COLUNA ESQUERDA (8/12): CONTRATO, STEPPER, FOTOS, PROPOSTAS, DISPUTA & AVALIAÇÕES */}
        <div className="lg:col-span-8 space-y-5">
          {/* Card Principal do Serviço */}
          <Card>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Tag>{order.category}</Tag>
                    <Badge status={order.status} />
                    {order.targetProviderId && (
                      <Tag tone="amber">Solicitação Direta</Tag>
                    )}
                  </div>

                  <h2 className="text-lg font-bold text-[var(--kuara-fg)] tracking-tight">
                    {order.title}
                  </h2>

                  <p className="text-xs text-[var(--kuara-fg-muted)] flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-[var(--kuara-fg-subtle)] shrink-0" />
                    <span>{formattedAddress}</span>
                  </p>
                </div>

                {order.escrow && (
                  <div className="p-3 rounded-md border border-[var(--kuara-warning-border)] bg-[var(--kuara-warning-soft)] text-right shrink-0">
                    <span className="text-[11px] font-medium text-[var(--kuara-warning-text)] flex items-center justify-end gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                      {(order.escrow.materialsAmountCents ?? 0) > 0
                        ? `Custódia M.O. (${order.escrow.paymentMethod || "PIX"})`
                        : `Custódia Kuara (${order.escrow.paymentMethod || "PIX"})`}
                    </span>
                    <p className="text-xl font-bold text-[var(--kuara-fg)] tabular-nums mt-0.5">
                      {formatBRL(
                        order.escrow.materialsReleasedAt
                          ? order.escrow.laborAmountCents ?? order.escrow.grossAmountCents
                          : order.escrow.grossAmountCents
                      )}
                    </p>
                    {(order.escrow.materialsAmountCents ?? 0) > 0 && (
                      <p className="text-[11px] text-[var(--kuara-success-text)] tabular-nums">
                        Materiais liberados: {formatBRL(order.escrow.materialsAmountCents)}
                      </p>
                    )}
                    <p className="text-[11px] text-[var(--kuara-fg-muted)] tabular-nums">
                      Líquido: {formatBRL(order.escrow.netAmountCents)} • Taxa 5%:{" "}
                      {formatBRL(order.escrow.feeAmountCents)}
                    </p>
                  </div>
                )}
              </div>

              <Divider />

              <Stepper
                status={order.status}
                hasEscrow={isEscrowFunded || Boolean(order.escrow)}
                escrowStatus={order.escrow?.status}
              />

              <Divider />

              <div className="space-y-2 text-xs">
                <span className="font-semibold text-[var(--kuara-fg)] block">
                  Escopo Solicitado
                </span>
                <p className="text-[var(--kuara-fg-muted)] leading-relaxed whitespace-pre-line">
                  {order.description}
                </p>
              </div>

              {/* Fotos do problema enviadas pelo contratante */}
              <PhotoGallery title="Fotos do Problema / Local" urls={order.photos} />

              {/* Fotos de conclusão enviadas pelo prestador */}
              <PhotoGallery
                title="Comprovação da Entrega do Serviço"
                urls={order.completionPhotos}
              />

              {/* Notas / comprovantes dos materiais adiantados */}
              <PhotoGallery
                title="Comprovantes de Compra dos Materiais"
                urls={order.escrow?.materialProofUrls}
              />

              {/* Contatos diretos liberados pós-custódia (RN04) */}
              {isEscrowFunded &&
                (order.client?.phone || acceptedProposal?.provider?.phone) && (
                  <div className="p-3 rounded-md border border-[var(--kuara-success-border)] bg-[var(--kuara-success-soft)] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 text-[var(--kuara-success-text)] font-medium">
                      <Unlock className="w-4 h-4 shrink-0" />
                      <span>Contatos Diretos Liberados (Custódia Confirmada)</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-[var(--kuara-fg)] tabular-nums">
                      {order.client?.phone && (
                        <span className="inline-flex items-center gap-1">
                          <Phone className="w-3 h-3 text-[var(--kuara-success-text)]" />
                          Contratante ({order.client.name}): <strong>{order.client.phone}</strong>
                        </span>
                      )}
                      {acceptedProposal?.provider?.phone && (
                        <span className="inline-flex items-center gap-1">
                          <Phone className="w-3 h-3 text-[var(--kuara-success-text)]" />
                          Prestador ({acceptedProposal.provider.name}):{" "}
                          <strong>{acceptedProposal.provider.phone}</strong>
                        </span>
                      )}
                    </div>
                  </div>
                )}

              <Divider />

              {/* Bloco de Ação Contextual Único (sem duplicações) */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="text-xs text-[var(--kuara-fg-muted)]">
                  {order.status === "COMPLETED_PENDING_APPROVAL" && order.autoReleaseAt && (
                    <span className="inline-flex items-center gap-1.5 text-[var(--kuara-warning-text)] font-medium">
                      <Clock className="w-3.5 h-3.5 shrink-0" />
                      Prazo de inspeção de 72h até{" "}
                      {new Date(order.autoReleaseAt).toLocaleString("pt-BR")}
                    </span>
                  )}
                  {order.status === "ESCROW_PENDING" && isAcceptedProvider && (
                    <span className="text-[var(--kuara-fg-muted)]">
                      Aguardando o contratante concluir o depósito em custódia para iniciar a execução.
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {isClient && order.status === "ESCROW_PENDING" && (
                    <Button
                      variant="success"
                      size="md"
                      loading={actionLoading}
                      onClick={() => setShowPixModal(true)}
                      leftIcon={<ShieldCheck className="w-3.5 h-3.5" />}
                    >
                      Efetuar Pagamento em Custódia
                    </Button>
                  )}

                  {isAcceptedProvider && order.status === "IN_PROGRESS" && (
                    <Button
                      variant="primary"
                      size="md"
                      loading={actionLoading}
                      onClick={() => setShowCompleteModal(true)}
                      leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
                    >
                      Sinalizar Serviço Finalizado
                    </Button>
                  )}

                  {isAcceptedProvider &&
                    ["IN_PROGRESS", "COMPLETED_PENDING_APPROVAL"].includes(order.status) &&
                    (order.escrow?.materialsAmountCents ?? 0) > 0 && (
                      <Button
                        variant="outline"
                        size="md"
                        disabled={actionLoading}
                        onClick={() => {
                          setMaterialProofText(
                            Array.isArray(order.escrow?.materialProofUrls)
                              ? order.escrow.materialProofUrls.join("\n")
                              : ""
                          );
                          setShowMaterialProofModal(true);
                        }}
                        leftIcon={<Camera className="w-3.5 h-3.5" />}
                      >
                        Anexar Nota de Materiais
                      </Button>
                    )}

                  {isClient && order.status === "COMPLETED_PENDING_APPROVAL" && (
                    <Button
                      variant="success"
                      size="md"
                      loading={actionLoading}
                      onClick={handleApproveService}
                      leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
                    >
                      Aprovar e Liberar Repasse
                    </Button>
                  )}

                  {canOpenDispute && (
                    <Button
                      variant="danger-outline"
                      size="md"
                      disabled={actionLoading}
                      onClick={() => setShowDisputeModal(true)}
                      leftIcon={<AlertTriangle className="w-3.5 h-3.5" />}
                    >
                      Abrir Disputa
                    </Button>
                  )}

                  {canSubmitCounterEvidence && (
                    <Button
                      variant="warning"
                      size="md"
                      disabled={actionLoading}
                      onClick={() => {
                        setCounterReason(order.dispute?.counterEvidenceReason || "");
                        setCounterPhotosText(
                          Array.isArray(order.dispute?.counterEvidencePhotos)
                            ? order.dispute.counterEvidencePhotos.join("\n")
                            : ""
                        );
                        setShowCounterEvidenceModal(true);
                      }}
                      leftIcon={<Scale className="w-3.5 h-3.5" />}
                    >
                      {order.dispute?.counterEvidenceReason
                        ? "Atualizar Contraprova"
                        : "Enviar Contraprova / Evidências"}
                    </Button>
                  )}

                  {canClientCancel && (
                    <Button
                      variant="outline"
                      size="md"
                      disabled={actionLoading}
                      onClick={() => setShowCancelModal(true)}
                      leftIcon={<Ban className="w-3.5 h-3.5" />}
                    >
                      Cancelar Solicitação
                    </Button>
                  )}

                  {canProviderPropose && (
                    <Button
                      variant="primary"
                      size="md"
                      onClick={() => setShowProposalModal(true)}
                      leftIcon={<Send className="w-3.5 h-3.5" />}
                    >
                      Enviar Orçamento Formalizado
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Avisos de Elegibilidade do Prestador */}
          {isProvider && isPreAcceptanceStage && !myProposal && !isVerifiedProvider && (
            <Alert
              variant="warning"
              title="Verificação documental obrigatória para enviar orçamentos"
              description="Somente prestadores com selo VERIFIED podem enviar propostas na plataforma Kuara."
              action={
                <Link
                  to="/dashboard/provider?tab=verification"
                  className={buttonVariants({ variant: "primary", size: "xs" })}
                >
                  Verificar Cadastro
                </Link>
              }
            />
          )}

          {isProvider && isPreAcceptanceStage && !myProposal && isVerifiedProvider && proposalCount >= 4 && (
            <Alert
              variant="neutral"
              title="Limite máximo de propostas atingido (4/4)"
              description="Este chamado já recebeu 4 orçamentos concorrentes conforme as regras da plataforma."
            />
          )}

          {/* Resumo da Proposta do Prestador Logado */}
          {isProvider && myProposal && (
            <Alert
              variant="info"
              title="Você já formalizou um orçamento para este chamado"
              description={
                <div className="space-y-1.5 mt-1">
                  <p className="tabular-nums">
                    Valor Total:{" "}
                    <strong>{formatBRL(myProposal.totalCents ?? 0)}</strong> (Mão de obra:{" "}
                    {formatBRL(myProposal.laborCostCents ?? 0)} + Materiais:{" "}
                    {formatBRL(myProposal.materialCostCents ?? 0)}) • Prazo:{" "}
                    {myProposal.estimatedDays} dia(s).
                  </p>
                  <div className="flex items-center gap-2">
                    <span>Status da proposta:</span>
                    <Badge
                      status={getProposalStatus(myProposal, order)}
                      size="xs"
                      label={
                        getProposalStatus(myProposal, order) === "ACCEPTED"
                          ? "Aceita"
                          : getProposalStatus(myProposal, order) === "REJECTED"
                          ? "Não Selecionada"
                          : "Em Análise"
                      }
                    />
                  </div>
                </div>
              }
              action={
                isPreAcceptanceStage &&
                getProposalStatus(myProposal, order) === "PENDING" ? (
                  <Button
                    variant="danger-outline"
                    size="xs"
                    loading={actionLoading}
                    onClick={() => handleWithdrawProposal(myProposal.id)}
                  >
                    Retirar Proposta
                  </Button>
                ) : undefined
              }
            />
          )}

          {/* Motivo do cancelamento, se aplicável */}
          {order.status === "CANCELLED" && order.cancelledReason && (
            <Alert
              variant="neutral"
              title="Solicitação Cancelada"
              description={`Motivo registrado: ${order.cancelledReason}`}
            />
          )}

          {/* Card de Disputa (quando existir) */}
          {order.dispute && (() => {
            const disputeParties = resolveDisputeParties(order.dispute, order);
            return (
              <Card>
                <CardHeader
                  actions={
                    <Badge
                      status={
                        order.dispute.status === "PENDING_REVIEW"
                          ? "IN_DISPUTE"
                          : order.dispute.status
                      }
                    />
                  }
                >
                  <div className="flex items-center gap-2">
                    <Scale className="w-4 h-4 text-[var(--kuara-danger-text)]" />
                    <CardTitle>Registro de Disputa Arbitral</CardTitle>
                  </div>
                  <CardDescription>
                    Aberta em {new Date(order.dispute.createdAt).toLocaleString("pt-BR")}
                    {disputeParties.opener && disputeParties.contested
                      ? ` • Contestação de ${disputeParties.opener.label} (${disputeParties.opener.name}) contra ${disputeParties.contested.label} (${disputeParties.contested.name})`
                      : ""}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-xs">
                  <div className="p-3 rounded-md border border-[var(--kuara-danger-border)] bg-[var(--kuara-danger-soft)]/50">
                    <span className="text-[11px] font-semibold text-[var(--kuara-danger-text)] block mb-1">
                      {disputeParties.opener
                        ? `Motivo da Contestação — ${disputeParties.opener.label} (${disputeParties.opener.name})`
                        : "Motivo da Contestação"}
                    </span>
                    <p className="text-[var(--kuara-fg)] leading-relaxed">{order.dispute.reason}</p>
                  </div>

                  <PhotoGallery
                    title="Evidências da Disputa"
                    urls={order.dispute.evidencePhotos}
                  />

                  {order.dispute.counterEvidenceReason && (
                    <div className="p-3 rounded-md border border-[var(--kuara-info-border)] bg-[var(--kuara-info-soft)]/50">
                      <span className="text-[11px] font-semibold text-[var(--kuara-info-text)] block mb-1">
                        {disputeParties.contested
                          ? `Contraprova / Defesa — ${disputeParties.contested.label} (${disputeParties.contested.name})`
                          : "Contraprova / Defesa Registrada"}
                      </span>
                      <p className="text-[var(--kuara-fg)] leading-relaxed">
                        {order.dispute.counterEvidenceReason}
                      </p>
                    </div>
                  )}

                  <PhotoGallery
                    title="Evidências da Contraprova"
                    urls={order.dispute.counterEvidencePhotos}
                  />

                {order.dispute.resolutionNotes && (
                  <Alert
                    variant={order.dispute.status === "RESOLVED" ? "success" : "neutral"}
                    title={`Parecer da Mediação Kuara${
                      order.dispute.decision ? ` (${order.dispute.decision})` : ""
                    }${
                      order.dispute.resolvedAt
                        ? ` em ${new Date(order.dispute.resolvedAt).toLocaleString("pt-BR")}`
                        : ""
                    }`}
                    description={
                      <div className="space-y-1">
                        <p>{order.dispute.resolutionNotes}</p>
                        {(order.dispute.providerReleaseCents !== null &&
                          order.dispute.providerReleaseCents !== undefined) ||
                        (order.dispute.clientRefundCents !== null &&
                          order.dispute.clientRefundCents !== undefined) ? (
                          <p className="text-[11px] tabular-nums font-medium">
                            Repasse ao Prestador:{" "}
                            {formatBRL(order.dispute.providerReleaseCents || 0)} • Estorno ao
                            Contratante: {formatBRL(order.dispute.clientRefundCents || 0)}
                          </p>
                        ) : null}
                      </div>
                    }
                  />
                )}
                </CardContent>
              </Card>
            );
          })()}

          {/* Seção de Orçamentos Recebidos (Pré-aceite) OU Contrato Digital Formalizado */}
          {isPreAcceptanceStage ? (
            <Card>
              <CardHeader>
                <CardTitle>
                  Orçamentos Recebidos ({proposalCount}/4)
                </CardTitle>
                <CardDescription>
                  Compare escopo, prazo e valores discriminados antes de confirmar o aceite.
                </CardDescription>
              </CardHeader>

              {!order.proposals || order.proposals.length === 0 ? (
                <EmptyState
                  compact
                  icon={<Clock className="w-4 h-4" />}
                  title={
                    proposalCount > 0
                      ? `${proposalCount} orçamento${proposalCount > 1 ? "s" : ""} concorrente${proposalCount > 1 ? "s" : ""} em análise`
                      : "Nenhum orçamento recebido ainda"
                  }
                  description={
                    proposalCount > 0
                      ? proposalCount >= 4
                        ? "Este chamado atingiu o limite máximo de 4 orçamentos."
                        : "Por privacidade comercial, propostas de outros prestadores permanecem confidenciais até o envio do seu orçamento."
                      : "Profissionais verificados da região podem enviar propostas sem custo por lead."
                  }
                />
              ) : (
                <div className="divide-y divide-[var(--kuara-border)]">
                  {order.proposals.map((prop: any) => {
                    const propStatus = getProposalStatus(prop, order);
                    const totalCents = prop.totalCents ?? 0;
                    const ratingAvg = prop.provider?.providerProfile?.ratingAverage;
                    const ratingCnt = prop.provider?.providerProfile?.ratingCount;

                    return (
                      <div
                        key={prop.id}
                        className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs"
                      >
                        <div className="space-y-1.5 min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm text-[var(--kuara-fg)]">
                              {prop.provider?.name || "Profissional Verificado"}
                            </span>
                            <Badge
                              status={propStatus}
                              size="xs"
                              label={
                                propStatus === "ACCEPTED"
                                  ? "Aceita"
                                  : propStatus === "REJECTED"
                                  ? "Não Selecionada"
                                  : "Em Análise"
                              }
                            />
                            <span className="inline-flex items-center gap-0.5 text-[var(--kuara-warning-text)] font-medium tabular-nums">
                              <Star className="w-3.5 h-3.5 fill-current" />
                              {typeof ratingAvg === "number" ? ratingAvg.toFixed(1) : "Novo"}
                              {typeof ratingCnt === "number" && ratingCnt > 0 && (
                                <span className="text-[var(--kuara-fg-subtle)] font-normal ml-0.5">
                                  ({ratingCnt})
                                </span>
                              )}
                            </span>
                          </div>

                          <p className="text-[var(--kuara-fg-muted)] leading-relaxed">
                            {prop.description}
                          </p>

                          <div className="flex flex-wrap items-center gap-3 text-[11px] text-[var(--kuara-fg-subtle)] tabular-nums">
                            <span>Mão de obra: {formatBRL(prop.laborCostCents ?? 0)}</span>
                            <span>
                              Materiais:{" "}
                              {(prop.materialCostCents ?? 0) > 0
                                ? `${formatBRL(prop.materialCostCents)} (adiantamento imediato)`
                                : "Fornecidos pelo cliente"}
                            </span>
                            <span>Prazo: {prop.estimatedDays} dia(s)</span>
                          </div>
                          {prop.materialsList && (
                            <p className="text-[11px] text-[var(--kuara-fg-subtle)]">
                              <strong className="text-[var(--kuara-fg-muted)]">Insumos:</strong>{" "}
                              {prop.materialsList}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <span className="text-[11px] text-[var(--kuara-fg-subtle)] block">
                              Total
                            </span>
                            <span className="font-bold text-sm text-[var(--kuara-fg)] tabular-nums">
                              {formatBRL(totalCents)}
                            </span>
                          </div>

                          {isClient && (
                            <Button
                              variant="primary"
                              size="sm"
                              disabled={actionLoading}
                              onClick={() => handleAcceptProposal(prop.id)}
                            >
                              Aceitar
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          ) : acceptedProposal ? (
            <Card>
              <CardHeader actions={<Badge status="ACCEPTED" label="Contrato Formalizado" />}>
                <CardTitle>Termos do Contrato Digital</CardTitle>
                <CardDescription>
                  Escopo, prazo e condições combinadas registrados para segurança dos dois lados.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-3 text-xs">
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <div className="p-2.5 rounded-md border border-[var(--kuara-border)] bg-[var(--kuara-surface-muted)]">
                    <span className="text-[11px] text-[var(--kuara-fg-subtle)] block">
                      Profissional
                    </span>
                    <p className="font-semibold text-[var(--kuara-fg)] truncate mt-0.5">
                      {acceptedProposal.provider?.name || "—"}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-md border border-[var(--kuara-border)] bg-[var(--kuara-surface-muted)]">
                    <span className="text-[11px] text-[var(--kuara-fg-subtle)] block">
                      Mão de Obra
                    </span>
                    <p className="font-semibold text-[var(--kuara-fg)] tabular-nums mt-0.5">
                      {formatBRL(acceptedProposal.laborCostCents ?? 0)}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-md border border-[var(--kuara-border)] bg-[var(--kuara-surface-muted)]">
                    <span className="text-[11px] text-[var(--kuara-fg-subtle)] block">
                      Materiais
                    </span>
                    <p className="font-semibold text-[var(--kuara-fg)] tabular-nums mt-0.5">
                      {formatBRL(acceptedProposal.materialCostCents ?? 0)}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-md border border-[var(--kuara-border)] bg-[var(--kuara-surface-muted)]">
                    <span className="text-[11px] text-[var(--kuara-fg-subtle)] block">
                      Valor Total
                    </span>
                    <p className="font-bold text-[var(--kuara-fg)] tabular-nums mt-0.5">
                      {formatBRL(acceptedProposal.totalCents ?? 0)}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-md border border-[var(--kuara-border)] bg-[var(--kuara-surface-muted)]">
                    <span className="text-[11px] text-[var(--kuara-fg-subtle)] block">
                      Prazo
                    </span>
                    <p className="font-semibold text-[var(--kuara-fg)] tabular-nums mt-0.5">
                      {acceptedProposal.estimatedDays} dia(s)
                    </p>
                  </div>
                </div>

                {acceptedProposal.description && (
                  <p className="text-[var(--kuara-fg-muted)] leading-relaxed">
                    <strong className="text-[var(--kuara-fg)]">Escopo acordado:</strong>{" "}
                    {acceptedProposal.description}
                  </p>
                )}

                {acceptedProposal.materialsList && (
                  <p className="text-[var(--kuara-fg-muted)] leading-relaxed">
                    <strong className="text-[var(--kuara-fg)]">Lista de materiais:</strong>{" "}
                    {acceptedProposal.materialsList}
                  </p>
                )}

                {(acceptedProposal.materialCostCents ?? 0) > 0 && (
                  <Alert
                    variant="info"
                    compact
                    description={`Os ${formatBRL(
                      acceptedProposal.materialCostCents
                    )} de materiais são liberados ao profissional logo após a confirmação do pagamento para compra imediata, mantendo apenas a mão de obra (${formatBRL(
                      acceptedProposal.laborCostCents ?? 0
                    )}) retida em custódia até a entrega.`}
                  />
                )}
              </CardContent>
            </Card>
          ) : null}

          {/* Avaliações Mútuas (exibição + formulário apenas para CLIENT / ACCEPTED PROVIDER) */}
          {order.status === "FINISHED" && (
            <Card>
              <CardHeader>
                <CardTitle>Avaliações Mútuas do Serviço</CardTitle>
                <CardDescription>
                  Reputação registrada após conclusão e liberação da custódia.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-5 text-xs">
                {/* Lista de Avaliações Existentes */}
                {order.reviews && order.reviews.length > 0 ? (
                  <div className="space-y-3">
                    {order.reviews.map((rev: any) => {
                      const isAuthorClient = rev.authorId === order.clientId;
                      const authorLabel =
                        rev.author?.name ||
                        (isAuthorClient ? order.client?.name : acceptedProposal?.provider?.name) ||
                        "Participante";
                      const roleLabel = isAuthorClient ? "Contratante" : "Prestador";

                      return (
                        <div
                          key={rev.id}
                          className="p-3.5 rounded-md border border-[var(--kuara-border)] bg-[var(--kuara-surface-muted)]/60 space-y-2"
                        >
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-[var(--kuara-fg)]">
                                {authorLabel}
                              </span>
                              <Tag>{roleLabel}</Tag>
                            </div>
                            <div className="flex items-center gap-0.5 text-amber-500">
                              {[1, 2, 3, 4, 5].map((starVal) => (
                                <Star
                                  key={starVal}
                                  className={`w-3.5 h-3.5 ${
                                    starVal <= rev.rating
                                      ? "fill-current"
                                      : "text-[var(--kuara-border-strong)]"
                                  }`}
                                />
                              ))}
                              <span className="ml-1 font-semibold text-[var(--kuara-fg)] tabular-nums">
                                {rev.rating}/5
                              </span>
                            </div>
                          </div>

                          {Array.isArray(rev.tags) && rev.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {rev.tags.map((t: string) => (
                                <Tag key={t} tone="amber">
                                  {t}
                                </Tag>
                              ))}
                            </div>
                          )}

                          {rev.comment && (
                            <p className="text-[var(--kuara-fg-muted)] leading-relaxed">
                              "{rev.comment}"
                            </p>
                          )}

                          <span className="block text-[10px] text-[var(--kuara-fg-subtle)]">
                            Publicada em {new Date(rev.createdAt).toLocaleString("pt-BR")}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-[var(--kuara-fg-muted)]">
                    Nenhuma avaliação publicada para este serviço ainda.
                  </p>
                )}

                {alreadyReviewed && (
                  <Alert
                    variant="success"
                    compact
                    description="Você já enviou sua avaliação para este serviço."
                  />
                )}

                {canSubmitReview && (
                  <>
                    <Divider />
                    <form onSubmit={handleSubmitReview} className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="block font-medium text-[var(--kuara-fg)]">
                          {isClient
                            ? "Sua nota para o Prestador (1 a 5 estrelas)"
                            : "Sua nota para o Contratante (1 a 5 estrelas)"}
                        </label>
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((val) => (
                            <button
                              key={val}
                              type="button"
                              onClick={() => setRating(val)}
                              className={`p-1.5 rounded-md transition-colors ${
                                rating >= val
                                  ? "text-amber-500"
                                  : "text-[var(--kuara-border-strong)] hover:text-amber-400"
                              }`}
                              aria-label={`Nota ${val} estrela(s)`}
                            >
                              <Star className="w-5 h-5 fill-current" />
                            </button>
                          ))}
                          <span className="ml-2 text-xs font-medium text-[var(--kuara-fg-muted)] tabular-nums">
                            {rating} de 5
                          </span>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="block font-medium text-[var(--kuara-fg)]">
                          Destaques (selecione um ou mais)
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                          {availableReviewTags.map((tag) => {
                            const active = selectedTags.includes(tag);
                            return (
                              <button
                                key={tag}
                                type="button"
                                onClick={() => handleToggleTag(tag)}
                                className={`h-7 px-2.5 rounded-md border text-xs font-medium transition-colors ${
                                  active
                                    ? "bg-[var(--kuara-primary)] text-[var(--kuara-primary-fg)] border-transparent"
                                    : "bg-[var(--kuara-surface)] text-[var(--kuara-fg-muted)] border-[var(--kuara-border)] hover:border-[var(--kuara-border-strong)]"
                                }`}
                              >
                                {tag}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <Textarea
                        label="Comentário Público (opcional)"
                        rows={3}
                        maxLength={500}
                        value={reviewComment}
                        onChange={(e) => setReviewComment(e.target.value)}
                        placeholder={
                          isClient
                            ? "Compartilhe como foi a execução, pontualidade e qualidade do serviço..."
                            : "Compartilhe como foi a clareza do escopo e o recebimento..."
                        }
                      />

                      <div className="flex justify-end">
                        <Button type="submit" variant="primary" size="md" loading={actionLoading}>
                          Publicar Avaliação
                        </Button>
                      </div>
                    </form>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* COLUNA DIREITA (4/12): SAFECHAT FIXO */}
        <Card className="lg:col-span-4 flex flex-col h-[580px] overflow-hidden sticky top-16">
          <div className="px-4 py-3 border-b border-[var(--kuara-border)] flex items-center justify-between gap-2 shrink-0">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-[var(--kuara-primary)] shrink-0" />
                <h3 className="text-xs font-semibold text-[var(--kuara-fg)] truncate">
                  SafeChat Kuara
                </h3>
              </div>
              <span className="text-[10px] text-[var(--kuara-fg-subtle)] block">
                Canal auditável anti-desintermediação
              </span>
            </div>

            {isEscrowFunded ? (
              <Tag tone="emerald" icon={<Unlock className="w-3 h-3" />}>
                Contatos liberados
              </Tag>
            ) : (
              <Tag tone="amber" icon={<Lock className="w-3 h-3" />}>
                Pré-custódia
              </Tag>
            )}
          </div>

          {!isEscrowFunded && (
            <div className="px-3.5 py-2 bg-[var(--kuara-warning-soft)] text-[var(--kuara-warning-text)] text-[11px] border-b border-[var(--kuara-warning-border)] shrink-0">
              Telefones, chaves Pix, e-mails e links externos são bloqueados até a confirmação da custódia.
            </div>
          )}

          {/* Seletor de conversa por proposta durante pré-aceite (quando cliente tem > 1 proposta) */}
          {isClient && isPreAcceptanceStage && order.proposals && order.proposals.length > 0 && (
            <div className="px-3.5 py-2 border-b border-[var(--kuara-border)] bg-[var(--kuara-surface-muted)]/60 shrink-0">
              <label className="block text-[10px] font-medium text-[var(--kuara-fg-muted)] mb-1">
                Conversando com o prestador:
              </label>
              <select
                value={selectedChatProposalId}
                onChange={(e) => setSelectedChatProposalId(e.target.value)}
                className="w-full h-7 px-2 rounded border border-[var(--kuara-border)] bg-[var(--kuara-surface)] text-xs text-[var(--kuara-fg)] focus:outline-none focus:ring-2 focus:ring-[var(--kuara-ring)]"
              >
                {order.proposals.map((prop: any) => (
                  <option key={prop.id} value={prop.id}>
                    {prop.provider?.name || "Prestador"} — {formatBRL(prop.totalCents ?? 0)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Lista de mensagens com scroll independente */}
          <div className="flex-1 p-3.5 space-y-2.5 overflow-y-auto">
            {!hasChatAccess ? (
              <EmptyState
                compact
                icon={<Lock className="w-4 h-4" />}
                title={
                  isProvider && isPreAcceptanceStage && !myProposal
                    ? "Envie um orçamento para conversar"
                    : "Canal privado restrito às partes do contrato"
                }
                description={
                  isProvider && isPreAcceptanceStage && !myProposal
                    ? "Formalize sua proposta no botão de ação ao lado para iniciar o alinhamento direto com o contratante."
                    : "Apenas o contratante, o prestador contratado e o mediador Kuara têm acesso a esta conversa."
                }
              />
            ) : messages.length === 0 ? (
              <EmptyState
                compact
                icon={<MessageSquare className="w-4 h-4" />}
                title="Nenhuma mensagem trocada ainda"
                description="Use este canal protegido para tirar dúvidas sobre escopo, prazos ou agendamento."
              />
            ) : (
              messages.map((m) => {
                const isMe = m.senderId === user?.id;
                const isMod = m.sender?.role === "ADMIN";
                return (
                  <div
                    key={m.id}
                    className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                  >
                    <div className="flex items-center gap-1.5 text-[10px] text-[var(--kuara-fg-subtle)] mb-0.5">
                      <span className="font-medium text-[var(--kuara-fg-muted)]">
                        {m.sender?.name}
                        {isMod ? " (Mediador)" : ""}
                      </span>
                      <span className="tabular-nums">
                        {new Date(m.createdAt).toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <div
                      className={`px-3 py-2 rounded-lg text-xs max-w-[85%] leading-relaxed break-words ${
                        isMe
                          ? "bg-[var(--kuara-primary)] text-[var(--kuara-primary-fg)]"
                          : isMod
                          ? "bg-[var(--kuara-violet-soft)] text-[var(--kuara-violet-text)] border border-[var(--kuara-violet-border)]"
                          : "bg-[var(--kuara-surface-muted)] text-[var(--kuara-fg)] border border-[var(--kuara-border)]"
                      }`}
                    >
                      {m.content}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Input de Envio */}
          <form
            onSubmit={handleSendMessage}
            className="p-2.5 border-t border-[var(--kuara-border)] bg-[var(--kuara-surface)] flex items-center gap-2 shrink-0"
          >
            <input
              type="text"
              disabled={!canSendChat}
              placeholder={
                order.status === "CANCELLED"
                  ? "Chat encerrado (pedido cancelado)"
                  : isClient && isPreAcceptanceStage && proposalCount === 0
                  ? "Aguardando propostas para conversar..."
                  : !hasChatAccess
                  ? "Chat indisponível"
                  : "Digite sua mensagem..."
              }
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              className="flex-1 h-8 text-xs px-3 border border-[var(--kuara-border)] rounded-md bg-[var(--kuara-surface)] text-[var(--kuara-fg)] placeholder:text-[var(--kuara-fg-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--kuara-ring)] disabled:opacity-50"
            />
            <Button
              type="submit"
              variant="primary"
              size="md"
              iconOnly
              disabled={!canSendChat || !newMessage.trim()}
              aria-label="Enviar mensagem"
            >
              <Send className="w-3.5 h-3.5" />
            </Button>
          </form>
        </Card>
      </div>

      {/* Modal Enviar Orçamento pelo Prestador */}
      <Modal
        isOpen={showProposalModal}
        onClose={() => setShowProposalModal(false)}
        title="Enviar Orçamento Formalizado"
        subtitle={order.title}
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
              value={effectiveModalPolicy}
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
              hint={modalMaterialCents > 0 ? "Liberado no pagamento" : "0 se cliente comprar"}
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
            label="Descrição do Escopo"
            rows={3}
            required
            minLength={10}
            placeholder="Descreva o que está incluso no serviço e garantia oferecida (mínimo 10 caracteres)..."
            value={proposalDesc}
            onChange={(e) => setProposalDesc(e.target.value)}
          />

          <div className="p-3.5 rounded-md border border-[var(--kuara-border)] bg-[var(--kuara-surface-muted)] space-y-1.5 text-xs">
            <div className="flex justify-between text-[var(--kuara-fg-muted)]">
              <span>Valor Total:</span>
              <span className="font-semibold text-[var(--kuara-fg)] tabular-nums">
                {formatBRL(modalTotalCents)}
              </span>
            </div>
            {modalMaterialCents > 0 && (
              <div className="flex justify-between text-[var(--kuara-success-text)]">
                <span>Adiantamento de materiais (liberado na hora, 0% taxa):</span>
                <span className="font-semibold tabular-nums">+ {formatBRL(modalMaterialCents)}</span>
              </div>
            )}
            <div className="flex justify-between text-[var(--kuara-fg-muted)]">
              <span>Taxa Kuara (5% sobre mão de obra):</span>
              <span className="text-[var(--kuara-warning-text)] tabular-nums">
                - {formatBRL(modalFeeCents)}
              </span>
            </div>
            <Divider />
            <div className="flex justify-between font-bold text-[var(--kuara-fg)] pt-0.5">
              <span>Mão de obra líquida retida (após entrega):</span>
              <span className="text-[var(--kuara-success-text)] tabular-nums">
                {formatBRL(modalNetCents)}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--kuara-border)]">
            <Button
              variant="ghost"
              size="md"
              onClick={() => setShowProposalModal(false)}
              disabled={actionLoading}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="primary" size="md" loading={actionLoading}>
              {actionLoading ? "Enviando..." : "Formalizar Orçamento"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal Concluir Serviço (com URLs opcionais de fotos de entrega) */}
      <Modal
        isOpen={showCompleteModal}
        onClose={() => setShowCompleteModal(false)}
        title="Sinalizar Serviço Finalizado"
        subtitle="Inicia o prazo de inspeção de 72 horas do contratante"
        icon={<CheckCircle2 className="w-4 h-4 text-[var(--kuara-success-text)]" />}
        size="md"
      >
        <form onSubmit={handleCompleteService} className="space-y-4">
          <Alert
            variant="info"
            compact
            description="Anexe links das fotos do serviço pronto para agilizar a aprovação do contratante e proteger você em caso de contestação."
          />

          <Textarea
            label="URLs de Fotos da Entrega (opcional)"
            rows={3}
            value={completionPhotosText}
            onChange={(e) => setCompletionPhotosText(e.target.value)}
            placeholder="https://exemplo.com/servico-concluido-1.jpg&#10;https://exemplo.com/servico-concluido-2.jpg"
            hint="Separe múltiplas URLs por linha ou vírgula."
          />

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--kuara-border)]">
            <Button
              variant="ghost"
              size="md"
              onClick={() => setShowCompleteModal(false)}
              disabled={actionLoading}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="primary" size="md" loading={actionLoading}>
              Confirmar Conclusão
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal Abrir Disputa */}
      <Modal
        isOpen={showDisputeModal}
        onClose={() => setShowDisputeModal(false)}
        title="Abrir Disputa Arbitral"
        subtitle="O valor permanecerá retido em custódia durante a mediação Kuara"
        icon={<AlertTriangle className="w-4 h-4 text-[var(--kuara-danger-text)]" />}
        size="md"
      >
        <form onSubmit={handleOpenDispute} className="space-y-4">
          <Textarea
            label="Motivo da Contestação"
            required
            minLength={10}
            rows={4}
            value={disputeReason}
            onChange={(e) => setDisputeReason(e.target.value)}
            placeholder="Explique detalhadamente o problema encontrado ou divergência de escopo (mínimo 10 caracteres)..."
          />

          <Textarea
            label="URLs de Fotos / Evidências (opcional)"
            rows={2}
            value={disputePhotosText}
            onChange={(e) => setDisputePhotosText(e.target.value)}
            placeholder="https://exemplo.com/evidencia-1.jpg"
            hint="Separe múltiplas URLs por linha ou vírgula."
          />

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--kuara-border)]">
            <Button
              variant="ghost"
              size="md"
              onClick={() => setShowDisputeModal(false)}
              disabled={actionLoading}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="danger" size="md" loading={actionLoading}>
              Registrar Disputa
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal Contraprova / Evidências em Disputa */}
      <Modal
        isOpen={showCounterEvidenceModal}
        onClose={() => setShowCounterEvidenceModal(false)}
        title="Enviar Contraprova & Evidências"
        subtitle="Anexe esclarecimentos e fotos para avaliação do administrador mediador"
        icon={<Scale className="w-4 h-4 text-[var(--kuara-primary)]" />}
        size="md"
      >
        <form onSubmit={handleSubmitCounterEvidence} className="space-y-4">
          <Textarea
            label="Esclarecimento / Contraprova"
            required
            minLength={10}
            rows={4}
            value={counterReason}
            onChange={(e) => setCounterReason(e.target.value)}
            placeholder="Descreva os fatos e argumentos técnicos para a mediação (mínimo 10 caracteres)..."
          />

          <Textarea
            label="URLs de Fotos / Evidências (opcional)"
            rows={2}
            value={counterPhotosText}
            onChange={(e) => setCounterPhotosText(e.target.value)}
            placeholder="https://exemplo.com/contraprova-1.jpg"
            hint="Informe URLs válidas separadas por linha ou vírgula."
          />

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--kuara-border)]">
            <Button
              variant="ghost"
              size="md"
              onClick={() => setShowCounterEvidenceModal(false)}
              disabled={actionLoading}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="primary" size="md" loading={actionLoading}>
              Enviar Contraprova
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal Cancelar Solicitação */}
      <Modal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        title="Cancelar Solicitação de Serviço"
        subtitle={
          isEscrowFunded
            ? "O valor em custódia será estornado conforme política pré-execução"
            : "A solicitação será encerrada e não receberá novos orçamentos"
        }
        icon={<Ban className="w-4 h-4 text-[var(--kuara-danger-text)]" />}
        size="md"
      >
        <form onSubmit={handleCancelOrder} className="space-y-4">
          <Alert
            variant="warning"
            compact
            description={
              isEscrowFunded
                ? (order.escrow?.materialsAmountCents ?? 0) > 0 && order.escrow?.materialsReleasedAt
                  ? `A mão de obra retida em custódia (${formatBRL(
                      order.escrow.laborAmountCents ?? 0
                    )}) será estornada automaticamente. O adiantamento de materiais já liberado (${formatBRL(
                      order.escrow.materialsAmountCents
                    )}) não integra o estorno automático.`
                  : "Ao cancelar antes da conclusão, a custódia retida é estornada ao contratante."
                : "Esta ação não pode ser desfeita."
            }
          />

          <Textarea
            label="Motivo do Cancelamento (opcional)"
            rows={3}
            maxLength={500}
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Informe brevemente o motivo do cancelamento (mín. 3 caracteres, se preenchido)..."
            hint={`${cancelReason.trim().length}/500 caracteres`}
          />

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--kuara-border)]">
            <Button
              variant="ghost"
              size="md"
              onClick={() => setShowCancelModal(false)}
              disabled={actionLoading}
            >
              Voltar
            </Button>
            <Button type="submit" variant="danger" size="md" loading={actionLoading}>
              Confirmar Cancelamento
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal Anexar Nota / Comprovante de Materiais */}
      <Modal
        isOpen={showMaterialProofModal}
        onClose={() => setShowMaterialProofModal(false)}
        title="Comprovantes de Compra dos Materiais"
        subtitle="Compartilhe a nota fiscal ou foto dos materiais adquiridos"
        icon={<Camera className="w-4 h-4 text-[var(--kuara-primary)]" />}
        size="md"
      >
        <form onSubmit={handleSubmitMaterialProof} className="space-y-4">
          <Textarea
            label="URLs da Nota Fiscal / Fotos dos Materiais"
            required
            rows={3}
            value={materialProofText}
            onChange={(e) => setMaterialProofText(e.target.value)}
            placeholder="https://exemplo.com/nota-fiscal-materiais.jpg"
            hint="Informe uma ou mais URLs válidas separadas por linha ou vírgula."
          />

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--kuara-border)]">
            <Button
              variant="ghost"
              size="md"
              onClick={() => setShowMaterialProofModal(false)}
              disabled={actionLoading}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="primary" size="md" loading={actionLoading}>
              Salvar Comprovantes
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal Pix / Cartão */}
      <PixModal
        isOpen={showPixModal}
        onClose={() => setShowPixModal(false)}
        onConfirmPayment={handleConfirmPixPayment}
        amountCents={proposalAmountForPix}
        laborAmountCents={order.escrow?.laborAmountCents ?? acceptedProposal?.laborCostCents}
        materialAmountCents={
          order.escrow?.materialsAmountCents ?? acceptedProposal?.materialCostCents ?? 0
        }
        loading={actionLoading}
      />
    </AppLayout>
  );
};
