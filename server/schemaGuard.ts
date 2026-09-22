/**
 * Na subida (e depois de uma importação), cria as tabelas que o código
 * espera e o banco não tem. Lê as migrações do Drizzle em `drizzle/` e usa
 * a parte pura de schemaFaltante.ts para decidir o que rodar.
 *
 * Nunca derruba o servidor: sem banco, ou com falha, registra no log e
 * segue — a tela de importação e a de recuperação precisam abrir mesmo
 * com o banco vazio.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";
import { resolveModuleDir } from "./_core/moduleDir";
import { comandosParaTabela, tabelasDasMigracoes, tabelasFaltando } from "./schemaFaltante";

function lerMigracoes(): string[] {
  const aqui = resolveModuleDir(import.meta.dirname, import.meta.url);
  // Em desenvolvimento este arquivo está em server/; no build, em dist/.
  const candidatos = [path.resolve(aqui, "../drizzle"), path.resolve(process.cwd(), "drizzle")];
  const dir = candidatos.find((d) => { try { return readdirSync(d).length > 0; } catch { return false; } });
  if (!dir) return [];
  return readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()
    .map((f) => readFileSync(path.join(dir, f), "utf8"));
}

export async function garantirTabelas(url = process.env.DATABASE_URL): Promise<{ criadas: string[]; falhas: string[] }> {
  const resultado = { criadas: [] as string[], falhas: [] as string[] };
  if (!url) return resultado;

  const migracoes = lerMigracoes();
  if (!migracoes.length) {
    console.warn("[Schema] Pasta drizzle/ não encontrada; não dá para conferir as tabelas.");
    return resultado;
  }

  let conn: mysql.Connection | undefined;
  try {
    conn = await mysql.createConnection({ uri: url, multipleStatements: false });
    const [linhas] = await conn.query<mysql.RowDataPacket[]>("SHOW TABLES");
    const existentes = linhas.map((l) => String(Object.values(l)[0]));
    // Banco vazio é a tela de importação que resolve; aqui só completamos.
    if (existentes.length === 0) return resultado;

    for (const tabela of tabelasFaltando(tabelasDasMigracoes(migracoes), existentes)) {
      try {
        for (const c of comandosParaTabela(migracoes, tabela)) await conn.query(c);
        resultado.criadas.push(tabela);
      } catch (e) {
        resultado.falhas.push(`${tabela}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    if (resultado.criadas.length) console.log(`[Schema] Tabelas criadas: ${resultado.criadas.join(", ")}`);
    for (const f of resultado.falhas) console.error(`[Schema] Falha ao criar ${f}`);
  } catch (e) {
    console.error("[Schema] Não foi possível conferir as tabelas:", e instanceof Error ? e.message : e);
  } finally {
    await conn?.end().catch(() => {});
  }
  return resultado;
}
