/**
 * Divisão de um dump SQL em comandos individuais.
 *
 * Separada do script de restauração para poder ser testada sem banco: um
 * `;` dentro de texto, de comentário ou escapado não encerra o comando, e
 * errar isso corrompe a carga silenciosamente.
 */

export function splitSqlStatements(sql: string): string[] {
  const out: string[] = [];
  let cur = "";
  let aspas: "'" | '"' | "`" | null = null;
  let i = 0;

  while (i < sql.length) {
    const c = sql[i];
    const prox = sql[i + 1];

    if (aspas) {
      if (c === "\\" && aspas !== "`") { cur += c + (prox ?? ""); i += 2; continue; }
      // Aspas duplicadas dentro do texto ('' ou "") são escape, não fechamento.
      if (c === aspas && prox === aspas) { cur += c + prox; i += 2; continue; }
      if (c === aspas) { aspas = null; cur += c; i++; continue; }
      cur += c; i++; continue;
    }

    // Comentário de linha: -- ou #
    if ((c === "-" && prox === "-") || c === "#") {
      const fim = sql.indexOf("\n", i);
      i = fim === -1 ? sql.length : fim + 1;
      cur += "\n";
      continue;
    }
    // Comentário de bloco. Os executáveis do MySQL (/*! ... */) são preservados.
    if (c === "/" && prox === "*") {
      const executavel = sql[i + 2] === "!";
      const fim = sql.indexOf("*/", i + 2);
      const trecho = fim === -1 ? sql.slice(i) : sql.slice(i, fim + 2);
      if (executavel) cur += trecho;
      i = fim === -1 ? sql.length : fim + 2;
      continue;
    }

    if (c === "'" || c === '"' || c === "`") { aspas = c as "'" | '"' | "`"; cur += c; i++; continue; }

    if (c === ";") {
      const t = cur.trim();
      if (t) out.push(t);
      cur = ""; i++; continue;
    }

    cur += c; i++;
  }

  const resto = cur.trim();
  if (resto) out.push(resto);
  return out;
}

/** Nome da tabela de um `CREATE TABLE`, ou null se o comando for outro. */
export function tabelaCriada(comando: string): string | null {
  const m = comando.match(/^\s*CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:`?\w+`?\.)?`?(\w+)`?/i);
  return m ? m[1] : null;
}

/**
 * Comandos do dump que não podem rodar aqui: trocar ou criar banco faria a
 * carga ir para outro lugar que não o banco ligado a este serviço.
 */
export function comandoIgnorado(comando: string): boolean {
  return /^\s*(USE|CREATE\s+(DATABASE|SCHEMA))\b/i.test(comando);
}
