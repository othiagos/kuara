import express from "express";
import cors from "cors";
import { ENV } from "./config/env";
import { authRouter } from "./modules/auth/auth.routes";
import { providerRouter } from "./modules/providers/provider.routes";
import { serviceRouter } from "./modules/services/service.routes";
import { proposalRouter } from "./modules/proposals/proposal.routes";
import { escrowRouter } from "./modules/escrow/escrow.routes";
import { chatRouter } from "./modules/chat/chat.routes";
import { reviewRouter } from "./modules/reviews/review.routes";
import { adminRouter } from "./modules/admin/admin.routes";
import { errorHandler } from "./shared/middlewares/errorHandler";

export const app = express();

app.set("trust proxy", 1);

const allowedOrigins = ENV.CORS_ORIGIN.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(allowedOrigins.length > 0 ? cors({ origin: allowedOrigins }) : cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "OK", platform: "Kuara Marketplace API", time: new Date() });
});

app.use("/api/auth", authRouter);
app.use("/api/providers", providerRouter);
app.use("/api/services", serviceRouter);
app.use("/api/proposals", proposalRouter);
app.use("/api/escrow", escrowRouter);
app.use("/api/chat", chatRouter);
app.use("/api/reviews", reviewRouter);
app.use("/api/admin", adminRouter);

app.use(errorHandler);
