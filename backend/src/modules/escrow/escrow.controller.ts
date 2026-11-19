import { Request, Response } from "express";
import { z } from "zod";
import { EscrowService } from "./escrow.service";
import { DisputeService } from "./dispute.service";

const escrowService = new EscrowService();
const disputeService = new DisputeService();

const paySchema = z.object({
  serviceOrderId: z.string().uuid("ID da solicitação inválido"),
  paymentMethod: z.enum(["PIX", "CARD", "CREDIT_CARD"]).optional(),
});

const completeSchema = z.object({
  serviceOrderId: z.string().uuid("ID da solicitação inválido"),
  completionPhotos: z.array(z.string().trim().url("URL de foto inválida")).optional(),
});

const materialProofSchema = z.object({
  serviceOrderId: z.string().uuid("ID da solicitação inválido"),
  proofUrls: z
    .array(z.string().trim().url("URL de comprovante inválida"))
    .min(1, "Informe ao menos uma URL de nota ou foto dos materiais"),
});

const disputeSchema = z.object({
  serviceOrderId: z.string().uuid("ID da solicitação inválido"),
  reason: z.string().trim().min(10, "O motivo da disputa deve ter no mínimo 10 caracteres"),
  evidencePhotos: z.array(z.string().trim().url("URL de evidência inválida")).optional(),
});

const counterEvidenceSchema = z.object({
  reason: z.string().trim().min(10, "A justificativa deve ter no mínimo 10 caracteres"),
  evidencePhotos: z.array(z.string().trim().url("URL de evidência inválida")).optional(),
});

const resolveDisputeSchema = z.object({
  decision: z.enum(["RELEASE_TO_PROVIDER", "REFUND_TO_CLIENT", "SPLIT", "REWORK"]),
  notes: z.string().trim().min(5, "As notas da decisão devem ter no mínimo 5 caracteres"),
  providerSharePercent: z.number().min(1).max(99).optional(),
  providerAmountCents: z.number().int().positive().optional(),
});

export class EscrowController {
  async pay(req: Request, res: Response): Promise<void> {
    const { serviceOrderId, paymentMethod } = paySchema.parse(req.body);
    const escrow = await escrowService.holdEscrow(req.user!.id, serviceOrderId, paymentMethod);
    res.json(escrow);
  }

  async complete(req: Request, res: Response): Promise<void> {
    const { serviceOrderId, completionPhotos } = completeSchema.parse(req.body);
    const order = await escrowService.markCompleted(req.user!.id, serviceOrderId, completionPhotos);
    res.json(order);
  }

  async submitMaterialProof(req: Request, res: Response): Promise<void> {
    const { serviceOrderId, proofUrls } = materialProofSchema.parse(req.body);
    const escrow = await escrowService.submitMaterialProof(req.user!.id, serviceOrderId, proofUrls);
    res.json(escrow);
  }

  async release(req: Request, res: Response): Promise<void> {
    const { serviceOrderId } = req.params;
    const result = await escrowService.approveAndRelease(req.user!.id, serviceOrderId);
    res.json(result);
  }

  async dispute(req: Request, res: Response): Promise<void> {
    const { serviceOrderId, reason, evidencePhotos } = disputeSchema.parse(req.body);
    const dispute = await disputeService.openDispute(
      req.user!.id,
      serviceOrderId,
      reason,
      evidencePhotos
    );
    res.status(201).json(dispute);
  }

  async addDisputeEvidence(req: Request, res: Response): Promise<void> {
    const { disputeId } = req.params;
    const { reason, evidencePhotos } = counterEvidenceSchema.parse(req.body);
    const dispute = await disputeService.submitCounterEvidence(
      req.user!.id,
      disputeId,
      reason,
      evidencePhotos
    );
    res.json(dispute);
  }

  async resolveDispute(req: Request, res: Response): Promise<void> {
    const { disputeId } = req.params;
    const { decision, notes, providerSharePercent, providerAmountCents } =
      resolveDisputeSchema.parse(req.body);
    const result = await disputeService.resolveDispute(disputeId, decision, notes, {
      providerSharePercent,
      providerAmountCents,
    });
    res.json(result);
  }
}
