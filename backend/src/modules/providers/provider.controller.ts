import { Request, Response } from "express";
import { z } from "zod";
import { ProviderService } from "./provider.service";
import { ProviderStatus } from "@prisma/client";
import { parsePagination } from "../../shared/pagination";

const providerService = new ProviderService();

const docsSchema = z.object({
  documentUrl: z.string().trim().url("Informe uma URL válida para o documento com foto"),
  addressProofUrl: z.string().trim().url("Informe uma URL válida para o comprovante de endereço"),
});

export const updateProviderStatusSchema = z.object({
  status: z.nativeEnum(ProviderStatus),
  rejectionReason: z.string().trim().min(5, "A justificativa deve ter no mínimo 5 caracteres").max(500).optional(),
  reason: z.string().trim().min(5, "A justificativa deve ter no mínimo 5 caracteres").max(500).optional(),
});

export class ProviderController {
  async getShowcase(req: Request, res: Response): Promise<void> {
    const { category, city, search, q } = req.query as {
      category?: string;
      city?: string;
      search?: string;
      q?: string;
    };
    const pagination = parsePagination(req.query, 8, 50);
    const result = await providerService.getShowcase({
      category,
      city,
      search: search || q,
      pagination,
    });
    res.json(result);
  }

  async submitDocs(req: Request, res: Response): Promise<void> {
    const { documentUrl, addressProofUrl } = docsSchema.parse(req.body);
    const updated = await providerService.submitVerificationDocs(
      req.user!.id,
      documentUrl,
      addressProofUrl
    );
    res.json(updated);
  }

  async getPending(_req: Request, res: Response): Promise<void> {
    const list = await providerService.getPendingVerifications();
    res.json(list);
  }

  async updateStatus(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const { status, rejectionReason, reason } = updateProviderStatusSchema.parse(req.body);
    const updated = await providerService.updateVerificationStatus(
      id,
      status,
      rejectionReason ?? reason
    );
    res.json(updated);
  }

  async getWallet(req: Request, res: Response): Promise<void> {
    const wallet = await providerService.getWalletMetrics(req.user!.id);
    res.json(wallet);
  }
}
