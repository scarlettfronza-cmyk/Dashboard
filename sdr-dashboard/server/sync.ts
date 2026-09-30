/**
 * Mantém uma cópia local normalizada dos boards ativos do Monday.
 *
 * O módulo não agenda a si mesmo: o disparo recorrente é uma chamada HTTP
 * autenticada da plataforma. Assim a atualização continua funcionando quando
 * instâncias autoscaladas são pausadas ou reiniciadas.
 */
import { inArray } from "drizzle-orm";
import { boardSnapshots, clients } from "../drizzle/schema";
import type { AtendimentoRecord, Lead } from "../shared/metrics";
import { getDb } from "./db";
import { fetchBoards, type BoardData, type BoardRef } from "./monday";

export interface SnapshotData {
  leads: Lead[];
  atendimentos: AtendimentoRecord[];
}

const payloadVazio = (): string => JSON.stringify({ leads: [], atendimentos: [] } satisfies SnapshotData);

function idsDoCliente(client: { boardId: string; name: string }): BoardRef[] {
  return client.boardId
    .split(",")
    .map(id => id.trim())
    .filter(Boolean)
    .map(id => ({ id, clientName: client.name }));
}

async function boardsAtivos(limite?: number): Promise<BoardRef[]> {
  const db = await getDb();
  if (!db) return [];

  const unique = new Map<string, BoardRef>();
  for (const client of await db.select().from(clients)) {
    if (!client.isActive) continue;
    for (const board of idsDoCliente(client)) {
      if (!unique.has(board.id)) unique.set(board.id, board);
    }
  }
  const refs = Array.from(unique.values());
  if (!limite || refs.length <= limite) return refs;

  // Prioriza boards que nunca foram atualizados e depois os que estão há mais
  // tempo sem tentativa. Desse modo cada rodada curta avança pela carteira em
  // vez de repetir sempre os primeiros IDs.
  const snapshots = await db
    .select({ boardId: boardSnapshots.boardId, lastAttemptAt: boardSnapshots.lastAttemptAt })
    .from(boardSnapshots)
    .where(inArray(boardSnapshots.boardId, refs.map(ref => ref.id)));
  const lastAttemptById = new Map(snapshots.map(snapshot => [snapshot.boardId, snapshot.lastAttemptAt?.getTime() ?? 0]));
  return refs.sort((a, b) => (lastAttemptById.get(a.id) ?? 0) - (lastAttemptById.get(b.id) ?? 0)).slice(0, limite);
}

async function salvarSucesso(board: BoardData): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const now = new Date();
  const payload = JSON.stringify({ leads: board.leads, atendimentos: board.atendimentos } satisfies SnapshotData);
  await db
    .insert(boardSnapshots)
    .values({
      boardId: board.boardId,
      boardName: board.boardName.slice(0, 256),
      payload,
      leadCount: board.leads.length,
      syncedAt: now,
      lastAttemptAt: now,
      lastError: null,
    })
    .onDuplicateKeyUpdate({
      set: {
        boardName: board.boardName.slice(0, 256),
        payload,
        leadCount: board.leads.length,
        syncedAt: now,
        lastAttemptAt: now,
        lastError: null,
      },
    });
}

async function registrarFalha(board: BoardData, motivo: string): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const now = new Date();
  await db
    .insert(boardSnapshots)
    .values({
      boardId: board.boardId,
      boardName: board.boardName.slice(0, 256),
      payload: payloadVazio(),
      leadCount: 0,
      syncedAt: null,
      lastAttemptAt: now,
      lastError: motivo.slice(0, 512),
    })
    .onDuplicateKeyUpdate({
      // Preserva a última carga íntegra. Uma falha não pode substituir dados
      // existentes por um board vazio nem apagar a data de sincronização.
      set: { lastAttemptAt: now, lastError: motivo.slice(0, 512) },
    });
}

let syncGlobalEmAndamento: Promise<{ ok: number; falhas: number }> | null = null;

/** Sincroniza as referências indicadas, ou todos os boards ativos quando omitidas. */
export interface SyncOptions {
  limite?: number;
  maxAttempts?: number;
  requestTimeoutMs?: number;
  boardTimeoutMs?: number;
  /** Para uma ação manual, não prolonga a espera quando o Monday já recusou a tentativa. */
  stopOnFailure?: boolean;
}

export async function sincronizar(
  referencias?: BoardRef[],
  opts: SyncOptions = {},
): Promise<{ ok: number; falhas: number }> {
  if (!referencias && syncGlobalEmAndamento) return syncGlobalEmAndamento;

  const executar = async () => {
    const refs = referencias ?? (await boardsAtivos(opts.limite));
    if (refs.length === 0) return { ok: 0, falhas: 0 };
    let ok = 0;
    let falhas = 0;

    // Busca e grava um board por vez. `fetchBoards` sempre devolve resultado
    // parcial, mas esperar a carteira inteira antes de persistir faria um 429
    // tardio segurar TODOS os snapshots. Assim os boards já concluídos passam a
    // alimentar as telas mesmo que os próximos encontrem limite de API.
    for (const ref of refs) {
      const resultado = await fetchBoards([ref], {
        force: true,
        maxAttempts: opts.maxAttempts,
        requestTimeoutMs: opts.requestTimeoutMs,
        boardTimeoutMs: opts.boardTimeoutMs,
      });
      const board = resultado.boards[0];
      if (!board) {
        falhas += 1;
        if (opts.stopOnFailure) break;
        continue;
      }
      const motivo = resultado.indisponiveis.find(issue => issue.boardId === board.boardId)?.motivo;
      if (motivo) {
        await registrarFalha(board, motivo);
        falhas += 1;
        if (opts.stopOnFailure) break;
      } else {
        await salvarSucesso(board);
        ok += 1;
      }
    }
    console.log(`[sync] ${ok} board(s) atualizados, ${falhas} com falha`);
    return { ok, falhas };
  };

  if (referencias) {
    try {
      return await executar();
    } catch (error) {
      console.error("[sync] falha ao sincronizar cliente:", error);
      return { ok: 0, falhas: referencias.length || 1 };
    }
  }

  syncGlobalEmAndamento = executar()
    .catch(error => {
      console.error("[sync] falha geral:", error);
      return { ok: 0, falhas: 1 };
    })
    .finally(() => {
      syncGlobalEmAndamento = null;
    });
  return syncGlobalEmAndamento;
}

/** Atualiza manualmente a cópia local de um único cliente. */
export async function sincronizarCliente(client: { name: string; boardId: string }) {
  // A tela precisa devolver o controle rapidamente quando o Monday está sob
  // limite. A rotina automática continua percorrendo a carteira aos poucos;
  // já este clique tenta a clínica selecionada uma vez e para na primeira
  // falha, em vez de deixar a SDR presa em "Atualizando...".
  return sincronizar(idsDoCliente(client), {
    maxAttempts: 1,
    requestTimeoutMs: 8_000,
    boardTimeoutMs: 12_000,
    stopOnFailure: true,
  });
}

export interface SnapshotLido {
  leads: Lead[];
  atendimentos: AtendimentoRecord[];
  problemas: { boardId: string; motivo: string; temDados: boolean }[];
  atualizadoEm: Date | null;
}

/** Lê a cópia local sem realizar chamadas externas ao Monday. */
export async function lerSnapshots(boardIds: string[]): Promise<SnapshotLido> {
  const empty: SnapshotLido = { leads: [], atendimentos: [], problemas: [], atualizadoEm: null };
  const uniqueIds = Array.from(new Set(boardIds.filter(Boolean)));
  if (uniqueIds.length === 0) return empty;

  const db = await getDb();
  if (!db) return empty;

  const rows = await db.select().from(boardSnapshots).where(inArray(boardSnapshots.boardId, uniqueIds));
  const byId = new Map(rows.map(row => [row.boardId, row]));
  const leads: Lead[] = [];
  const atendimentos: AtendimentoRecord[] = [];
  const problemas: SnapshotLido["problemas"] = [];
  let oldestSync: number | null = null;

  for (const boardId of uniqueIds) {
    const row = byId.get(boardId);
    if (!row) {
      problemas.push({ boardId, motivo: "Aguardando a primeira sincronização.", temDados: false });
      continue;
    }
    try {
      const data = JSON.parse(row.payload) as SnapshotData;
      leads.push(...(data.leads ?? []));
      atendimentos.push(...(data.atendimentos ?? []));
    } catch {
      problemas.push({ boardId, motivo: "Dados locais inválidos; uma nova sincronização é necessária.", temDados: false });
      continue;
    }
    if (row.lastError) {
      problemas.push({ boardId, motivo: row.lastError, temDados: Boolean(row.syncedAt) });
    } else if (!row.syncedAt) {
      problemas.push({ boardId, motivo: "Aguardando a primeira sincronização.", temDados: false });
    }
    if (row.syncedAt) {
      const timestamp = row.syncedAt.getTime();
      oldestSync = oldestSync === null ? timestamp : Math.min(oldestSync, timestamp);
    }
  }

  return { leads, atendimentos, problemas, atualizadoEm: oldestSync === null ? null : new Date(oldestSync) };
}
