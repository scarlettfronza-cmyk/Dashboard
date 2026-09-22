/**
 * Completa o banco com as tabelas que o código espera e o backup não trouxe.
 *
 * O backup do Manus foi um dump das tabelas que existiam lá; o código já
 * esperava outras (registro de acesso ao relatório público, estados do
 * OAuth, criativos). Sem elas, a primeira gravação quebra a tela inteira —
 * foi o "Link inválido" no relatório do cliente. Em vez de exigir que a
 * gestora rode migração na mão, o servidor confere na subida e cria só o
 * que falta, a partir das próprias migrações do Drizzle.
 *
 * Aqui fica a parte pura (ler as migrações, escolher os comandos); quem
 * fala com o banco é `garantirTabelas` em schemaGuard.ts.
 */

const CREATE_TABLE = /^CREATE TABLE\s+`?([a-zA-Z_][a-zA-Z0-9_]*)`?/i;
const MEXE_NA_TABELA = [
  /^ALTER TABLE\s+`?([a-zA-Z_][a-zA-Z0-9_]*)`?/i,
  /^CREATE (?:UNIQUE )?INDEX\s+`?[^`\s]+`?\s+ON\s+`?([a-zA-Z_][a-zA-Z0-9_]*)`?/i,
];

/** Separa um arquivo de migração do Drizzle em comandos individuais. */
export function comandosDaMigracao(sql: string): string[] {
  return sql
    .split(/-->\s*statement-breakpoint/i)
    .map((c) => c.trim().replace(/;\s*$/, ""))
    .filter(Boolean);
}

/** Nome da tabela que o comando cria, ou null. */
export function tabelaCriada(comando: string): string | null {
  return CREATE_TABLE.exec(comando.trim())?.[1] ?? null;
}

/** Nome da tabela que o comando altera ou indexa, ou null. */
export function tabelaAlterada(comando: string): string | null {
  for (const re of MEXE_NA_TABELA) {
    const m = re.exec(comando.trim());
    if (m) return m[1];
  }
  return null;
}

/** Todas as tabelas que as migrações criam, na ordem. */
export function tabelasDasMigracoes(migracoes: string[]): string[] {
  const nomes: string[] = [];
  for (const sql of migracoes) for (const c of comandosDaMigracao(sql)) {
    const t = tabelaCriada(c);
    if (t && !nomes.includes(t)) nomes.push(t);
  }
  return nomes;
}

/**
 * Comandos para criar uma tabela ausente exatamente como as migrações a
 * deixariam: o CREATE e, depois dele, cada ALTER/INDEX dessa tabela em
 * migrações posteriores. `migracoes` precisa vir em ordem cronológica.
 */
export function comandosParaTabela(migracoes: string[], tabela: string): string[] {
  const saida: string[] = [];
  let criada = false;
  for (const sql of migracoes) for (const c of comandosDaMigracao(sql)) {
    if (!criada) {
      if (tabelaCriada(c) === tabela) {
        criada = true;
        saida.push(c.replace(CREATE_TABLE, `CREATE TABLE IF NOT EXISTS \`${tabela}\``));
      }
      continue;
    }
    if (tabelaAlterada(c) === tabela) saida.push(c);
  }
  return saida;
}

/** Quais tabelas esperadas não existem no banco. */
export function tabelasFaltando(esperadas: string[], existentes: string[]): string[] {
  const tem = new Set(existentes.map((t) => t.toLowerCase()));
  return esperadas.filter((t) => !tem.has(t.toLowerCase()));
}
