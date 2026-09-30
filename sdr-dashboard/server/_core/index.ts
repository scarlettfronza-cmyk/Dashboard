import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { startMondayCron } from "../mondayCron";
import { registerOgRoute } from "../ogPortal";
import { registerRecoveryRoute } from "../recoveryRoute";
import { registerRestoreRoute } from "../restoreRoute";
import { garantirEsquema } from "../schemaGuard";
import { createContext } from "./context";
import { serveStatic, setupVite, staticDir } from "./vite";

async function startServer() {
  // Cria o que faltar no banco antes de aceitar requisições. Nunca derruba o
  // servidor: sem banco, as telas de importação e recuperação ainda abrem.
  await garantirEsquema();

  const app = express();
  const server = createServer(app);
  // Railway entrega HTTPS por um proxy; sem isto o cookie de sessão não sai
  // com `secure` e o navegador descarta o login.
  app.set("trust proxy", 1);
  // Rotas de importação e recuperação antes do parser global: a importação
  // aceita um arquivo maior e as duas só existem com a senha no ambiente.
  registerRestoreRoute(app);
  registerRecoveryRoute(app);
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  app.get("/api/saude", (_req, res) => res.json({ ok: true }));
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
    registerOgRoute(app, staticDir());
    serveStatic(app);
  }

  // Em produção a porta é a que a hospedagem mandar; se estiver ocupada, é
  // melhor falhar visivelmente do que subir numa porta que ninguém acessa.
  const port = parseInt(process.env.PORT || "3000");
  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
    startMondayCron();
  });
}

startServer().catch(error => {
  console.error(error);
  process.exit(1);
});
