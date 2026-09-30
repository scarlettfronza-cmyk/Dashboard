/**
 * useMondayData — agora um wrapper fino sobre o tRPC.
 *
 * ATENÇÃO / HISTÓRICO: até esta versão, este arquivo continha um token pessoal
 * da API do Monday hardcoded e chamava api.monday.com diretamente do navegador.
 * Isso publicava uma credencial de escrita ("me:write") no bundle JavaScript
 * entregue a qualquer visitante. O token DEVE ser revogado no Monday e o novo
 * cadastrado como MONDAY_API_TOKEN no servidor.
 *
 * A busca e a normalização passaram para server/monday.ts; o cálculo das
 * métricas, para shared/metrics.ts.
 */
import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import {
  computeMetrics,
  type Lead,
  type AtendimentoRecord,
  type DateRange,
  type Metrics,
} from "@shared/metrics";

export type { Lead, AtendimentoRecord, DateRange, Metrics };

/**
 * Formato antigo de stats, mantido para não quebrar Overview, GestaoVendas,
 * Agendamentos e Atendimentos de uma vez só. Os valores agora vêm todos de
 * computeMetrics — nenhuma tela recalcula por conta própria.
 *
 * TODO: migrar as quatro páginas para consumir `Metrics` direto e apagar isto.
 */
export interface DashboardStats {
  totalLeads: number;
  agendamentos: number;
  negociosFechados: number;
  negociosPerdidos: number;
  emNegociacao: number;
  aguardandoRetorno: number;
  taxaConversao: number;
  receitaTotal: number;
  receitaMedia: number;
  porCanal: Metrics["porCanal"];
  porProcedimento: Metrics["porProcedimento"];
  porStatus: Metrics["porStatus"];
  porMes: Metrics["porMes"];
  porSdr: Metrics["porSdr"];
  porCliente: Metrics["porCliente"];
}

export function toDashboardStats(m: Metrics): DashboardStats {
  return {
    totalLeads: m.leadsRecebidos,
    agendamentos: m.agendamentos,
    negociosFechados: m.negociosFechados,
    negociosPerdidos: m.negociosPerdidos,
    emNegociacao: m.emNegociacao,
    aguardandoRetorno: m.aguardandoRetorno,
    taxaConversao: m.taxaConversao,
    receitaTotal: m.receitaTotal,
    receitaMedia: m.ticketMedio,
    porCanal: m.porCanal,
    porProcedimento: m.porProcedimento,
    porStatus: m.porStatus,
    porMes: m.porMes,
    porSdr: m.porSdr,
    porCliente: m.porCliente,
  };
}

export interface BoardIndisponivel {
  boardId: string;
  motivo: string;
  kind: "config" | "rate_limit" | "api";
  usouCache: boolean;
}

export interface UseClientDataResult {
  leads: Lead[];
  atendimentos: AtendimentoRecord[];
  metrics: Metrics | null;
  loading: boolean;
  error: string | null;
  indisponiveis: BoardIndisponivel[];
  lastUpdated: Date | null;
  refetch: () => void;
}

/** Regra pura para impedir chamadas ao Monday até a carteira estar resolvida. */
export function shouldLoadAllClientData(
  clientId: number | null,
  opts: { authenticated: boolean; clientCount: number | undefined },
): boolean {
  return opts.authenticated && clientId === null && opts.clientCount !== undefined && opts.clientCount > 0;
}

/**
 * Dados de um cliente específico, ou de todos os clientes da SDR quando
 * `clientId` é null. As métricas são recalculadas localmente a partir dos
 * mesmos leads e do mesmo módulo que o servidor usa, então os números do
 * dashboard e os do relatório não podem divergir.
 */
export function useClientData(
  clientId: number | null,
  range: DateRange | null = null,
  /**
   * Estado da lista de clientes, vinda do banco. O hook precisa dele para não
   * disparar a consulta agregada antes da hora.
   *
   * `undefined` = ainda carregando. `[]` = a SDR não tem cliente nenhum, e aí
   * não existe nada para buscar no Monday. Sem essa distinção, uma SDR sem
   * cliente atribuído ficava presa em "Carregando dados do Monday.com..." para
   * sempre, esperando uma consulta que nunca teria o que trazer.
   */
  opts: { authenticated: boolean; clientCount: number | undefined },
): UseClientDataResult {
  const utils = trpc.useUtils();
  const { authenticated, clientCount } = opts;

  const clientesResolvidos = clientCount !== undefined;
  const temClientes = (clientCount ?? 0) > 0;

  // As consultas leem só a cópia local (barato). Relendo a cada 2 minutos, a
  // tela aberta acompanha a sincronização automática e o "Atualizar dados"
  // feito por outra pessoa, sem precisar recarregar a página.
  const releitura = { staleTime: 60 * 1000, refetchInterval: 2 * 60 * 1000, refetchOnWindowFocus: true, retry: 1 };

  const single = trpc.sdr.clientData.useQuery(
    { clientId: clientId ?? 0 },
    { enabled: authenticated && clientId !== null, ...releitura },
  );

  const all = trpc.sdr.allClientsData.useQuery(undefined, {
    enabled: shouldLoadAllClientData(clientId, opts),
    ...releitura,
  });

  const active = clientId !== null ? single : all;

  // Sem cliente atribuído, não há consulta em voo: nada a carregar, nada a errar.
  const inativo = clientId === null && clientesResolvidos && !temClientes;

  const leads = active.data?.leads ?? [];
  const atendimentos = active.data?.atendimentos ?? [];

  const metrics = useMemo(
    () => (inativo ? computeMetrics([], range) : active.data ? computeMetrics(leads, range, atendimentos) : null),
    [inativo, active.data, leads, atendimentos, range],
  );

  return {
    leads,
    atendimentos,
    metrics,
    loading: inativo ? false : active.isLoading,
    error: active.error?.message ?? null,
    // Boards que não atualizaram; a tela avisa em vez de mostrar zeros mudos.
    indisponiveis: active.data?.indisponiveis ?? [],
    // Reflete a última sincronização real com o Monday, e não a leitura local
    // feita agora pela tela.
    lastUpdated: active.data?.atualizadoEm ? new Date(active.data.atualizadoEm) : null,
    refetch: () => {
      if (clientId !== null) void utils.sdr.clientData.invalidate({ clientId });
      else void utils.sdr.allClientsData.invalidate();
    },
  };
}
