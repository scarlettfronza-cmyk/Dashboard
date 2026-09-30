import { boolean, int, longtext, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  /**
   * Único: é a chave de login por senha. NULL é permitido e não colide, para
   * não quebrar contas antigas do Manus OAuth que não têm e-mail.
   */
  email: varchar("email", { length: 320 }).unique(),
  /**
   * Hash scrypt no formato "scrypt$N$r$p$saltHex$hashHex". NULL em contas que
   * entram só por OAuth. A senha em si nunca é gravada nem registrada em log.
   */
  passwordHash: varchar("passwordHash", { length: 255 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// SDR profiles
export const sdrs = mysqlTable("sdrs", {
  id: int("id").autoincrement().primaryKey(),
  /**
   * Único: um usuário tem no máximo um perfil de SDR. Sem esta restrição, duas
   * requisições simultâneas do mesmo usuário recém-logado criavam dois perfis,
   * e os clientes ficavam pendurados no perfil errado.
   */
  userId: int("userId").notNull().unique(),
  name: varchar("name", { length: 128 }).notNull(),
  /**
   * Não é mais único. O e-mail vem do OAuth e pode repetir (contas de teste,
   * fallback openId@sdr.local); a colisão derrubava o cadastro do segundo
   * usuário com o erro "Duplicate entry".
   */
  email: varchar("email", { length: 320 }).notNull(),
  boardIds: text("boardIds").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Sdr = typeof sdrs.$inferSelect;

// Client profiles with unique portal token
export const clients = mysqlTable("clients", {
  id: int("id").autoincrement().primaryKey(),
  sdrId: int("sdrId").notNull(),
  name: varchar("name", { length: 256 }).notNull(),
  /** IDs separados por vírgula; uma clínica pode reunir vários boards. */
  boardId: varchar("boardId", { length: 1024 }).notNull(),
  clientToken: varchar("clientToken", { length: 64 }).notNull().unique(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Client = typeof clients.$inferSelect;

// Chat messages (SDR <-> AI)
export const chatMessages = mysqlTable("chat_messages", {
  id: int("id").autoincrement().primaryKey(),
  sdrId: int("sdrId").notNull(),
  clientId: int("clientId"),
  role: mysqlEnum("role", ["user", "assistant", "system"]).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ChatMessage = typeof chatMessages.$inferSelect;

// AI analysis reports
export const aiReports = mysqlTable("ai_reports", {
  id: int("id").autoincrement().primaryKey(),
  sdrId: int("sdrId").notNull(),
  /** Obrigatório: um relatório sem cliente nunca aparece em portal nenhum. */
  clientId: int("clientId").notNull(),
  title: varchar("title", { length: 256 }).notNull(),
  content: text("content").notNull(),
  period: varchar("period", { length: 64 }),
  /** Intervalo efetivo do relatório, em datas locais YYYY-MM-DD. */
  periodStart: varchar("periodStart", { length: 10 }),
  periodEnd: varchar("periodEnd", { length: 10 }),
  /**
   * Métricas usadas para gerar este texto, em JSON. Torna o relatório
   * auditável e reproduzível mesmo depois que o board do Monday mudar.
   */
  metricsSnapshot: text("metricsSnapshot"),
  /**
   * O portal do cliente só exibe "published". Antes, todo rascunho e cada
   * revisão do mini-chat ficavam visíveis para o médico assim que gerados.
   */
  status: mysqlEnum("status", ["draft", "published"]).default("draft").notNull(),
  publishedAt: timestamp("publishedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type AiReport = typeof aiReports.$inferSelect;

/**
 * Cópia normalizada e local de cada board do Monday. As telas leem esta tabela
 * em vez de esperar a API externa, e a sincronização periódica a mantém atual.
 */
export const boardSnapshots = mysqlTable("board_snapshots", {
  boardId: varchar("boardId", { length: 32 }).primaryKey(),
  boardName: varchar("boardName", { length: 256 }),
  payload: longtext("payload").notNull(),
  leadCount: int("leadCount").notNull().default(0),
  syncedAt: timestamp("syncedAt"),
  lastAttemptAt: timestamp("lastAttemptAt"),
  lastError: varchar("lastError", { length: 512 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type BoardSnapshot = typeof boardSnapshots.$inferSelect;
