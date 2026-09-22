import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerMetaOAuthRoutes } from "../metaOAuth";
import { registerRestoreRoute } from "../restoreRoute";
import { registerRecoveryRoute } from "../recoveryRoute";
import { garantirTabelas } from "../schemaGuard";
import { registerSalesUploadRoute } from "../salesUpload";
import { registerScheduledRoutes } from "../scheduledRoutes";
import { startMondayCron } from "../mondayCron";
import { startBudgetCron } from "../budgetCron";
import { startIgTokenRefreshCron } from "../igTokenRefreshCron";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  // Backup restaurado pode não ter todas as tabelas que o código espera.
  await garantirTabelas();

  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // Meta/Instagram OAuth callback under /api/meta/callback
  registerMetaOAuthRoutes(app);
  registerRestoreRoute(app);
  registerRecoveryRoute(app);
  // Sales XLSX upload endpoint
  registerSalesUploadRoute(app);
  // Scheduled task endpoints (budget check, etc.)
  registerScheduledRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");

  // Em produção a porta é contrato com a hospedagem, que roteia o tráfego
  // para ela. Procurar outra porta livre faria o serviço subir num lugar onde
  // ninguém o procura: o deploy fica verde e o site, fora do ar. Melhor falhar
  // de forma visível. Em desenvolvimento a busca continua, por conveniência.
  const port = process.env.NODE_ENV === "production"
    ? preferredPort
    : await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
    // Start Monday auto-sync cron job
    startMondayCron();
    // Start budget alert cron job (every 2 hours)
    startBudgetCron();
    // Start Instagram token auto-refresh cron job (daily at 03:00 AM)
    startIgTokenRefreshCron();
  });
}

startServer().catch(console.error);
