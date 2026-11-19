import { prisma } from "../../shared/database";
import { AppError } from "../../shared/errors";
import { ENV } from "../../config/env";
import { EscrowStatus, ProposalStatus, ServiceStatus } from "@prisma/client";
import {
  computeEscrowSplit,
  computeAutoReleaseDate,
} from "./escrow.rules";

export class EscrowService {
  async holdEscrow(clientId: string, serviceOrderId: string, paymentMethod = "PIX") {
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "ServiceOrder" WHERE id = ${serviceOrderId} FOR UPDATE`;

      const order = await tx.serviceOrder.findUnique({
        where: { id: serviceOrderId },
        include: { acceptedProposal: true, escrow: true },
      });
      if (!order) throw new AppError("Ordem de serviço não encontrada", 404);
      if (order.clientId !== clientId) throw new AppError("Acesso não autorizado", 403);
      if (order.status !== ServiceStatus.ESCROW_PENDING || !order.acceptedProposal) {
        throw new AppError("O serviço não está aguardando pagamento em custódia", 400);
      }
      if (order.escrow && order.escrow.status !== EscrowStatus.PENDING) {
        throw new AppError("A custódia para este serviço já foi processada", 400);
      }

      const split = computeEscrowSplit(
        order.acceptedProposal.laborCostCents,
        order.acceptedProposal.materialCostCents,
        ENV.PLATFORM_FEE_PERCENTAGE
      );
      const now = new Date();
      const materialsReleasedAt = split.materialsReleasedImmediate ? now : null;

      const updatedOrder = await tx.serviceOrder.updateMany({
        where: { id: serviceOrderId, status: ServiceStatus.ESCROW_PENDING },
        data: { status: ServiceStatus.IN_PROGRESS },
      });
      if (updatedOrder.count === 0) {
        throw new AppError("O serviço não está aguardando pagamento em custódia", 409);
      }

      return tx.escrow.upsert({
        where: { serviceOrderId },
        create: {
          serviceOrderId,
          grossAmountCents: split.grossAmountCents,
          laborAmountCents: split.laborAmountCents,
          materialsAmountCents: split.materialsAmountCents,
          materialsReleasedAt,
          feeAmountCents: split.feeAmountCents,
          netAmountCents: split.netAmountCents,
          status: EscrowStatus.HELD,
          paymentMethod,
          paidAt: now,
        },
        update: {
          grossAmountCents: split.grossAmountCents,
          laborAmountCents: split.laborAmountCents,
          materialsAmountCents: split.materialsAmountCents,
          materialsReleasedAt,
          feeAmountCents: split.feeAmountCents,
          netAmountCents: split.netAmountCents,
          status: EscrowStatus.HELD,
          paymentMethod,
          paidAt: now,
        },
      });
    });
  }

  async submitMaterialProof(providerId: string, serviceOrderId: string, proofUrls: string[]) {
    const order = await prisma.serviceOrder.findUnique({
      where: { id: serviceOrderId },
      include: { acceptedProposal: true, escrow: true },
    });
    if (!order) throw new AppError("Ordem de serviço não encontrada", 404);
    if (order.acceptedProposal?.providerId !== providerId) {
      throw new AppError("Apenas o prestador contratado pode enviar comprovante de materiais", 403);
    }
    if (
      order.status !== ServiceStatus.IN_PROGRESS &&
      order.status !== ServiceStatus.COMPLETED_PENDING_APPROVAL
    ) {
      throw new AppError("O serviço não está em execução para envio de nota de materiais", 400);
    }
    if (!order.escrow || order.escrow.materialsAmountCents <= 0) {
      throw new AppError("Este serviço não possui adiantamento de materiais registrado", 400);
    }

    return prisma.escrow.update({
      where: { serviceOrderId },
      data: {
        materialProofUrls: proofUrls,
      },
    });
  }

  async markCompleted(providerId: string, serviceOrderId: string, completionPhotos?: string[]) {
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "ServiceOrder" WHERE id = ${serviceOrderId} FOR UPDATE`;

      const order = await tx.serviceOrder.findUnique({
        where: { id: serviceOrderId },
        include: { acceptedProposal: true },
      });
      if (!order) throw new AppError("Ordem de serviço não encontrada", 404);
      if (order.acceptedProposal?.providerId !== providerId) {
        throw new AppError("Apenas o prestador contratado pode marcar o serviço como concluído", 403);
      }
      if (order.status !== ServiceStatus.IN_PROGRESS) {
        throw new AppError("O serviço precisa estar em andamento para ser concluído", 400);
      }

      const completedAt = new Date();
      const autoReleaseAt = computeAutoReleaseDate(completedAt, ENV.AUTO_RELEASE_HOURS);

      const updated = await tx.serviceOrder.updateMany({
        where: { id: serviceOrderId, status: ServiceStatus.IN_PROGRESS },
        data: {
          status: ServiceStatus.COMPLETED_PENDING_APPROVAL,
          completedAt,
          autoReleaseAt,
          completionPhotos: completionPhotos || [],
        },
      });
      if (updated.count === 0) {
        throw new AppError("O serviço precisa estar em andamento para ser concluído", 409);
      }

      return tx.serviceOrder.findUnique({ where: { id: serviceOrderId } });
    });
  }

  async approveAndRelease(clientId: string, serviceOrderId: string) {
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "ServiceOrder" WHERE id = ${serviceOrderId} FOR UPDATE`;

      const order = await tx.serviceOrder.findUnique({
        where: { id: serviceOrderId },
        include: { escrow: true },
      });
      if (!order) throw new AppError("Ordem de serviço não encontrada", 404);
      if (order.clientId !== clientId) throw new AppError("Apenas o contratante pode aprovar", 403);
      if (
        order.status !== ServiceStatus.COMPLETED_PENDING_APPROVAL ||
        !order.escrow ||
        order.escrow.status !== EscrowStatus.HELD
      ) {
        throw new AppError("O serviço não está aguardando aprovação de entrega", 400);
      }

      const releasedEscrow = await tx.escrow.updateMany({
        where: { serviceOrderId, status: EscrowStatus.HELD },
        data: { status: EscrowStatus.RELEASED, releasedAt: new Date() },
      });
      const finishedOrder = await tx.serviceOrder.updateMany({
        where: { id: serviceOrderId, status: ServiceStatus.COMPLETED_PENDING_APPROVAL },
        data: { status: ServiceStatus.FINISHED },
      });
      if (releasedEscrow.count === 0 || finishedOrder.count === 0) {
        throw new AppError("Conflito ao liberar custódia", 409);
      }

      return { message: "Serviço aprovado e repasse liberado ao prestador com sucesso!" };
    });
  }

  async autoReleaseExpiredOrders() {
    const now = new Date();
    const expiredOrders = await prisma.serviceOrder.findMany({
      where: {
        status: ServiceStatus.COMPLETED_PENDING_APPROVAL,
        autoReleaseAt: { lte: now },
      },
      include: { escrow: true },
    });

    let releasedCount = 0;
    for (const order of expiredOrders) {
      if (!order.escrow || order.escrow.status !== EscrowStatus.HELD) {
        continue;
      }
      try {
        await prisma.$transaction(async (tx) => {
          const esc = await tx.escrow.updateMany({
            where: { serviceOrderId: order.id, status: EscrowStatus.HELD },
            data: { status: EscrowStatus.RELEASED, releasedAt: now },
          });
          const ord = await tx.serviceOrder.updateMany({
            where: { id: order.id, status: ServiceStatus.COMPLETED_PENDING_APPROVAL },
            data: { status: ServiceStatus.FINISHED },
          });
          if (esc.count > 0 && ord.count > 0) {
            releasedCount++;
          }
        });
      } catch (err) {
        console.error(`Auto-release failed for order ${order.id}:`, err);
      }
    }
    return releasedCount;
  }

  async cancelExpiredPendingEscrows(expirationHours = 24) {
    const cutoff = new Date(Date.now() - expirationHours * 60 * 60 * 1000);
    const expired = await prisma.serviceOrder.findMany({
      where: {
        status: ServiceStatus.ESCROW_PENDING,
        updatedAt: { lte: cutoff },
      },
    });

    let cancelledCount = 0;
    for (const order of expired) {
      try {
        await prisma.$transaction(async (tx) => {
          const res = await tx.serviceOrder.updateMany({
            where: { id: order.id, status: ServiceStatus.ESCROW_PENDING },
            data: {
              status: ServiceStatus.CANCELLED,
              cancelledReason: "Pagamento em custódia expirado automaticamente",
              cancelledAt: new Date(),
            },
          });
          if (res.count > 0) {
            await tx.proposal.updateMany({
              where: { serviceOrderId: order.id },
              data: { isAccepted: false, status: ProposalStatus.REJECTED },
            });
            cancelledCount++;
          }
        });
      } catch (err) {
        console.error(`Expired escrow cancellation failed for order ${order.id}:`, err);
      }
    }
    return cancelledCount;
  }
}
