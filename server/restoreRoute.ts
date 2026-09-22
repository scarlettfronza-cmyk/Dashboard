/**
 * Importação do backup pelo navegador.
 *
 * Existe para que a carga inicial do banco não exija terminal nem instalação
 * de nada. A rota só passa a existir quando RESTORE_TOKEN está definida no
 * ambiente; sem ela, responde como se não existisse.
 *
 * As regras de proteção ficam em restoreGuards.ts, testadas à parte.
 */
import type { Express, Request, Response } from "express";
import express from "express";
import mysql from "mysql2/promise";
import { garantirTabelas } from "./schemaGuard";
import { splitSqlStatements } from "../scripts/sqlStatements";
import {
  autorizar, bancoAceitaCarga, arquivoUtilizavel, importacaoHabilitada,
} from "./restoreGuards";

/** Quantas tabelas do banco têm ao menos um registro. */
async function tabelasComDados(conn: mysql.Connection): Promise<number> {
  const [tabelas] = await conn.query<mysql.RowDataPacket[]>("SHOW TABLES");
  let n = 0;
  for (const t of tabelas) {
    const nome = Object.values(t)[0] as string;
    const [linhas] = await conn.query<mysql.RowDataPacket[]>(
      `SELECT COUNT(*) AS n FROM \`${nome}\``,
    );
    if (Number(linhas[0]?.n ?? 0) > 0) n++;
  }
  return n;
}

export function registerRestoreRoute(app: Express) {
  // Estado da importação, para a tela saber se deve se oferecer.
  app.get("/api/importar/status", (_req: Request, res: Response) => {
    res.json({ habilitada: importacaoHabilitada(process.env) });
  });

  app.post(
    "/api/importar",
    express.json({ limit: "60mb" }),
    async (req: Request, res: Response) => {
      const permissao = autorizar(process.env, req.body?.senha);
      if (!permissao.ok) {
        // Senha errada e rota desligada devolvem o mesmo código, para não
        // revelar a alguém de fora se a importação existe neste ambiente.
        const status = permissao.motivo === "desativado" ? 404 : 401;
        return res.status(status).json({ erro: permissao.detalhe });
      }

      const arquivo = arquivoUtilizavel(req.body?.sql);
      if (!arquivo.ok) return res.status(400).json({ erro: arquivo.detalhe });

      const url = process.env.DATABASE_URL;
      if (!url) {
        // Mensagem acionável: a causa quase sempre é a variável não ter sido
        // ligada ao banco na hospedagem, e o texto genérico não ajudava.
        return res.status(500).json({
          erro: "O banco não está ligado a este serviço. Defina DATABASE_URL nas variáveis de ambiente apontando para o banco — na Railway, o valor é ${{MySQL.MYSQL_URL}}.",
        });
      }

      let conn: mysql.Connection | undefined;
      try {
        conn = await mysql.createConnection({ uri: url, multipleStatements: false });

        const cheio = await tabelasComDados(conn);
        const aceita = bancoAceitaCarga(cheio);
        if (!aceita.ok) return res.status(409).json({ erro: aceita.detalhe });

        const comandos = splitSqlStatements(req.body.sql as string);
        await conn.query("SET FOREIGN_KEY_CHECKS = 0");

        let aplicados = 0;
        const falhas: string[] = [];
        for (const c of comandos) {
          try {
            await conn.query(c);
            aplicados++;
          } catch (e) {
            falhas.push(e instanceof Error ? e.message : String(e));
          }
        }
        await conn.query("SET FOREIGN_KEY_CHECKS = 1");

        // O dump traz só as tabelas que existiam na origem; o código espera mais.
        const completadas = await garantirTabelas(url);

        // Contagem final, para a tela mostrar o que de fato entrou.
        const [tabelas] = await conn.query<mysql.RowDataPacket[]>("SHOW TABLES");
        const resumo: Array<{ tabela: string; registros: number }> = [];
        for (const t of tabelas) {
          const nome = Object.values(t)[0] as string;
          const [linhas] = await conn.query<mysql.RowDataPacket[]>(
            `SELECT COUNT(*) AS n FROM \`${nome}\``,
          );
          resumo.push({ tabela: nome, registros: Number(linhas[0]?.n ?? 0) });
        }

        console.log(`[Importação] ${aplicados}/${comandos.length} comandos aplicados, ${falhas.length} falha(s).`);
        res.json({
          ok: true,
          comandos: comandos.length,
          aplicados,
          falhas: falhas.slice(0, 10),
          totalFalhas: falhas.length,
          resumo: resumo.filter((r) => r.registros > 0),
          tabelasCriadas: completadas.criadas,
        });
      } catch (e) {
        console.error("[Importação] Erro:", e);
        res.status(500).json({ erro: e instanceof Error ? e.message : "Falha na importação." });
      } finally {
        await conn?.end().catch(() => {});
      }
    },
  );
}
