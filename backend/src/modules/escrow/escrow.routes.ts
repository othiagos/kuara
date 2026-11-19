import { Router } from "express";
import { EscrowController } from "./escrow.controller";
import { ensureAuthenticated } from "../../shared/middlewares/auth";
import { ensureRole } from "../../shared/middlewares/roleGuard";
import { Role } from "@prisma/client";

export const escrowRouter = Router();
const controller = new EscrowController();

escrowRouter.post(
  "/pay",
  ensureAuthenticated,
  ensureRole(Role.CLIENT),
  (req, res, next) => controller.pay(req, res).catch(next)
);

escrowRouter.post(
  "/complete",
  ensureAuthenticated,
  ensureRole(Role.PROVIDER),
  (req, res, next) => controller.complete(req, res).catch(next)
);

escrowRouter.post(
  "/materials-proof",
  ensureAuthenticated,
  ensureRole(Role.PROVIDER),
  (req, res, next) => controller.submitMaterialProof(req, res).catch(next)
);

escrowRouter.post(
  "/release/:serviceOrderId",
  ensureAuthenticated,
  ensureRole(Role.CLIENT),
  (req, res, next) => controller.release(req, res).catch(next)
);

escrowRouter.post(
  "/dispute",
  ensureAuthenticated,
  ensureRole(Role.CLIENT, Role.PROVIDER),
  (req, res, next) => controller.dispute(req, res).catch(next)
);

escrowRouter.post(
  "/dispute/:disputeId/evidence",
  ensureAuthenticated,
  ensureRole(Role.CLIENT, Role.PROVIDER),
  (req, res, next) => controller.addDisputeEvidence(req, res).catch(next)
);

escrowRouter.post(
  "/dispute/:disputeId/resolve",
  ensureAuthenticated,
  ensureRole(Role.ADMIN),
  (req, res, next) => controller.resolveDispute(req, res).catch(next)
);
