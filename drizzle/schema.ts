import { bigint, index, int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, json, boolean } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Clients managed by the traffic manager
export const clients = mysqlTable("clients", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull(),
  active: int("active").default(1).notNull(),
  publicToken: varchar("publicToken", { length: 64 }),
  mondayBoardId: varchar("mondayBoardId", { length: 100 }),
  mondayLastSync: timestamp("mondayLastSync"),
  whatsappNumber: varchar("whatsappNumber", { length: 30 }),
  salesChannelFilter: varchar("salesChannelFilter", { length: 255 }), // Filtro de canal de aquisição (ex: "Trafego" - só conta registros desse canal)
  isPrePaid: int("isPrePaid").default(0).notNull(), // 1 = conta pré-paga (PIX/boleto), recebe alerta de saldo baixo
  logoUrl: text("logoUrl"), // URL do logo da clínica para a página pública
  brandColor: varchar("brandColor", { length: 20 }), // Cor principal da marca (hex, ex: #00b4d8)
  metaPixelId: varchar("metaPixelId", { length: 50 }), // Meta Pixel ID para Conversions API
  metaCAPIToken: text("metaCAPIToken"), // Meta Conversions API access token
  reportTheme: varchar("reportTheme", { length: 10 }).default("dark"), // Tema do relatório público: 'dark' (Escarlate) ou 'light' (claro)
  whatsappGroupId: varchar("whatsappGroupId", { length: 255 }), // ID do grupo de WhatsApp para envio de relatórios
  campaignTypes: varchar("campaignTypes", { length: 500 }), // JSON array de tipos de campanha: ["lead","profile_visit","awareness"]
  leadChannel: varchar("leadChannel", { length: 50 }), // Canal principal de captação: whatsapp, instagram, formulario ou misto
  targetCpl: decimal("targetCpl", { precision: 15, scale: 2 }), // Meta de custo por lead
  targetCostPerConsult: decimal("targetCostPerConsult", { precision: 15, scale: 2 }), // Meta de custo por consulta/agendamento
  targetRoas: decimal("targetRoas", { precision: 10, scale: 2 }), // Meta mínima de ROAS
  mappingNotes: text("mappingNotes"), // Critério de qualidade comercial e observações operacionais
  mappingConfirmed: int("mappingConfirmed").default(0).notNull(), // Cadastro revisado e confirmado pela gestão
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Client = typeof clients.$inferSelect;
export type InsertClient = typeof clients.$inferInsert;

// API integration credentials per client
export const integrations = mysqlTable("integrations", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull(),
  provider: mysqlEnum("provider", ["meta_ads", "monday", "google_sheets", "sales_sheet", "followers_sheet", "instagram_oauth", "meta_token"]).notNull(),
  accessToken: text("accessToken"),
  adAccountId: varchar("adAccountId", { length: 100 }),
  boardId: varchar("boardId", { length: 100 }),
  extraConfig: json("extraConfig"),
  // Instagram OAuth specific fields
  metaUserId: varchar("metaUserId", { length: 100 }),
  metaIgUserId: varchar("metaIgUserId", { length: 100 }),
  metaIgUsername: varchar("metaIgUsername", { length: 100 }),
  connectedAt: timestamp("connectedAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Integration = typeof integrations.$inferSelect;
export type InsertIntegration = typeof integrations.$inferInsert;

// Daily snapshots of KPI data saved to DB and S3
export const snapshots = mysqlTable("snapshots", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull(),
  snapshotDate: varchar("snapshotDate", { length: 10 }).notNull(), // YYYY-MM-DD
  investimento: decimal("investimento", { precision: 15, scale: 2 }),
  leads: int("leads"),
  vendas: int("vendas"),
  totalEmVendas: decimal("totalEmVendas", { precision: 15, scale: 2 }),
  novosSeguidores: int("novosSeguidores"),
  rawMetaData: json("rawMetaData"),
  rawMondayData: json("rawMondayData"),
  s3Key: varchar("s3Key", { length: 500 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Snapshot = typeof snapshots.$inferSelect;
export type InsertSnapshot = typeof snapshots.$inferInsert;

// Managers (agency staff) with email+password login
export const managers = mysqlTable("managers", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
  active: int("active").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Manager = typeof managers.$inferSelect;
export type InsertManager = typeof managers.$inferInsert;

// Which clients each manager can access
export const managerClients = mysqlTable("manager_clients", {
  id: int("id").autoincrement().primaryKey(),
  managerId: int("managerId").notNull(),
  clientId: int("clientId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ManagerClient = typeof managerClients.$inferSelect;
export type InsertManagerClient = typeof managerClients.$inferInsert;

// Sales records imported from Monday.com XLSX per client
export const salesRecords = mysqlTable("sales_records", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull(),
  patientName: varchar("patientName", { length: 255 }),
  groupName: varchar("groupName", { length: 255 }), // Nome do grupo no Monday (ex: "Avaliação (ABRIL/2026)")
  consultDate: timestamp("consultDate"),
  conversionDate: timestamp("conversionDate"), // Data de Conversão (quando o lead virou paciente/fechamento)
  acquisitionChannel: varchar("acquisitionChannel", { length: 100 }), // Canal de Aquisição (ex: Trafego, Organico, Indicacao)
  consultValue: decimal("consultValue", { precision: 15, scale: 2 }),
  surgeryValue: decimal("surgeryValue", { precision: 15, scale: 2 }),
  closedValue: decimal("closedValue", { precision: 15, scale: 2 }), // Valor fechado (ex: Majestic)
  closed: boolean("closed").default(false).notNull(),
  lastUpdated: timestamp("lastUpdated"),
  uploadBatch: varchar("uploadBatch", { length: 64 }).notNull(), // UUID per upload
  uploadedAt: timestamp("uploadedAt").defaultNow().notNull(),
});

export type SalesRecord = typeof salesRecords.$inferSelect;
export type InsertSalesRecord = typeof salesRecords.$inferInsert;

// Global system settings (key-value store for admin-level configs)
export const systemSettings = mysqlTable("system_settings", {
  id: int("id").autoincrement().primaryKey(),
  key: varchar("key", { length: 100 }).notNull().unique(),
  value: text("value"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type SystemSetting = typeof systemSettings.$inferSelect;

// Report customization config per client (AI-driven format preferences)
export const reportConfig = mysqlTable("report_config", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull().unique(),
  introText: text("introText"), // Texto de introdução personalizado
  tone: varchar("tone", { length: 50 }).default("profissional"), // tom: profissional, descontraido, motivacional
  showSections: json("showSections"), // quais seções exibir no relatório
  customInstructions: text("customInstructions"), // instruções livres para a IA
  lastUpdatedBy: varchar("lastUpdatedBy", { length: 100 }), // quem atualizou
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type ReportConfig = typeof reportConfig.$inferSelect;
export type InsertReportConfig = typeof reportConfig.$inferInsert;

// Chat history for AI report customization
export const reportChatHistory = mysqlTable("report_chat_history", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull(),
  role: mysqlEnum("role", ["user", "assistant"]).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ReportChatHistory = typeof reportChatHistory.$inferSelect;
export type InsertReportChatHistory = typeof reportChatHistory.$inferInsert;

// Lead Ad Matches - cruzamento entre leads do Meta Lead Ads e leads do Monday
export const leadAdMatches = mysqlTable("lead_ad_matches", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull(),
  phone: varchar("phone", { length: 30 }).notNull(), // telefone normalizado (só dígitos)
  adId: varchar("adId", { length: 50 }),
  adName: varchar("adName", { length: 500 }),
  adSetName: varchar("adSetName", { length: 500 }),
  campaignId: varchar("campaignId", { length: 50 }),
  campaignName: varchar("campaignName", { length: 500 }),
  formId: varchar("formId", { length: 50 }),
  metaLeadId: varchar("metaLeadId", { length: 50 }).unique(), // ID do lead no Meta
  createdTimeOnMeta: timestamp("createdTimeOnMeta"), // quando o lead foi criado no Meta
  capiSent: boolean("capiSent").default(false).notNull(), // se já enviou evento para CAPI
  capiSentAt: timestamp("capiSentAt"), // quando enviou para CAPI
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type LeadAdMatch = typeof leadAdMatches.$inferSelect;
export type InsertLeadAdMatch = typeof leadAdMatches.$inferInsert;

// CAPI Events log — rastreia cada evento enviado para a Meta Conversions API

export const capiEvents = mysqlTable("capi_events", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull(),
  phone: varchar("phone", { length: 30 }),
  eventName: varchar("eventName", { length: 64 }).notNull(),
  eventTime: bigint("eventTime", { mode: "number" }).notNull(),
  value: decimal("value", { precision: 15, scale: 2 }),
  currency: varchar("currency", { length: 8 }).default("BRL"),
  sourceType: varchar("sourceType", { length: 32 }),
  sourceId: varchar("sourceId", { length: 128 }),
  success: boolean("success").default(true).notNull(),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type CapiEvent = typeof capiEvents.$inferSelect;
export type InsertCapiEvent = typeof capiEvents.$inferInsert;

// Creative Analyst: classificação e hipóteses geradas para anúncios da Meta
export const creativeAnalyses = mysqlTable("creative_analyses", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull(),
  adId: varchar("adId", { length: 100 }).notNull(),
  periodFrom: varchar("periodFrom", { length: 10 }).notNull(),
  periodTo: varchar("periodTo", { length: 10 }).notNull(),
  adName: varchar("adName", { length: 500 }),
  campaignName: varchar("campaignName", { length: 500 }),
  adsetName: varchar("adsetName", { length: 500 }),
  format: varchar("format", { length: 50 }),
  thumbnailUrl: text("thumbnailUrl"),
  hook: varchar("hook", { length: 500 }),
  angle: varchar("angle", { length: 500 }),
  promise: varchar("promise", { length: 500 }),
  proof: varchar("proof", { length: 500 }),
  offer: varchar("offer", { length: 500 }),
  callToAction: varchar("callToAction", { length: 255 }),
  performanceInsight: text("performanceInsight"),
  testHypothesis: text("testHypothesis"),
  confidence: int("confidence").default(0).notNull(),
  metrics: json("metrics"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type CreativeAnalysis = typeof creativeAnalyses.$inferSelect;
export type InsertCreativeAnalysis = typeof creativeAnalyses.$inferInsert;

// Creative Agent: briefs aprováveis gerados a partir dos padrões de criativos vencedores
export const creativeBriefs = mysqlTable("creative_briefs", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull(),
  sourceCreativeAnalysisId: int("sourceCreativeAnalysisId"),
  periodFrom: varchar("periodFrom", { length: 10 }).notNull(),
  periodTo: varchar("periodTo", { length: 10 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  objective: varchar("objective", { length: 255 }).notNull(),
  targetAudience: text("targetAudience"),
  hypothesis: text("hypothesis").notNull(),
  hook: text("hook").notNull(),
  angle: text("angle").notNull(),
  coreMessage: text("coreMessage").notNull(),
  visualDirection: text("visualDirection").notNull(),
  script: text("script").notNull(),
  primaryText: text("primaryText").notNull(),
  headline: varchar("headline", { length: 500 }).notNull(),
  callToAction: varchar("callToAction", { length: 255 }).notNull(),
  format: varchar("format", { length: 100 }).notNull(),
  variableToTest: text("variableToTest").notNull(),
  successMetric: varchar("successMetric", { length: 255 }).notNull(),
  status: mysqlEnum("status", ["draft", "approved", "rejected", "tested"]).default("draft").notNull(),
  priority: int("priority").default(2).notNull(),
  reviewNotes: text("reviewNotes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type CreativeBrief = typeof creativeBriefs.$inferSelect;
export type InsertCreativeBrief = typeof creativeBriefs.$inferInsert;

// Visual assets generated from approved creative briefs. Assets remain internal until human review.
export const creativeAssets = mysqlTable("creative_assets", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull(),
  briefId: int("briefId").notNull(),
  imageUrl: text("imageUrl").notNull(),
  generationPrompt: text("generationPrompt").notNull(),
  aspectRatio: varchar("aspectRatio", { length: 20 }).default("4:5").notNull(),
  status: mysqlEnum("status", ["generated", "approved", "rejected"]).default("generated").notNull(),
  reviewNotes: text("reviewNotes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type CreativeAsset = typeof creativeAssets.$inferSelect;
export type InsertCreativeAsset = typeof creativeAssets.$inferInsert;

// Authorized before/after source photos supplied by the client or agency.
export const beforeAfterPairs = mysqlTable("before_after_pairs", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull(),
  label: varchar("label", { length: 255 }).notNull(),
  beforeUrl: text("beforeUrl").notNull(),
  afterUrl: text("afterUrl").notNull(),
  consentConfirmed: boolean("consentConfirmed").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type BeforeAfterPair = typeof beforeAfterPairs.$inferSelect;
export type InsertBeforeAfterPair = typeof beforeAfterPairs.$inferInsert;

// Static ad visuals generated using an authorized before/after pair plus an approved brief.
export const beforeAfterCreatives = mysqlTable("before_after_creatives", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull(),
  pairId: int("pairId").notNull(),
  briefId: int("briefId").notNull(),
  imageUrl: text("imageUrl").notNull(),
  generationPrompt: text("generationPrompt").notNull(),
  aspectRatio: varchar("aspectRatio", { length: 20 }).default("4:5").notNull(),
  status: mysqlEnum("status", ["generated", "approved", "rejected"]).default("generated").notNull(),
  reviewNotes: text("reviewNotes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type BeforeAfterCreative = typeof beforeAfterCreatives.$inferSelect;
export type InsertBeforeAfterCreative = typeof beforeAfterCreatives.$inferInsert;

// Audit trail for public-report access. Tokens are never stored in raw form.
export const publicReportAccessLogs = mysqlTable("public_report_access_logs", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull(),
  managerId: int("managerId"),
  eventType: varchar("eventType", { length: 40 }).notNull(),
  tokenFingerprint: varchar("tokenFingerprint", { length: 64 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type PublicReportAccessLog = typeof publicReportAccessLogs.$inferSelect;
export type InsertPublicReportAccessLog = typeof publicReportAccessLogs.$inferInsert;

// States OAuth com nonce armazenado somente como hash, para uso único em autoscale.
export const oauthStates = mysqlTable("oauth_states", {
  id: int("id").autoincrement().primaryKey(),
  nonceHash: varchar("nonceHash", { length: 64 }).notNull().unique(),
  clientId: int("clientId").notNull(),
  managerId: int("managerId"),
  expiresAt: timestamp("expiresAt").notNull(),
  consumedAt: timestamp("consumedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("oauth_states_expiresAt_idx").on(table.expiresAt)]);
export type OAuthState = typeof oauthStates.$inferSelect;
