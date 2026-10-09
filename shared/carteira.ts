/**
 * Leitura da carteira: quem está dentro da meta de custo por lead, quem
 * precisa de teste ou otimização, e em qual campanha.
 *
 * A gestora tem uma meta única (R$ 20 por lead). Com dezenove clientes,
 * abrir um por um para achar os que estouraram é o trabalho que esta
 * função tira dela. Fica em `shared/` para a tela recalcular ao vivo
 * quando a meta muda, sem nova consulta ao Meta.
 *
 * Só campanhas que geram lead (mensagens e formulário) entram na conta do
 * CPL; vídeo e visitas têm outro objetivo e são apontadas, não julgadas.
 */

export type TipoCampanha = "mensagens" | "formulario" | "visitas" | "video" | "outros";

export type CampanhaCarteira = {
  nome: string;
  tipo: TipoCampanha;
  investimento: number;
  leads: number;
};

export type ClienteCarteira = {
  id: number;
  nome: string;
  /** Mensagem de erro quando a consulta do cliente falhou. */
  erro?: string | null;
  temMeta: boolean;
  investimento: number;
  leads: number;
  campanhas: CampanhaCarteira[];
  /** Preenchido na varredura matinal; ausente na consulta só de CPL. */
  varredura?: Varredura;
};

export type Situacao = "acima" | "sem_leads" | "atencao" | "dentro" | "sem_investimento" | "sem_meta" | "erro";

export const ROTULO_SITUACAO: Record<Situacao, string> = {
  acima: "Acima da meta",
  sem_leads: "Gastou sem lead",
  atencao: "Perto do limite",
  dentro: "Dentro da meta",
  sem_investimento: "Sem investimento",
  sem_meta: "Sem Meta Ads",
  erro: "Falha ao consultar",
};

/** Ordem de urgência: o que pede ação primeiro vem antes. */
const PRIORIDADE: Record<Situacao, number> = {
  acima: 0, sem_leads: 1, erro: 2, atencao: 3, dentro: 4, sem_investimento: 5, sem_meta: 6,
};

export type Acao = { campanha: string; texto: string; gravidade: "alta" | "media" | "boa" };

export type Avaliacao = {
  situacao: Situacao;
  cpl: number | null;
  /** Quanto o CPL está acima da meta, em %. Null quando não se aplica. */
  desvio: number | null;
  resumo: string;
  acoes: Acao[];
};

export const GERA_LEAD: ReadonlySet<TipoCampanha> = new Set<TipoCampanha>(["mensagens", "formulario"]);

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });
const pct = (v: number) => `${Math.round(v)}%`;

export function custoPorLead(investimento: number, leads: number): number | null {
  return leads > 0 && investimento > 0 ? investimento / leads : null;
}

/** Investimento mínimo para uma campanha entrar nas ações — abaixo disso é ruído. */
export const GASTO_MINIMO_CAMPANHA = 50;

export function avaliarCliente(c: ClienteCarteira, meta: number): Avaliacao {
  if (c.erro) return { situacao: "erro", cpl: null, desvio: null, resumo: c.erro, acoes: [] };
  if (!c.temMeta) return { situacao: "sem_meta", cpl: null, desvio: null, resumo: "Conta de anúncio não configurada.", acoes: [] };
  if (c.investimento <= 0) return { situacao: "sem_investimento", cpl: null, desvio: null, resumo: "Nada investido no período.", acoes: [] };

  const cpl = custoPorLead(c.investimento, c.leads);
  const acoes = acoesPorCampanha(c.campanhas, meta);

  if (cpl == null) {
    return {
      situacao: "sem_leads", cpl: null, desvio: null,
      resumo: `${brl(c.investimento)} investidos sem nenhum lead. Revisar oferta, criativo ou objetivo das campanhas.`,
      acoes,
    };
  }
  const desvio = ((cpl - meta) / meta) * 100;
  if (cpl <= meta) {
    return { situacao: "dentro", cpl, desvio, resumo: `CPL ${brl(cpl)}, dentro da meta de ${brl(meta)}.`, acoes };
  }
  if (cpl <= meta * 1.25) {
    return { situacao: "atencao", cpl, desvio, resumo: `CPL ${brl(cpl)}, ${pct(desvio)} acima da meta. Ainda dá para corrigir com ajuste fino.`, acoes };
  }
  return { situacao: "acima", cpl, desvio, resumo: `CPL ${brl(cpl)}, ${pct(desvio)} acima da meta de ${brl(meta)}. Precisa de teste ou otimização.`, acoes };
}

/**
 * Uma ação por campanha relevante. Campanhas de lead acima da meta pedem
 * teste; as sem lead pedem pausa ou troca; as boas merecem mais verba.
 */
export function acoesPorCampanha(campanhas: CampanhaCarteira[], meta: number): Acao[] {
  const acoes: Acao[] = [];
  for (const camp of [...campanhas].sort((a, b) => b.investimento - a.investimento)) {
    if (!GERA_LEAD.has(camp.tipo) || camp.investimento < GASTO_MINIMO_CAMPANHA) continue;
    const cpl = custoPorLead(camp.investimento, camp.leads);
    if (cpl == null) {
      acoes.push({ campanha: camp.nome, texto: `${brl(camp.investimento)} sem lead — pausar ou trocar criativo e público.`, gravidade: "alta" });
    } else if (cpl > meta * 1.25) {
      acoes.push({ campanha: camp.nome, texto: `CPL ${brl(cpl)} (${pct(((cpl - meta) / meta) * 100)} acima) — testar novos criativos e públicos.`, gravidade: "alta" });
    } else if (cpl > meta) {
      acoes.push({ campanha: camp.nome, texto: `CPL ${brl(cpl)}, um pouco acima — ajustar lance, público ou horário.`, gravidade: "media" });
    } else {
      acoes.push({ campanha: camp.nome, texto: `CPL ${brl(cpl)}, dentro da meta — candidata a receber mais verba.`, gravidade: "boa" });
    }
  }
  return acoes;
}

export type LinhaCarteira = ClienteCarteira & { avaliacao: Avaliacao };

/** Avalia todos e ordena do mais urgente para o mais tranquilo; empate por CPL maior. */
const PESO_COR: Record<CorSemaforo, number> = { vermelho: 0, amarelo: 1, verde: 2, cinza: 3 };

export function avaliarCarteira(clientes: ClienteCarteira[], meta: number): LinhaCarteira[] {
  return clientes
    .map((c) => ({ ...c, avaliacao: avaliarCliente(c, meta) }))
    .sort((a, b) =>
      PESO_COR[semaforo(a).cor] - PESO_COR[semaforo(b).cor]
      || PRIORIDADE[a.avaliacao.situacao] - PRIORIDADE[b.avaliacao.situacao]
      || (b.avaliacao.cpl ?? 0) - (a.avaliacao.cpl ?? 0)
      || b.investimento - a.investimento);
}

export function resumoCarteira(linhas: LinhaCarteira[]): Record<Situacao, number> {
  const r: Record<Situacao, number> = { acima: 0, sem_leads: 0, atencao: 0, dentro: 0, sem_investimento: 0, sem_meta: 0, erro: 0 };
  for (const l of linhas) r[l.avaliacao.situacao]++;
  return r;
}

// ── Varredura matinal ────────────────────────────────────────────────────────
// O playbook pede: todas as contas vistas todos os dias, com cor. A cor sai
// do que já consultamos (CPL do mês, saldo, status da conta, gasto recente)
// mais o diário de decisões. Vermelho = agir hoje; amarelo = investigar e
// programar teste; verde = manter. Cinza = nada rodando.

export type Varredura = {
  /** Gasto de ontem, em reais. */
  gastoOntem: number;
  /** Gasto dos últimos 7 dias (até ontem) e dos 7 anteriores a esses. */
  gasto7: number;
  gasto7Anteriores: number;
  /** Campanhas com gasto ontem. */
  campanhasAtivas: number;
  /** Saldo pré-pago em reais; null para conta pós-paga ou sem leitura. */
  saldo: number | null;
  /** Gravidade do status da conta na Meta, com o rótulo para exibir. */
  conta: { gravidade: "ok" | "aviso" | "critico"; rotulo: string } | null;
  decisoes: { pendente: number; vencida: number };
};

export const SALDO_BAIXO = 200;
export const SALDO_CRITICO = 50;
/** Queda de gasto entre semanas que merece olhar (fração). */
export const QUEDA_GASTO_ALERTA = 0.4;

export type CorSemaforo = "vermelho" | "amarelo" | "verde" | "cinza";

export const ROTULO_SEMAFORO: Record<CorSemaforo, string> = {
  vermelho: "Agir hoje", amarelo: "Investigar", verde: "Manter", cinza: "Parado",
};

export type Semaforo = { cor: CorSemaforo; motivos: string[] };

export function semaforo(l: LinhaCarteira): Semaforo {
  const vermelho: string[] = [];
  const amarelo: string[] = [];
  const s = l.avaliacao.situacao;
  const v = l.varredura;

  if (s === "acima") vermelho.push(`CPL ${pct(l.avaliacao.desvio ?? 0)} acima da meta`);
  if (s === "sem_leads") vermelho.push("gastou sem gerar lead");
  if (s === "atencao") amarelo.push("CPL perto do limite");
  if (s === "erro") amarelo.push("falha ao consultar o Meta");

  if (v) {
    if (v.conta && v.conta.gravidade === "critico") vermelho.push(`conta: ${v.conta.rotulo.toLowerCase()}`);
    else if (v.conta && v.conta.gravidade === "aviso") amarelo.push(`conta: ${v.conta.rotulo.toLowerCase()}`);
    if (v.saldo != null && v.saldo <= SALDO_CRITICO) vermelho.push(`saldo ${brl(v.saldo)}`);
    else if (v.saldo != null && v.saldo <= SALDO_BAIXO) amarelo.push(`saldo ${brl(v.saldo)}`);
    if (v.decisoes.vencida > 0) vermelho.push(`${v.decisoes.vencida} ${v.decisoes.vencida === 1 ? "decisão vencida" : "decisões vencidas"}`);
    if (v.gastoOntem === 0 && v.gasto7 > 0) vermelho.push("não gastou ontem");
    else if (v.gasto7Anteriores > 0 && v.gasto7 < v.gasto7Anteriores * (1 - QUEDA_GASTO_ALERTA)) {
      amarelo.push(`gasto caiu ${pct((1 - v.gasto7 / v.gasto7Anteriores) * 100)} na semana`);
    }
  }

  if (vermelho.length) return { cor: "vermelho", motivos: [...vermelho, ...amarelo] };
  if (amarelo.length) return { cor: "amarelo", motivos: amarelo };
  if (s === "sem_investimento" || s === "sem_meta") return { cor: "cinza", motivos: [] };
  return { cor: "verde", motivos: [] };
}

export function resumoSemaforo(linhas: LinhaCarteira[]): Record<CorSemaforo, number> {
  const r: Record<CorSemaforo, number> = { vermelho: 0, amarelo: 0, verde: 0, cinza: 0 };
  for (const l of linhas) r[semaforo(l).cor]++;
  return r;
}

/** Variação do gasto semanal em %, ou null sem base de comparação. */
export function variacaoSemanal(v: Varredura): number | null {
  if (v.gasto7Anteriores <= 0) return null;
  return ((v.gasto7 - v.gasto7Anteriores) / v.gasto7Anteriores) * 100;
}
