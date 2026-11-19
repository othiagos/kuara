import { Router } from "express";
import { ProviderController } from "./provider.controller";
import { ensureAuthenticated } from "../../shared/middlewares/auth";
import { ensureRole } from "../../shared/middlewares/roleGuard";
import { Role } from "@prisma/client";

export const providerRouter = Router();
const controller = new ProviderController();

providerRouter.get("/showcase", (req, res, next) => controller.getShowcase(req, res).catch(next));

providerRouter.post(
  "/verify",
  ensureAuthenticated,
  ensureRole(Role.PROVIDER),
  (req, res, next) => controller.submitDocs(req, res).catch(next)
);

providerRouter.get(
  "/wallet",
  ensureAuthenticated,
  ensureRole(Role.PROVIDER),
  (req, res, next) => controller.getWallet(req, res).catch(next)
);

providerRouter.get(
  "/pending",
  ensureAuthenticated,
  ensureRole(Role.ADMIN),
  (req, res, next) => controller.getPending(req, res).catch(next)
);

providerRouter.patch(
  "/:id/status",
  ensureAuthenticated,
  ensureRole(Role.ADMIN),
  (req, res, next) => controller.updateStatus(req, res).catch(next)
);
