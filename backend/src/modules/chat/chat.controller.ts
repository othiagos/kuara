import { Request, Response } from "express";
import { z } from "zod";
import { ChatService } from "./chat.service";

const chatService = new ChatService();

const sendSchema = z.object({
  content: z.string().trim().min(1, "Mensagem não pode ser vazia").max(1000),
  proposalId: z.string().uuid("ID da proposta inválido").optional(),
  recipientId: z.string().uuid("ID do destinatário inválido").optional(),
});

const listQuerySchema = z.object({
  proposalId: z.string().uuid("ID da proposta inválido").optional(),
});

export class ChatController {
  async send(req: Request, res: Response): Promise<void> {
    const { orderId } = req.params;
    const { content, proposalId, recipientId } = sendSchema.parse(req.body);
    const msg = await chatService.sendMessage(
      req.user!.id,
      req.user!.role,
      orderId,
      content,
      { proposalId, recipientId }
    );
    res.status(201).json(msg);
  }

  async list(req: Request, res: Response): Promise<void> {
    const { orderId } = req.params;
    const { proposalId } = listQuerySchema.parse(req.query);
    const list = await chatService.listMessages(
      req.user!.id,
      req.user!.role,
      orderId,
      proposalId
    );
    res.json(list);
  }
}
