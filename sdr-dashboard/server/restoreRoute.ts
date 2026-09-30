/**
 * Importação do backup do Manus pelo navegador (/importar).
 *
 * Mesmo desenho do dashboard de tráfego: a rota só existe enquanto
 * RESTORE_TOKEN estiver definida no ambiente, exige essa senha e recusa um
 * banco que já tenha dados. As regras ficam em restoreGuards.ts, testadas.
 *
 * Na subida o servidor já cria as tabelas vazias (schemaGuard). Para o dump
 * entrar com a estrutura exata de origem, cada tabela que o dump recria é
 * apagada antes, o que é seguro porque todas estão vazias. Depois da carga,
 * `garantirEsquema` acrescenta as colunas que o Manus não tinha.
 */
import type { Express, Request, Response } from "express";
import express from "express";
import mysql from "mysql2/promise";
import { garantirEsquema } from "./schemaGuard";
import { comandoIgnorado, splitSqlStatements, tabelaCriada } from "./sqlStatements";
import { arquivoUtilizavel, autorizar, bancoAceitaCarga, operacaoHabilitada } from "./restoreGuards";

async function contarRegistros(conn: mysql.Connection): Promise<Array<{ tabela: string; registros: number }>> {
  const [tabelas] = await conn.query<mysql.RowDataPacket[]>("SHOW TABLES");
  const resumo: Array<{ tabela: string; registros: number }> = [];
  for (const t of tabelas) {
    const nome = String(Object.values(t)[0]);
    const [linhas] = await conn.query<mysql.RowDataPacket[]>(`SELECT COUNT(*) AS n FROM \`${nome}\``);
    resumo.push({ tabela: nome, registros: Number(linhas[0]?.n ?? 0) });
  }
  return resumo;
}

export function registerRestoreRoute(app: Express) {
  app.get("/api/importar/status", (_req: Request, res: Response) => {
    res.json({ habilitada: operacaoHabilitada(process.env, "RESTORE_TOKEN") });
  });

  app.post("/api/importar", express.json({ limit: "60mb" }), async (req: Request, res: Response) => {
    const permissao = autorizar(process.env, req.body?.senha, "RESTORE_TOKEN");
    if (!permissao.ok) {
      // Senha errada e rota desligada não se distinguem para quem está de fora.
      return res.status(permissao.motivo === "desativado" ? 404 : 401).json({ erro: permissao.detalhe });
    }

    const arquivo = arquivoUtilizavel(req.body?.sql);
    if (!arquivo.ok) return res.status(400).json({ erro: arquivo.detalhe });

    const url = process.env.DATABASE_URL;
    if (!url) {
      return res.status(500).json({
        erro: "O banco não está ligado a este serviço. Defina DATABASE_URL nas variáveis de ambiente; na Railway, o valor é ${{MySQL.MYSQL_URL}}.",
      });
    }

    let conn: mysql.Connection | undefined;
    try {
      conn = await mysql.createConnection({ uri: url, multipleStatements: false });

      const antes = await contarRegistros(conn);
      const aceita = bancoAceitaCarga(antes.filter(r => r.registros > 0).length);
      if (!aceita.ok) return res.status(409).json({ erro: aceita.detalhe });

      const comandos = splitSqlStatements(req.body.sql as string).filter(c => !comandoIgnorado(c));
      await conn.query("SET FOREIGN_KEY_CHECKS = 0");

      let aplicados = 0;
      const falhas: string[] = [];
      for (const c of comandos) {
        try {
          const tabela = tabelaCriada(c);
          if (tabela) await conn.query(`DROP TABLE IF EXISTS \`${tabela}\``);
          await conn.query(c);
          aplicados++;
        } catch (e) {
          falhas.push(e instanceof Error ? e.message : String(e));
        }
      }
      await conn.query("SET FOREIGN_KEY_CHECKS = 1");

      const esquema = await garantirEsquema(url);
      const resumo = await contarRegistros(conn);

      console.log(`[Importação] ${aplicados}/${comandos.length} comandos aplicados, ${falhas.length} falha(s).`);
      res.json({
        ok: true,
        comandos: comandos.length,
        aplicados,
        falhas: falhas.slice(0, 10),
        totalFalhas: falhas.length,
        resumo: resumo.filter(r => r.registros > 0),
        ajustes: esquema.aplicados,
      });
    } catch (e) {
      console.error("[Importação] Erro:", e);
      res.status(500).json({ erro: e instanceof Error ? e.message : "Falha na importação." });
    } finally {
      await conn?.end().catch(() => {});
    }
  });
}
