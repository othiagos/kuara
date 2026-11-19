import { Router } from "express";
import { ProposalController } from "./proposal.controller";
import { ensureAuthenticated } from "../../shared/middlewares/auth";
import { ensureRole } from "../../shared/middlewares/roleGuard";
import { Role } from "@prisma/client";

export const proposalRouter = Router();
const controller = new ProposalController();

proposalRouter.post(
  "/",
  ensureAuthenticated,
  ensureRole(Role.PROVIDER),
  (req, res, next) => controller.create(req, res).catch(next)
);

proposalRouter.get(
  "/order/:orderId",
  ensureAuthenticated,
  (req, res, next) => controller.listByOrder(req, res).catch(next)
);

proposalRouter.patch(
  "/:id/accept",
  ensureAuthenticated,
  ensureRole(Role.CLIENT),
  (req, res, next) => controller.accept(req, res).catch(next)
);

proposalRouter.delete(
  "/:id",
  ensureAuthenticated,
  ensureRole(Role.PROVIDER),
  (req, res, next) => controller.withdraw(req, res).catch(next)
);
