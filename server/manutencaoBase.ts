/**
 * Limpeza de registros órfãos na subida do servidor.
 *
 * O backup trouxe 974 vendas presas a um cliente que já não existia (id 1,
 * uma cópia antiga do quadro do Dr. Mario). Nenhuma tela chega nelas, mas
 * ocupam espaço e confundem contagens. Hoje apagar um cliente já leva os
 * dados dele junto; isto cuida do que ficou para trás antes disso.
 *
 * Nunca derruba o servidor: sem banco ou com falha, registra e segue.
 */
import mysql from "mysql2/promise";

/** Tabelas com coluna clientId. Só as que existirem no banco são tocadas. */
export const TABELAS_COM_CLIENTE = [
  "sales_records", "integrations", "manager_clients", "snapshots", "report_config",
  "report_chat_history", "lead_ad_matches", "capi_events", "creative_analyses",
  "creative_briefs", "creative_assets", "before_after_pairs", "before_after_creatives",
  "public_report_access_logs", "oauth_states",
] as const;

export function sqlApagarOrfaos(tabela: string): string {
  return `DELETE t FROM \`${tabela}\` t LEFT JOIN \`clients\` c ON c.id = t.clientId WHERE c.id IS NULL`;
}

export async function limparOrfaos(url = process.env.DATABASE_URL): Promise<Record<string, number>> {
  const apagados: Record<string, number> = {};
  if (!url) return apagados;
  let conn: mysql.Connection | undefined;
  try {
    conn = await mysql.createConnection({ uri: url });
    const [linhas] = await conn.query<mysql.RowDataPacket[]>("SHOW TABLES");
    const existentes = new Set(linhas.map((l) => String(Object.values(l)[0]).toLowerCase()));
    if (!existentes.has("clients")) return apagados;
    for (const t of TABELAS_COM_CLIENTE) {
      if (!existentes.has(t)) continue;
      const [r] = await conn.query<mysql.ResultSetHeader>(sqlApagarOrfaos(t));
      if (r.affectedRows > 0) apagados[t] = r.affectedRows;
    }
    const total = Object.values(apagados).reduce((a, b) => a + b, 0);
    if (total) console.log(`[Manutenção] Registros órfãos apagados: ${JSON.stringify(apagados)}`);
  } catch (e) {
    console.error("[Manutenção] Não foi possível limpar órfãos:", e instanceof Error ? e.message : e);
  } finally {
    await conn?.end().catch(() => {});
  }
  return apagados;
}
