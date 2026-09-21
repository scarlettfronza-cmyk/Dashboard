/**
 * Diretório do módulo, de forma independente da versão do Node.
 *
 * `import.meta.dirname` só existe a partir do Node 20.11. Em versões
 * anteriores ele vem `undefined`, e o `path.resolve` que o recebe quebra na
 * carga do módulo, derrubando o servidor com um erro que não diz qual é o
 * problema real. Como a versão do Node em produção é escolhida pela
 * hospedagem, convém não depender dela.
 */
import path from "path";
import { fileURLToPath } from "url";

/** Resolve o diretório a partir do `dirname` nativo ou, na falta, da URL. */
export function resolveModuleDir(dirname: string | undefined, url: string): string {
  if (dirname) return dirname;
  return path.dirname(fileURLToPath(url));
}
