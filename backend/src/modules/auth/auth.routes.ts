import { Router } from "express";
import { AuthController } from "./auth.controller";
import { ensureAuthenticated } from "../../shared/middlewares/auth";

export const authRouter = Router();
const controller = new AuthController();

authRouter.post("/register", (req, res, next) => controller.register(req, res).catch(next));
authRouter.post("/login", (req, res, next) => controller.login(req, res).catch(next));
authRouter.get("/me", ensureAuthenticated, (req, res, next) => controller.me(req, res).catch(next));
