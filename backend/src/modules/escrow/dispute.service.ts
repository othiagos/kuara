import { prisma } from "../../shared/database";
import { AppError } from "../../shared/errors";
import { ENV } from "../../config/env";
import { EscrowStatus, ServiceStatus } from "@prisma/client";
import { calculateNetAmount, calculatePlatformFee, getHeldCustodyCents } from "./escrow.rules";

export type DisputeDecision =
  | "RELEASE_TO_PROVIDER"
  | "REFUND_TO_CLIENT"
  | "SPLIT"
  | "REWORK";

export interface ResolveDisputeOptions {
  providerSharePercent?: number;
  providerAmountCents?: number;
}

export class DisputeService {
  async openDispute(
    userId: string,
    serviceOrderId: string,
    reason: string,
    photos?: string[]
  ) {
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "ServiceOrder" WHERE id = ${serviceOrderId} FOR UPDATE`;

      const order = await tx.serviceOrder.findUnique({
        where: { id: serviceOrderId },
        include: { acceptedProposal: true, escrow: true, dispute: true },
      });
      if (!order) throw new AppError("Ordem não encontrada", 404);

      const isClient = order.clientId === userId;
      const isAcceptedProvider = order.acceptedProposal?.providerId === userId;
      if (!isClient && !isAcceptedProvider) {
        throw new AppError("Acesso não autorizado para abrir disputa neste serviço", 403);
      }

      if (
        order.status !== ServiceStatus.IN_PROGRESS &&
        order.status !== ServiceStatus.COMPLETED_PENDING_APPROVAL
      ) {
        throw new AppError(
          "Disputas só podem ser abertas para serviços em andamento ou aguardando aprovação",
          400
        );
      }

      if (!order.escrow || order.escrow.status !== EscrowStatus.HELD) {
        throw new AppError("Não há valor retido em custódia elegível para disputa", 400);
      }

      if (order.dispute) {
        throw new AppError("Já existe uma disputa registrada para este serviço", 409);
      }

      const updatedOrder = await tx.serviceOrder.updateMany({
        where: {
          id: serviceOrderId,
          status: { in: [ServiceStatus.IN_PROGRESS, ServiceStatus.COMPLETED_PENDING_APPROVAL] },
        },
        data: { status: ServiceStatus.IN_DISPUTE },
      });
      const updatedEscrow = await tx.escrow.updateMany({
        where: { serviceOrderId, status: EscrowStatus.HELD },
        data: { status: EscrowStatus.DISPUTED },
      });
      if (updatedOrder.count === 0 || updatedEscrow.count === 0) {
        throw new AppError("Não foi possível registrar a disputa devido a alteração concorrente", 409);
      }

      return tx.dispute.create({
        data: {
          serviceOrderId,
          openedById: userId,
          reason,
          evidencePhotos: photos || [],
          status: "PENDING_REVIEW",
        },
      });
    });
  }

  async submitCounterEvidence(
    userId: string,
    disputeId: string,
    reason: string,
    photos?: string[]
  ) {
    const dispute = await prisma.dispute.findUnique({
      where: { id: disputeId },
      include: { serviceOrder: { include: { acceptedProposal: true } } },
    });
    if (!dispute) throw new AppError("Disputa não encontrada", 404);

    const isClient = dispute.serviceOrder.clientId === userId;
    const isAcceptedProvider = dispute.serviceOrder.acceptedProposal?.providerId === userId;
    if (!isClient && !isAcceptedProvider) {
      throw new AppError("Você não tem permissão para anexar evidências nesta disputa", 403);
    }

    if (dispute.openedById && dispute.openedById === userId) {
      throw new AppError(
        "A parte que abriu a contestação não pode enviar contraprova; aguarde a defesa da outra parte",
        403
      );
    }

    if (dispute.status === "RESOLVED") {
      throw new AppError("Não é possível anexar evidências após a resolução da disputa", 400);
    }

    return prisma.dispute.update({
      where: { id: disputeId },
      data: {
        counterEvidenceReason: reason,
        counterEvidencePhotos: photos || [],
      },
    });
  }

  async resolveDispute(
    disputeId: string,
    decision: DisputeDecision,
    notes: string,
    options?: ResolveDisputeOptions
  ) {
    return prisma.$transaction(async (tx) => {
      const dispute = await tx.dispute.findUnique({
        where: { id: disputeId },
        include: { serviceOrder: { include: { escrow: true } } },
      });
      if (!dispute) throw new AppError("Disputa não encontrada", 404);

      await tx.$queryRaw`SELECT id FROM "ServiceOrder" WHERE id = ${dispute.serviceOrderId} FOR UPDATE`;

      const freshDispute = await tx.dispute.findUnique({
        where: { id: disputeId },
        include: { serviceOrder: { include: { escrow: true } } },
      });
      if (!freshDispute) throw new AppError("Disputa não encontrada", 404);

      if (freshDispute.status === "RESOLVED") {
        throw new AppError("Esta disputa já foi resolvida anteriormente", 400);
      }

      const escrow = freshDispute.serviceOrder.escrow;
      if (
        !escrow ||
        escrow.status !== EscrowStatus.DISPUTED ||
        freshDispute.serviceOrder.status !== ServiceStatus.IN_DISPUTE
      ) {
        throw new AppError("O serviço ou custódia não está em estado válido de disputa", 400);
      }

      const now = new Date();
      const heldPool = getHeldCustodyCents(escrow);

      let nextEscrowStatus: EscrowStatus;
      let nextOrderStatus: ServiceStatus;
      let providerReleaseCents = 0;
      let clientRefundCents = 0;
      let nextFeeCents = escrow.feeAmountCents;
      let nextNetCents = escrow.netAmountCents;
      let nextRefundedCents = 0;
      let nextReleasedAt: Date | null = null;
      let clearCompletion = false;

      if (decision === "RELEASE_TO_PROVIDER") {
        nextEscrowStatus = EscrowStatus.RELEASED;
        nextOrderStatus = ServiceStatus.FINISHED;
        providerReleaseCents = heldPool;
        nextReleasedAt = now;
      } else if (decision === "REFUND_TO_CLIENT") {
        nextEscrowStatus = EscrowStatus.REFUNDED;
        nextOrderStatus = ServiceStatus.CANCELLED;
        clientRefundCents = heldPool;
        nextRefundedCents = heldPool;
        nextFeeCents = 0;
        nextNetCents = 0;
      } else if (decision === "REWORK") {
        nextEscrowStatus = EscrowStatus.HELD;
        nextOrderStatus = ServiceStatus.IN_PROGRESS;
        clearCompletion = true;
      } else {
        // SPLIT
        let providerGross: number;
        if (options?.providerAmountCents !== undefined) {
          providerGross = options.providerAmountCents;
        } else {
          const pct = options?.providerSharePercent ?? 50;
          providerGross = Math.round((heldPool * pct) / 100);
        }

        if (providerGross <= 0 || providerGross >= heldPool) {
          throw new AppError(
            "Para divisão parcial (SPLIT), o valor do prestador deve estar entre R$ 0,01 e o saldo retido menos R$ 0,01",
            400
          );
        }

        clientRefundCents = heldPool - providerGross;
        providerReleaseCents = providerGross;
        nextFeeCents = calculatePlatformFee(providerGross, ENV.PLATFORM_FEE_PERCENTAGE);
        nextNetCents = calculateNetAmount(providerGross, nextFeeCents);
        nextRefundedCents = clientRefundCents;
        nextEscrowStatus = EscrowStatus.RELEASED;
        nextOrderStatus = ServiceStatus.FINISHED;
        nextReleasedAt = now;
      }

      const updatedDispute = await tx.dispute.updateMany({
        where: { id: disputeId, status: "PENDING_REVIEW" },
        data: {
          status: "RESOLVED",
          decision,
          providerReleaseCents,
          clientRefundCents,
          resolutionNotes: notes,
          resolvedAt: now,
        },
      });
      if (updatedDispute.count === 0) {
        throw new AppError("Esta disputa já foi resolvida anteriormente", 409);
      }

      await tx.escrow.update({
        where: { serviceOrderId: freshDispute.serviceOrderId },
        data: {
          status: nextEscrowStatus,
          feeAmountCents: nextFeeCents,
          netAmountCents: nextNetCents,
          refundedAmountCents: nextRefundedCents,
          releasedAt: nextReleasedAt,
        },
      });

      await tx.serviceOrder.update({
        where: { id: freshDispute.serviceOrderId },
        data: {
          status: nextOrderStatus,
          ...(clearCompletion ? { completedAt: null, autoReleaseAt: null } : {}),
        },
      });

      return {
        message: `Disputa resolvida com decisão: ${decision}`,
        decision,
        providerReleaseCents,
        clientRefundCents,
        feeAmountCents: nextFeeCents,
        netAmountCents: nextNetCents,
      };
    });
  }
}
