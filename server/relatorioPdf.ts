/**
 * Gera o PDF do relatório público com um Chromium sem janela.
 *
 * A gestora pediu para o cliente receber um documento, não um link. O PDF
 * é a própria página do relatório impressa (mesmo layout, mesmas regras de
 * impressão em PrintStyles), então não há um segundo desenho para manter.
 *
 * O navegador vem do sistema (pacote `chromium` no Railway, via
 * nixpacks.toml) ou de CHROMIUM_PATH; playwright-core só o controla, sem
 * baixar nada. Sem navegador disponível, o envio cai para o link.
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";

export const VARIAVEL_CHROMIUM = "CHROMIUM_PATH";
const NOMES_NO_PATH = ["chromium", "chromium-browser", "google-chrome", "google-chrome-stable"];

/** Caminhos a tentar, em ordem, a partir do ambiente. Puro, para teste. */
export function candidatosExecutavel(env: Record<string, string | undefined>): string[] {
  return [env[VARIAVEL_CHROMIUM], env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH, "/opt/pw-browsers/chromium"]
    .map((c) => c?.trim())
    .filter((c): c is string => Boolean(c));
}

/**
 * Primeiro candidato que existe; senão, o primeiro nome achado no PATH.
 * `existe` e `noPath` são injetáveis para o teste não depender da máquina.
 */
export function resolverExecutavel(
  env: Record<string, string | undefined>,
  existe: (caminho: string) => boolean = existsSync,
  noPath: (nome: string) => string | null = procurarNoPath,
): string | null {
  for (const c of candidatosExecutavel(env)) if (existe(c)) return c;
  for (const n of NOMES_NO_PATH) { const p = noPath(n); if (p) return p; }
  return null;
}

function procurarNoPath(nome: string): string | null {
  try {
    return execFileSync("which", [nome], { stdio: ["ignore", "pipe", "ignore"] }).toString().trim() || null;
  } catch {
    return null;
  }
}

let executavel: string | null | undefined;
function executavelAtual(): string | null {
  if (executavel === undefined) executavel = resolverExecutavel(process.env);
  return executavel;
}

export function pdfDisponivel(): boolean {
  return executavelAtual() !== null;
}

/** Um PDF por vez: Chromium é pesado e o servidor é pequeno. */
let fila: Promise<unknown> = Promise.resolve();

export type OpcoesPdf = { timeoutMs?: number };

/**
 * Abre `url`, espera a página marcar `data-ready="1"` (dados carregados) e
 * imprime em A4 com as regras de impressão da própria página. Se a página
 * marcar `data-erro`, lança com a mensagem dela em vez de gerar um PDF de
 * tela de erro.
 */
export function gerarPdfRelatorio(url: string, opcoes: OpcoesPdf = {}): Promise<Buffer> {
  const tarefa = fila.then(() => gerar(url, opcoes));
  fila = tarefa.catch(() => undefined);
  return tarefa;
}

async function gerar(url: string, { timeoutMs = 60_000 }: OpcoesPdf): Promise<Buffer> {
  const exe = executavelAtual();
  if (!exe) throw new Error(`Chromium não encontrado no servidor (defina ${VARIAVEL_CHROMIUM} ou instale o pacote chromium).`);

  const navegador = await chromium.launch({ executablePath: exe, args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"] });
  try {
    const pagina = await navegador.newPage({ viewport: { width: 1100, height: 1400 }, deviceScaleFactor: 2 });
    await pagina.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    await pagina.waitForSelector('[data-ready="1"]', { timeout: timeoutMs });
    const erro = await pagina.getAttribute('[data-ready="1"]', "data-erro");
    if (erro) throw new Error(erro);
    await pagina.evaluate(() => document.fonts.ready);
    // Imagens de posts e criativos carregam depois dos dados.
    await pagina.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
    await pagina.emulateMedia({ media: "print" });
    return await pagina.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
  } finally {
    await navegador.close().catch(() => undefined);
  }
}
