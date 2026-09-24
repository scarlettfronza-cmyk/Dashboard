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
export function avaliarCarteira(clientes: ClienteCarteira[], meta: number): LinhaCarteira[] {
  return clientes
    .map((c) => ({ ...c, avaliacao: avaliarCliente(c, meta) }))
    .sort((a, b) =>
      PRIORIDADE[a.avaliacao.situacao] - PRIORIDADE[b.avaliacao.situacao]
      || (b.avaliacao.cpl ?? 0) - (a.avaliacao.cpl ?? 0)
      || b.investimento - a.investimento);
}

export function resumoCarteira(linhas: LinhaCarteira[]): Record<Situacao, number> {
  const r: Record<Situacao, number> = { acima: 0, sem_leads: 0, atencao: 0, dentro: 0, sem_investimento: 0, sem_meta: 0, erro: 0 };
  for (const l of linhas) r[l.avaliacao.situacao]++;
  return r;
}
