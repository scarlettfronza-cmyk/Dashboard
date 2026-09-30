export const ENV = {
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  isProduction: process.env.NODE_ENV === "production",
  /** Token pessoal da API do Monday. NUNCA deve ser exposto ao frontend. */
  mondayApiToken: process.env.MONDAY_API_TOKEN ?? "",
  /** Domínio público usado para montar os links do portal do cliente. */
  publicAppUrl: (process.env.PUBLIC_APP_URL ?? "").replace(/\/$/, ""),
};
