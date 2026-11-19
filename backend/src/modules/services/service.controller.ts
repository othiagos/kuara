import { Request, Response } from "express";
import { z } from "zod";
import { ServiceService } from "./service.service";
import { parsePagination } from "../../shared/pagination";

const serviceService = new ServiceService();

const createOrderSchema = z.object({
  title: z.string().trim().min(5, "O título deve ter no mínimo 5 caracteres"),
  description: z.string().trim().min(10, "A descrição deve ter no mínimo 10 caracteres"),
  category: z.string().trim().min(2, "Categoria é obrigatória"),
  addressCity: z.string().trim().min(2, "Cidade é obrigatória"),
  addressState: z
    .string()
    .trim()
    .length(2, "Informe a sigla do estado (UF) com 2 letras")
    .transform((s) => s.toUpperCase()),
  addressZip: z.string().trim().min(8, "CEP deve ter no mínimo 8 caracteres"),
  addressLine: z.string().trim().min(5, "Endereço completo deve ter no mínimo 5 caracteres"),
  photos: z.array(z.string().trim().url("URL da foto inválida")).optional(),
  targetProviderId: z.string().uuid("ID do prestador inválido").optional(),
});

const cancelOrderSchema = z.object({
  reason: z.string().trim().min(3).max(500).optional(),
});

export class ServiceController {
  async create(req: Request, res: Response): Promise<void> {
    const data = createOrderSchema.parse(req.body);
    const order = await serviceService.create(req.user!.id, data);
    res.status(201).json(order);
  }

  async listOpen(req: Request, res: Response): Promise<void> {
    const { category, city, search, q } = req.query as {
      category?: string;
      city?: string;
      search?: string;
      q?: string;
    };
    const pagination = parsePagination(req.query, 8, 50);
    const result = await serviceService.listOpen(req.user!.id, {
      category,
      city,
      search: search || q,
      pagination,
    });
    res.json(result);
  }

  async listMy(req: Request, res: Response): Promise<void> {
    const { status, scope, search, q } = req.query as {
      status?: string;
      scope?: string;
      search?: string;
      q?: string;
    };
    const pagination = parsePagination(req.query, 8, 50);
    const result = await serviceService.listMyOrders(
      {
        id: req.user!.id,
        role: req.user!.role,
      },
      {
        status,
        scope,
        search: search || q,
        pagination,
      }
    );
    res.json(result);
  }

  async getById(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const order = await serviceService.getById(id, {
      id: req.user!.id,
      role: req.user!.role,
    });
    res.json(order);
  }

  async cancel(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const { reason } = cancelOrderSchema.parse(req.body || {});
    const updated = await serviceService.cancelOrder(
      id,
      { id: req.user!.id, role: req.user!.role },
      reason
    );
    res.json(updated);
  }
}
