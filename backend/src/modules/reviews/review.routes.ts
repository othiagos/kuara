import { Router } from "express";
import { ReviewController } from "./review.controller";
import { ensureAuthenticated } from "../../shared/middlewares/auth";
import { ensureRole } from "../../shared/middlewares/roleGuard";
import { Role } from "@prisma/client";

export const reviewRouter = Router();
const controller = new ReviewController();

reviewRouter.post(
  "/",
  ensureAuthenticated,
  ensureRole(Role.CLIENT, Role.PROVIDER),
  (req, res, next) => controller.create(req, res).catch(next)
);

reviewRouter.get(
  "/user/:userId",
  (req, res, next) => controller.listByUser(req, res).catch(next)
);

reviewRouter.get(
  "/user/:userId/summary",
  (req, res, next) => controller.getSummaryByUser(req, res).catch(next)
);
