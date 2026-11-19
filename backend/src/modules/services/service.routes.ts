import { Router } from "express";
import { ServiceController } from "./service.controller";
import { ensureAuthenticated } from "../../shared/middlewares/auth";
import { ensureRole } from "../../shared/middlewares/roleGuard";
import { Role } from "@prisma/client";

export const serviceRouter = Router();
const controller = new ServiceController();

serviceRouter.post(
  "/",
  ensureAuthenticated,
  ensureRole(Role.CLIENT),
  (req, res, next) => controller.create(req, res).catch(next)
);

serviceRouter.get(
  "/open",
  ensureAuthenticated,
  (req, res, next) => controller.listOpen(req, res).catch(next)
);

serviceRouter.get(
  "/my",
  ensureAuthenticated,
  ensureRole(Role.CLIENT, Role.PROVIDER),
  (req, res, next) => controller.listMy(req, res).catch(next)
);

serviceRouter.get(
  "/:id",
  ensureAuthenticated,
  (req, res, next) => controller.getById(req, res).catch(next)
);

serviceRouter.patch(
  "/:id/cancel",
  ensureAuthenticated,
  ensureRole(Role.CLIENT, Role.ADMIN),
  (req, res, next) => controller.cancel(req, res).catch(next)
);
