import { Request, Response } from "express";
import { z } from "zod";
import { ProposalService } from "./proposal.service";

const proposalService = new ProposalService();

const createProposalSchema = z.object({
  serviceOrderId: z.string().uuid("ID da solicitação inválido"),
  description: z.string().trim().min(10, "A descrição da proposta deve ter no mínimo 10 caracteres"),
  estimatedDays: z.number().int().positive("Prazo estimado deve ser positivo"),
  laborCostCents: z
    .number()
    .int()
    .min(500, "Valor simbólico não permitido. Mínimo de mão de obra: R$ 5,00 (500 centavos)"),
  materialCostCents: z.number().int().nonnegative().optional(),
  materialPolicy: z.enum(["CLIENT_SUPPLIES", "PROVIDER_ADVANCE"]).optional(),
  materialsList: z.string().trim().max(1000, "Lista de materiais muito longa (máx. 1000 caracteres)").optional(),
});

export class ProposalController {
  async create(req: Request, res: Response): Promise<void> {
    const data = createProposalSchema.parse(req.body);
    const proposal = await proposalService.create(req.user!.id, data);
    res.status(201).json(proposal);
  }

  async listByOrder(req: Request, res: Response): Promise<void> {
    const { orderId } = req.params;
    const proposals = await proposalService.listByOrder(orderId, {
      id: req.user!.id,
      role: req.user!.role,
    });
    res.json(proposals);
  }

  async accept(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const result = await proposalService.acceptProposal(req.user!.id, id);
    res.json(result);
  }

  async withdraw(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const result = await proposalService.withdrawProposal(req.user!.id, id);
    res.json(result);
  }
}
