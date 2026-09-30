export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  /** Token pessoal da API do Monday. NUNCA deve ser exposto ao frontend. */
  mondayApiToken: process.env.MONDAY_API_TOKEN ?? "",
  /** Domínio público usado para montar os links do portal do cliente. */
  publicAppUrl: (process.env.PUBLIC_APP_URL ?? "").replace(/\/$/, ""),
};
