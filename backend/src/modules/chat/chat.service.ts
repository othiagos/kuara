import { prisma } from "../../shared/database";
import { AppError } from "../../shared/errors";
import { Role, ServiceStatus } from "@prisma/client";
import { sanitizeMessageContent } from "./chat.sanitizer";
import { isEscrowSecuredStatus } from "../../shared/presenters";

export interface SendMessageOptions {
  proposalId?: string;
  recipientId?: string;
}

export class ChatService {
  async sendMessage(
    senderId: string,
    senderRole: Role,
    serviceOrderId: string,
    content: string,
    options?: SendMessageOptions
  ) {
    const order = await prisma.serviceOrder.findUnique({
      where: { id: serviceOrderId },
      include: { escrow: true, proposals: true, acceptedProposal: true },
    });
    if (!order) throw new AppError("Ordem de serviço não encontrada", 404);

    const isAdmin = senderRole === Role.ADMIN;
    const isClient = order.clientId === senderId;
    const isAcceptedProvider = order.acceptedProposal?.providerId === senderId;
    const myProposal = order.proposals.find((p) => p.providerId === senderId);

    if (order.acceptedProposalId) {
      if (!isClient && !isAcceptedProvider && !isAdmin) {
        throw new AppError("Você não tem permissão para enviar mensagens neste serviço", 403);
      }
    } else if (!isClient && !myProposal && !isAdmin) {
      throw new AppError("Você não tem permissão para enviar mensagens neste serviço", 403);
    }

    if (order.status === ServiceStatus.CANCELLED) {
      throw new AppError("Não é possível enviar mensagens em um serviço cancelado", 400);
    }

    let targetProposalId: string | null = null;
    let recipientId: string | null = null;

    if (order.acceptedProposalId && order.acceptedProposal) {
      targetProposalId = order.acceptedProposalId;
      recipientId = isClient
        ? order.acceptedProposal.providerId
        : isAcceptedProvider
        ? order.clientId
        : null;
    } else if (myProposal) {
      targetProposalId = myProposal.id;
      recipientId = order.clientId;
    } else if (isClient) {
      if (options?.proposalId) {
        const target = order.proposals.find((p) => p.id === options.proposalId);
        if (!target) {
          throw new AppError("Proposta informada não pertence a esta solicitação", 400);
        }
        targetProposalId = target.id;
        recipientId = target.providerId;
      } else if (options?.recipientId) {
        const target = order.proposals.find((p) => p.providerId === options.recipientId);
        if (!target) {
          throw new AppError("Destinatário informado não enviou proposta nesta solicitação", 400);
        }
        targetProposalId = target.id;
        recipientId = target.providerId;
      } else if (order.proposals.length === 1) {
        targetProposalId = order.proposals[0].id;
        recipientId = order.proposals[0].providerId;
      } else if (order.proposals.length > 1) {
        throw new AppError(
          "Selecione a proposta ou prestador destinatário para enviar a mensagem",
          400
        );
      } else {
        throw new AppError("Aguarde o envio de uma proposta para iniciar o chat", 400);
      }
    } else if (isAdmin) {
      if (options?.proposalId) {
        const target = order.proposals.find((p) => p.id === options.proposalId);
        if (!target) {
          throw new AppError("Proposta informada não pertence a esta solicitação", 400);
        }
        targetProposalId = target.id;
        recipientId = target.providerId;
      }
    }

    const isEscrowSecured = isEscrowSecuredStatus(order.escrow?.status);

    let finalContent = content;
    if (!isEscrowSecured && !isAdmin) {
      const { sanitized } = sanitizeMessageContent(content);
      finalContent = sanitized;
    }

    return prisma.message.create({
      data: {
        serviceOrderId,
        proposalId: targetProposalId,
        senderId,
        recipientId,
        content: finalContent,
      },
      include: { sender: { select: { id: true, name: true, role: true } } },
    });
  }

  async listMessages(
    userId: string,
    userRole: Role,
    serviceOrderId: string,
    proposalIdFilter?: string
  ) {
    const order = await prisma.serviceOrder.findUnique({
      where: { id: serviceOrderId },
      include: { proposals: true, acceptedProposal: true },
    });
    if (!order) throw new AppError("Ordem de serviço não encontrada", 404);

    const isAdmin = userRole === Role.ADMIN;
    const isClient = order.clientId === userId;
    const isAcceptedProvider = order.acceptedProposal?.providerId === userId;
    const myProposal = order.proposals.find((p) => p.providerId === userId);

    if (order.acceptedProposalId) {
      if (!isClient && !isAcceptedProvider && !isAdmin) {
        throw new AppError("Acesso não autorizado às mensagens", 403);
      }

      if (proposalIdFilter && isAdmin) {
        const exists = order.proposals.some((p) => p.id === proposalIdFilter);
        if (!exists) {
          throw new AppError("Proposta informada não pertence a esta solicitação", 400);
        }
        return prisma.message.findMany({
          where: { serviceOrderId, OR: [{ proposalId: proposalIdFilter }, { proposalId: null }] },
          include: { sender: { select: { id: true, name: true, role: true } } },
          orderBy: { createdAt: "asc" },
        });
      }

      return prisma.message.findMany({
        where: {
          serviceOrderId,
          OR: [{ proposalId: order.acceptedProposalId }, { proposalId: null }],
        },
        include: { sender: { select: { id: true, name: true, role: true } } },
        orderBy: { createdAt: "asc" },
      });
    }

    if (!isClient && !myProposal && !isAdmin) {
      throw new AppError("Acesso não autorizado às mensagens", 403);
    }

    if (myProposal) {
      return prisma.message.findMany({
        where: { serviceOrderId, proposalId: myProposal.id },
        include: { sender: { select: { id: true, name: true, role: true } } },
        orderBy: { createdAt: "asc" },
      });
    }

    if (proposalIdFilter) {
      const exists = order.proposals.some((p) => p.id === proposalIdFilter);
      if (!exists) {
        throw new AppError("Proposta informada não pertence a esta solicitação", 400);
      }
      return prisma.message.findMany({
        where: { serviceOrderId, OR: [{ proposalId: proposalIdFilter }, { proposalId: null }] },
        include: { sender: { select: { id: true, name: true, role: true } } },
        orderBy: { createdAt: "asc" },
      });
    }

    return prisma.message.findMany({
      where: { serviceOrderId },
      include: { sender: { select: { id: true, name: true, role: true } } },
      orderBy: { createdAt: "asc" },
    });
  }
}
