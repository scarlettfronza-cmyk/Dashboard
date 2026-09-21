/**
 * Carrega um dump SQL no banco configurado em DATABASE_URL.
 *
 * Existe para que restaurar o backup não exija instalar cliente MySQL nem
 * Docker: basta a variável de ambiente que a própria aplicação já usa.
 *
 *   pnpm restaurar-backup ./backup.sql
 *
 * Por segurança, recusa rodar num banco que já tenha dados, a menos que
 * --forcar seja passado explicitamente.
 */
import { readFileSync } from "node:fs";
import mysql from "mysql2/promise";
import { splitSqlStatements } from "./sqlStatements";

const VERDE = "\x1b[32m", VERMELHO = "\x1b[31m", AMARELO = "\x1b[33m", FIM = "\x1b[0m";

async function main() {
  const args = process.argv.slice(2);
  const forcar = args.includes("--forcar");
  const arquivo = args.find((a) => !a.startsWith("--"));

  if (!arquivo) {
    console.error(`${VERMELHO}Informe o arquivo:${FIM} pnpm restaurar-backup ./backup.sql`);
    process.exit(1);
  }
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error(`${VERMELHO}DATABASE_URL não está definida.${FIM}`);
    console.error("Defina-a com a conexão do banco antes de rodar este script.");
    process.exit(1);
  }

  console.log(`Lendo ${arquivo}...`);
  const sql = readFileSync(arquivo, "utf8");
  const comandos = splitSqlStatements(sql);
  console.log(`${comandos.length} comandos encontrados.\n`);

  const conn = await mysql.createConnection({ uri: url, multipleStatements: false });

  try {
    const [tabelas] = await conn.query<mysql.RowDataPacket[]>("SHOW TABLES");
    if (tabelas.length > 0 && !forcar) {
      console.error(`${AMARELO}O banco já tem ${tabelas.length} tabela(s).${FIM}`);
      console.error("Restaurar por cima pode sobrescrever dados.");
      console.error("Se tem certeza, rode de novo com --forcar no final.");
      process.exit(1);
    }

    await conn.query("SET FOREIGN_KEY_CHECKS = 0");
    let ok = 0;
    const falhas: Array<{ i: number; erro: string; trecho: string }> = [];

    for (let i = 0; i < comandos.length; i++) {
      try {
        await conn.query(comandos[i]);
        ok++;
      } catch (e) {
        falhas.push({
          i: i + 1,
          erro: e instanceof Error ? e.message : String(e),
          trecho: comandos[i].slice(0, 120),
        });
      }
      if ((i + 1) % 200 === 0 || i === comandos.length - 1) {
        process.stdout.write(`\r  ${i + 1}/${comandos.length} comandos...`);
      }
    }
    await conn.query("SET FOREIGN_KEY_CHECKS = 1");
    console.log("\n");

    const [depois] = await conn.query<mysql.RowDataPacket[]>("SHOW TABLES");
    console.log(`${VERDE}${ok} comandos aplicados.${FIM} O banco tem ${depois.length} tabela(s).`);

    for (const t of depois) {
      const nome = Object.values(t)[0] as string;
      const [[{ n }]] = await conn.query<mysql.RowDataPacket[][]>(
        `SELECT COUNT(*) AS n FROM \`${nome}\``,
      );
      console.log(`  ${nome.padEnd(24)} ${String(n).padStart(6)} registro(s)`);
    }

    if (falhas.length) {
      console.log(`\n${AMARELO}${falhas.length} comando(s) falharam:${FIM}`);
      for (const f of falhas.slice(0, 10)) {
        console.log(`  #${f.i}: ${f.erro}`);
        console.log(`     ${f.trecho}...`);
      }
      if (falhas.length > 10) console.log(`  ... e mais ${falhas.length - 10}.`);
      process.exitCode = 1;
    }
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error(`${VERMELHO}Falhou:${FIM}`, e instanceof Error ? e.message : e);
  process.exit(1);
});
