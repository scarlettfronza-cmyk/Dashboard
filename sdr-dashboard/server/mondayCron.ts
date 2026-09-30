/**
 * Atualização automática dos snapshots do Monday.
 *
 * No Manus, a plataforma chamava POST /api/scheduled/sync-monday a cada 15
 * minutos. Fora dela o servidor fica sempre ligado (Railway), então o próprio
 * processo agenda as rodadas. Cada rodada atualiza poucos boards, os que estão
 * há mais tempo sem tentativa (`sincronizar` com `limite`), para não esbarrar
 * no limite de requisições do Monday nem prender as atualizações manuais.
 */
import { ENV } from "./_core/env";
import { sincronizar } from "./sync";

export const INTERVALO_MS = 5 * 60 * 1000;
export const BOARDS_POR_RODADA = 3;

export async function rodadaMonday() {
  if (!ENV.mondayApiToken || !ENV.databaseUrl) return { ok: 0, falhas: 0 };
  return sincronizar(undefined, {
    limite: BOARDS_POR_RODADA,
    maxAttempts: 2,
    requestTimeoutMs: 15_000,
    boardTimeoutMs: 60_000,
  });
}

let timer: NodeJS.Timeout | null = null;

export function startMondayCron() {
  if (timer) return;
  if (!ENV.mondayApiToken) {
    console.warn("[sync] MONDAY_API_TOKEN ausente: atualização automática desligada.");
    return;
  }
  const agendar = (atraso: number) => {
    timer = setTimeout(async () => {
      try {
        await rodadaMonday();
      } catch (error) {
        console.error("[sync] falha na rodada automática:", error);
      }
      agendar(INTERVALO_MS);
    }, atraso);
    timer.unref();
  };
  // Primeira rodada logo após subir, para não esperar 5 minutos depois de um deploy.
  agendar(30_000);
  console.log(`[sync] atualização automática a cada ${INTERVALO_MS / 60000} min, ${BOARDS_POR_RODADA} boards por rodada.`);
}
