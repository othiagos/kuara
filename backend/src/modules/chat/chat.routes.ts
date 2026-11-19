import { Router } from "express";
import { ChatController } from "./chat.controller";
import { ensureAuthenticated } from "../../shared/middlewares/auth";

export const chatRouter = Router();
const controller = new ChatController();

chatRouter.post(
  "/:orderId",
  ensureAuthenticated,
  (req, res, next) => controller.send(req, res).catch(next)
);

chatRouter.get(
  "/:orderId",
  ensureAuthenticated,
  (req, res, next) => controller.list(req, res).catch(next)
);
