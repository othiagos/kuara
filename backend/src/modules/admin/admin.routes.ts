import { Router } from "express";
import { AdminController } from "./admin.controller";
import { ensureAuthenticated } from "../../shared/middlewares/auth";
import { ensureRole } from "../../shared/middlewares/roleGuard";
import { Role } from "@prisma/client";

export const adminRouter = Router();
const controller = new AdminController();

adminRouter.use(ensureAuthenticated, ensureRole(Role.ADMIN));

adminRouter.get("/metrics", (req, res, next) => controller.getMetrics(req, res).catch(next));
adminRouter.get("/disputes", (req, res, next) => controller.getDisputes(req, res).catch(next));
adminRouter.get("/orders", (req, res, next) => controller.getAllOrders(req, res).catch(next));
adminRouter.get("/users", (req, res, next) => controller.getAllUsers(req, res).catch(next));
adminRouter.get("/providers", (req, res, next) => controller.getAllProviders(req, res).catch(next));
adminRouter.patch("/providers/:id/status", (req, res, next) =>
  controller.updateProviderStatus(req, res).catch(next)
);
