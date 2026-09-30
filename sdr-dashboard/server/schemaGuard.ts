/**
 * Na subida do servidor (e depois de uma importação), cria as tabelas e
 * colunas que o código espera e o banco ainda não tem.
 *
 * Cobre os dois caminhos de instalação fora do Manus:
 *  - banco novo, sem backup: cria todas as tabelas;
 *  - backup do Manus importado: o dump traz a estrutura de lá, e aqui só
 *    entram as colunas novas (ex.: grupo do WhatsApp da clínica).
 *
 * A decisão do que rodar (`comandosFaltando`) é pura e testada à parte.
 * Nunca derruba o servidor: sem banco ou com falha, registra e segue.
 */
import mysql from "mysql2/promise";

export const TABELAS: Record<string, string> = {
  users: `CREATE TABLE IF NOT EXISTS \`users\` (
  \`id\` int AUTO_INCREMENT NOT NULL,
  \`openId\` varchar(64) NOT NULL,
  \`name\` text,
  \`email\` varchar(320),
  \`passwordHash\` varchar(255),
  \`loginMethod\` varchar(64),
  \`role\` enum('user','admin') NOT NULL DEFAULT 'user',
  \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`updatedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  \`lastSignedIn\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`users_openId_unique\` (\`openId\`),
  UNIQUE KEY \`users_email_unique\` (\`email\`)
)`,
  sdrs: `CREATE TABLE IF NOT EXISTS \`sdrs\` (
  \`id\` int AUTO_INCREMENT NOT NULL,
  \`userId\` int NOT NULL,
  \`name\` varchar(128) NOT NULL,
  \`email\` varchar(320) NOT NULL,
  \`boardIds\` text NOT NULL,
  \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`updatedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`sdrs_userId_unique\` (\`userId\`)
)`,
  clients: `CREATE TABLE IF NOT EXISTS \`clients\` (
  \`id\` int AUTO_INCREMENT NOT NULL,
  \`sdrId\` int NOT NULL,
  \`name\` varchar(256) NOT NULL,
  \`boardId\` varchar(1024) NOT NULL,
  \`clientToken\` varchar(64) NOT NULL,
  \`isActive\` boolean NOT NULL DEFAULT true,
  \`whatsappGroupId\` varchar(128),
  \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`updatedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`clients_clientToken_unique\` (\`clientToken\`),
  KEY \`clients_sdr_idx\` (\`sdrId\`)
)`,
  chat_messages: `CREATE TABLE IF NOT EXISTS \`chat_messages\` (
  \`id\` int AUTO_INCREMENT NOT NULL,
  \`sdrId\` int NOT NULL,
  \`clientId\` int,
  \`role\` enum('user','assistant','system') NOT NULL,
  \`content\` text NOT NULL,
  \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  KEY \`chat_messages_sdr_client_idx\` (\`sdrId\`, \`clientId\`)
)`,
  ai_reports: `CREATE TABLE IF NOT EXISTS \`ai_reports\` (
  \`id\` int AUTO_INCREMENT NOT NULL,
  \`sdrId\` int NOT NULL,
  \`clientId\` int NOT NULL,
  \`title\` varchar(256) NOT NULL,
  \`content\` text NOT NULL,
  \`period\` varchar(64),
  \`periodStart\` varchar(10),
  \`periodEnd\` varchar(10),
  \`metricsSnapshot\` text,
  \`status\` enum('draft','published') NOT NULL DEFAULT 'draft',
  \`publishedAt\` timestamp NULL,
  \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`updatedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  KEY \`ai_reports_client_status_idx\` (\`clientId\`, \`status\`)
)`,
  board_snapshots: `CREATE TABLE IF NOT EXISTS \`board_snapshots\` (
  \`boardId\` varchar(32) NOT NULL,
  \`boardName\` varchar(256),
  \`payload\` longtext NOT NULL,
  \`leadCount\` int NOT NULL DEFAULT 0,
  \`syncedAt\` timestamp NULL,
  \`lastAttemptAt\` timestamp NULL,
  \`lastError\` varchar(512),
  \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`updatedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (\`boardId\`)
)`,
};

/**
 * Colunas que surgiram depois da criação das tabelas. Um backup antigo do
 * Manus pode não ter alguma delas; a tabela nova já nasce com todas.
 */
export const COLUNAS: { tabela: string; coluna: string; definicao: string }[] = [
  { tabela: "users", coluna: "passwordHash", definicao: "varchar(255) NULL" },
  { tabela: "clients", coluna: "whatsappGroupId", definicao: "varchar(128) NULL" },
  { tabela: "ai_reports", coluna: "periodStart", definicao: "varchar(10) NULL" },
  { tabela: "ai_reports", coluna: "periodEnd", definicao: "varchar(10) NULL" },
  { tabela: "ai_reports", coluna: "metricsSnapshot", definicao: "text NULL" },
  { tabela: "ai_reports", coluna: "status", definicao: "enum('draft','published') NOT NULL DEFAULT 'draft'" },
  { tabela: "ai_reports", coluna: "publishedAt", definicao: "timestamp NULL" },
];

/** Estado atual do banco: tabela → colunas existentes. */
export type EstadoBanco = Map<string, Set<string>>;

export function comandosFaltando(estado: EstadoBanco): { criar: string[]; alterar: string[] } {
  const criar = Object.keys(TABELAS).filter(t => !estado.has(t));
  const alterar = COLUNAS.filter(c => estado.has(c.tabela) && !estado.get(c.tabela)!.has(c.coluna)).map(
    c => `ALTER TABLE \`${c.tabela}\` ADD COLUMN \`${c.coluna}\` ${c.definicao}`,
  );
  return { criar: criar.map(t => TABELAS[t]), alterar };
}

async function lerEstado(conn: mysql.Connection): Promise<EstadoBanco> {
  const [linhas] = await conn.query<mysql.RowDataPacket[]>(
    "SELECT TABLE_NAME AS t, COLUMN_NAME AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE()",
  );
  const estado: EstadoBanco = new Map();
  for (const l of linhas) {
    const t = String(l.t);
    if (!estado.has(t)) estado.set(t, new Set());
    estado.get(t)!.add(String(l.c));
  }
  return estado;
}

export async function garantirEsquema(url = process.env.DATABASE_URL): Promise<{ aplicados: string[]; falhas: string[] }> {
  const resultado = { aplicados: [] as string[], falhas: [] as string[] };
  if (!url) return resultado;

  let conn: mysql.Connection | undefined;
  try {
    conn = await mysql.createConnection({ uri: url, multipleStatements: false });
    const { criar, alterar } = comandosFaltando(await lerEstado(conn));
    for (const sql of [...criar, ...alterar]) {
      const rotulo = sql.split("(")[0].replace(/\s+/g, " ").trim();
      try {
        await conn.query(sql);
        resultado.aplicados.push(rotulo);
      } catch (e) {
        resultado.falhas.push(`${rotulo}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    if (resultado.aplicados.length) console.log(`[Esquema] ${resultado.aplicados.join("; ")}`);
    for (const f of resultado.falhas) console.error(`[Esquema] Falha: ${f}`);
  } catch (e) {
    console.error("[Esquema] Não foi possível conferir o banco:", e instanceof Error ? e.message : e);
  } finally {
    await conn?.end().catch(() => {});
  }
  return resultado;
}
