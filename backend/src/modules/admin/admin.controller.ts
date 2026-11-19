import { Request, Response } from "express";
import { ProviderStatus } from "@prisma/client";
import { AdminService } from "./admin.service";
import { ProviderService } from "../providers/provider.service";
import { updateProviderStatusSchema } from "../providers/provider.controller";
import { parsePagination } from "../../shared/pagination";

const adminService = new AdminService();
const providerService = new ProviderService();

export class AdminController {
  async getMetrics(_req: Request, res: Response): Promise<void> {
    const metrics = await adminService.getMetrics();
    res.json(metrics);
  }

  async getDisputes(req: Request, res: Response): Promise<void> {
    const { status } = req.query as { status?: string };
    const pagination = parsePagination(req.query, 6, 50);
    const result = await adminService.getDisputes({ status, pagination });
    res.json(result);
  }

  async getAllOrders(req: Request, res: Response): Promise<void> {
    const { status, search, q } = req.query as {
      status?: string;
      search?: string;
      q?: string;
    };
    const pagination = parsePagination(req.query, 10, 50);
    const result = await adminService.getAllOrders({
      status,
      search: search || q,
      pagination,
    });
    res.json(result);
  }

  async getAllUsers(req: Request, res: Response): Promise<void> {
    const { role, search, q } = req.query as {
      role?: string;
      search?: string;
      q?: string;
    };
    const pagination = parsePagination(req.query, 10, 50);
    const result = await adminService.getAllUsers({
      role,
      search: search || q,
      pagination,
    });
    res.json(result);
  }

  async getAllProviders(req: Request, res: Response): Promise<void> {
    const { status, search, q } = req.query as {
      status?: string;
      search?: string;
      q?: string;
    };
    const pagination = parsePagination(req.query, 10, 50);
    const validStatus =
      status && Object.values(ProviderStatus).includes(status as ProviderStatus)
        ? (status as ProviderStatus)
        : undefined;

    const result = await providerService.getAllProviders({
      status: validStatus,
      search: search || q,
      pagination,
    });
    res.json(result);
  }

  async updateProviderStatus(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const { status, rejectionReason, reason } = updateProviderStatusSchema.parse(req.body);
    const updated = await providerService.updateVerificationStatus(
      id,
      status,
      rejectionReason ?? reason
    );
    res.json(updated);
  }
}
