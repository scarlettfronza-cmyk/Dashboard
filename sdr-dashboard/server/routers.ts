import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { sdrRouter } from "./routers/sdr";
import { accountRouter, logoutProcedure } from "./routers/account";
import { adminRouter } from "./routers/admin";

export const appRouter = router({
  // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,

  auth: router({
    /** Usuário da sessão atual, ou null. Nunca devolve o hash da senha. */
    me: publicProcedure.query(({ ctx }) => {
      if (!ctx.user) return null;
      const { passwordHash, ...safe } = ctx.user;
      return safe;
    }),
    logout: logoutProcedure,
  }),

  account: accountRouter,
  admin: adminRouter,
  sdr: sdrRouter,
});

export type AppRouter = typeof appRouter;
