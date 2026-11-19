import { app } from "./app";
import { ENV } from "./config/env";
import { EscrowService } from "./modules/escrow/escrow.service";

const escrowService = new EscrowService();

const server = app.listen(ENV.PORT, () => {
  console.log(`☀️ Kuara Backend running on port ${ENV.PORT} [${ENV.NODE_ENV}]`);
});

// Periodic check for 72h auto-releases (runs every 5 minutes in production)
const AUTO_RELEASE_INTERVAL_MS = 5 * 60 * 1000;
const intervalId = setInterval(async () => {
  try {
    const releasedCount = await escrowService.autoReleaseExpiredOrders();
    if (releasedCount > 0) {
      console.log(`[AutoRelease] Liberados ${releasedCount} pedidos por expiração do prazo de 72h.`);
    }
  } catch (error) {
    console.error("[AutoRelease] Erro ao verificar liberações automáticas:", error);
  }
}, AUTO_RELEASE_INTERVAL_MS);

process.on("SIGTERM", () => {
  clearInterval(intervalId);
  server.close();
});

export { server };
