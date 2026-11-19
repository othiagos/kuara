import { prisma } from "../../shared/database";
import { AppError } from "../../shared/errors";
import { MaterialPolicy, ProposalStatus, ProviderStatus, Role, ServiceStatus } from "@prisma/client";
import {
  isEscrowSecuredStatus,
  SAFE_PROVIDER_PROFILE_SELECT,
  sanitizeProposal,
  ViewerContext,
} from "../../shared/presenters";

export interface CreateProposalDTO {
  serviceOrderId: string;
  description: string;
  estimatedDays: number;
  laborCostCents: number;
  materialCostCents?: number;
  materialPolicy?: "CLIENT_SUPPLIES" | "PROVIDER_ADVANCE";
  materialsList?: string;
}

export class ProposalService {
  async create(providerId: string, data: CreateProposalDTO) {
    const profile = await prisma.providerProfile.findUnique({ where: { userId: providerId } });
    if (!profile || profile.status !== ProviderStatus.VERIFIED) {
      throw new AppError("Apenas prestadores com perfil VERIFICADO podem enviar propostas", 403);
    }

    const materialCostCents = data.materialCostCents || 0;
    let materialPolicy: MaterialPolicy;
    if (data.materialPolicy) {
      materialPolicy = data.materialPolicy as MaterialPolicy;
    } else {
      materialPolicy =
        materialCostCents > 0 ? MaterialPolicy.PROVIDER_ADVANCE : MaterialPolicy.CLIENT_SUPPLIES;
    }

    if (materialPolicy === MaterialPolicy.CLIENT_SUPPLIES && materialCostCents > 0) {
      throw new AppError(
        "Quando o contratante fornece os materiais, o custo de materiais na proposta deve ser R$ 0,00.",
        400
      );
    }
    if (materialPolicy === MaterialPolicy.PROVIDER_ADVANCE && materialCostCents <= 0) {
      throw new AppError(
        "Informe o valor dos materiais ou selecione que o contratante fornecerá os insumos.",
        400
      );
    }

    const totalCents = data.laborCostCents + materialCostCents;
    if (totalCents < 500) {
      throw new AppError("Valor total simbólico ou zerado não é permitido", 400);
    }

    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "ServiceOrder" WHERE id = ${data.serviceOrderId} FOR UPDATE`;

      const order = await tx.serviceOrder.findUnique({
        where: { id: data.serviceOrderId },
        include: { proposals: true },
      });
      if (!order) {
        throw new AppError("Solicitação de serviço não encontrada", 404);
      }
      if (order.targetProviderId && order.targetProviderId !== providerId) {
        throw new AppError("Esta solicitação foi direcionada exclusivamente a outro prestador", 403);
      }
      if (order.status !== ServiceStatus.OPEN && order.status !== ServiceStatus.PROPOSALS_RECEIVED) {
        throw new AppError("Esta solicitação não está mais aceitando propostas", 400);
      }
      if (order.proposals.some((p) => p.providerId === providerId)) {
        throw new AppError("Você já enviou uma proposta para este serviço", 400);
      }
      if (order.proposals.length >= 4) {
        throw new AppError("Esta solicitação já atingiu o limite de 4 propostas concorrentes", 400);
      }

      const proposal = await tx.proposal.create({
        data: {
          serviceOrderId: data.serviceOrderId,
          providerId,
          description: data.description,
          estimatedDays: data.estimatedDays,
          laborCostCents: data.laborCostCents,
          materialCostCents,
          materialPolicy,
          materialsList: data.materialsList || null,
          totalCents,
          status: ProposalStatus.PENDING,
          isAccepted: false,
        },
      });

      const updatedOrder = await tx.serviceOrder.updateMany({
        where: {
          id: data.serviceOrderId,
          status: { in: [ServiceStatus.OPEN, ServiceStatus.PROPOSALS_RECEIVED] },
        },
        data: { status: ServiceStatus.PROPOSALS_RECEIVED },
      });
      if (updatedOrder.count === 0) {
        throw new AppError("Esta solicitação não está mais aceitando propostas", 400);
      }

      return proposal;
    });
  }

  async listByOrder(serviceOrderId: string, viewer: ViewerContext) {
    const order = await prisma.serviceOrder.findUnique({
      where: { id: serviceOrderId },
      include: {
        escrow: true,
        proposals: {
          include: {
            provider: {
              select: {
                id: true,
                name: true,
                phone: true,
                email: true,
                providerProfile: { select: SAFE_PROVIDER_PROFILE_SELECT },
              },
            },
          },
          orderBy: { totalCents: "asc" },
        },
      },
    });

    if (!order) {
      throw new AppError("Solicitação de serviço não encontrada", 404);
    }

    const isAdmin = viewer.role === Role.ADMIN;
    const isClient = order.clientId === viewer.id;
    const ownProposals = order.proposals.filter((p) => p.providerId === viewer.id);

    if (!isAdmin && !isClient) {
      if (viewer.role !== Role.PROVIDER || ownProposals.length === 0) {
        throw new AppError("Você não tem permissão para listar propostas deste serviço", 403);
      }
    }

    const secured = isEscrowSecuredStatus(order.escrow?.status);
    const list = isAdmin || isClient ? order.proposals : ownProposals;

    return list.map((p) => {
      const allowContact = isAdmin || (isClient && secured && p.id === order.acceptedProposalId);
      return sanitizeProposal(p, allowContact, order.acceptedProposalId);
    });
  }

  async acceptProposal(clientId: string, proposalId: string) {
    return prisma.$transaction(async (tx) => {
      const proposal = await tx.proposal.findUnique({
        where: { id: proposalId },
        include: {
          serviceOrder: true,
          provider: { include: { providerProfile: true } },
        },
      });
      if (!proposal) {
        throw new AppError("Proposta não encontrada", 404);
      }

      await tx.$queryRaw`SELECT id FROM "ServiceOrder" WHERE id = ${proposal.serviceOrderId} FOR UPDATE`;

      const order = await tx.serviceOrder.findUnique({
        where: { id: proposal.serviceOrderId },
      });
      if (!order) {
        throw new AppError("Solicitação de serviço não encontrada", 404);
      }
      if (order.clientId !== clientId) {
        throw new AppError("Apenas o contratante do serviço pode aceitar a proposta", 403);
      }
      if (
        order.status !== ServiceStatus.PROPOSALS_RECEIVED &&
        order.status !== ServiceStatus.OPEN
      ) {
        throw new AppError("O serviço não está em fase de escolha de proposta", 400);
      }
      if (proposal.provider.providerProfile?.status !== ProviderStatus.VERIFIED) {
        throw new AppError(
          "Não é possível aceitar esta proposta pois o prestador não está com verificação ativa",
          400
        );
      }

      const updatedOrder = await tx.serviceOrder.updateMany({
        where: {
          id: proposal.serviceOrderId,
          status: { in: [ServiceStatus.OPEN, ServiceStatus.PROPOSALS_RECEIVED] },
          acceptedProposalId: null,
        },
        data: {
          acceptedProposalId: proposalId,
          status: ServiceStatus.ESCROW_PENDING,
        },
      });
      if (updatedOrder.count === 0) {
        throw new AppError("O serviço não está em fase de escolha de proposta", 400);
      }

      await tx.proposal.update({
        where: { id: proposalId },
        data: { isAccepted: true, status: ProposalStatus.ACCEPTED },
      });

      await tx.proposal.updateMany({
        where: {
          serviceOrderId: proposal.serviceOrderId,
          id: { not: proposalId },
        },
        data: { isAccepted: false, status: ProposalStatus.REJECTED },
      });

      return { message: "Proposta aceita! Prossiga para o pagamento em custódia." };
    });
  }

  async withdrawProposal(providerId: string, proposalId: string) {
    return prisma.$transaction(async (tx) => {
      const proposal = await tx.proposal.findUnique({
        where: { id: proposalId },
        include: { serviceOrder: true },
      });
      if (!proposal) {
        throw new AppError("Proposta não encontrada", 404);
      }
      if (proposal.providerId !== providerId) {
        throw new AppError("Você não tem permissão para retirar esta proposta", 403);
      }

      await tx.$queryRaw`SELECT id FROM "ServiceOrder" WHERE id = ${proposal.serviceOrderId} FOR UPDATE`;

      const order = await tx.serviceOrder.findUnique({
        where: { id: proposal.serviceOrderId },
      });
      if (
        !order ||
        (order.status !== ServiceStatus.OPEN && order.status !== ServiceStatus.PROPOSALS_RECEIVED) ||
        proposal.isAccepted ||
        proposal.status !== ProposalStatus.PENDING
      ) {
        throw new AppError("Esta proposta não pode mais ser retirada", 400);
      }

      await tx.proposal.delete({ where: { id: proposalId } });

      const remaining = await tx.proposal.count({
        where: { serviceOrderId: proposal.serviceOrderId },
      });
      if (remaining === 0) {
        await tx.serviceOrder.update({
          where: { id: proposal.serviceOrderId },
          data: { status: ServiceStatus.OPEN },
        });
      }

      return { message: "Proposta retirada com sucesso" };
    });
  }
}
