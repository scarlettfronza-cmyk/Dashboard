/**
 * Leitura em texto dos números do período, para o relatório do cliente.
 *
 * Cada frase só aparece quando o dado a sustenta, e a comparação é sempre da
 * clínica com ela mesma — não há média de mercado disponível, e inventar uma
 * seria afirmar o que não se sabe. Quando a integração de mídia não está
 * ativa, o texto diz isso em vez de omitir.
 */

export type KpisRelatorio = {
  investimento?: number | null;
  leads?: number | null;
  consultas?: number | null;
  vendas?: number | null;
  receitaTotal?: number | null;
  roas?: number | null;
  ticketMedio?: number | null;
  custoPorLead?: number | null;
  custoPorVenda?: number | null;
  novosSeguidores?: number | null;
  alcance?: number | null;
  mediaDataAvailable?: boolean;
  campanhas?: {
    mensagens?: { investimento?: number; leads?: number; custoPorLead?: number } | null;
    formulario?: { investimento?: number; leads?: number; custoPorLead?: number } | null;
  } | null;
};

const n = (v: number | null | undefined) => Number(v ?? 0);
const brl = (v: number | null | undefined) =>
  n(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const brl2 = (v: number | null | undefined) =>
  n(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
const num = (v: number | null | undefined) => n(v).toLocaleString("pt-BR");
/** Decimal em português usa vírgula; ponto destoa do resto do relatório. */
const dec = (v: number, casas = 2) => n(v).toFixed(casas).replace(".", ",");

export type Leitura = { analise: string[]; recomendacao: string[] };

export function lerPeriodo(k: KpisRelatorio): Leitura {
  const analise: string[] = [];
  const recomendacao: string[] = [];

  const investimento = n(k.investimento);
  const leads = n(k.leads);
  const consultas = n(k.consultas);
  const vendas = n(k.vendas);
  const receita = n(k.receitaTotal);
  const roas = n(k.roas);
  const temMidia = Boolean(k.mediaDataAvailable) && investimento > 0;

  // 1. Retorno sobre o investimento, quando há dado de mídia.
  if (temMidia && receita > 0) {
    analise.push(
      `O investimento de ${brl(investimento)} em mídia corresponde a ${brl(receita)} ` +
      `em receita registrada no período, o que representa ${dec(roas)}x de retorno.`,
    );
  } else if (receita > 0) {
    analise.push(
      `O período registra ${brl(receita)} em receita, somando consultas e procedimentos fechados. ` +
      `O investimento em mídia não está disponível, então o retorno sobre o valor aplicado não pôde ser calculado.`,
    );
  }

  // 2. Funil: lead, consulta, fechamento.
  if (leads > 0 || consultas > 0) {
    const partes: string[] = [];
    if (leads > 0) partes.push(`${num(leads)} leads`);
    if (consultas > 0) partes.push(`${num(consultas)} consultas agendadas`);
    if (vendas > 0) partes.push(`${num(vendas)} procedimentos fechados`);
    let frase = `O funil do período teve ${partes.join(", ")}`;
    if (leads > 0 && consultas > 0) {
      frase += `. De cada 100 leads, ${Math.round((consultas / leads) * 100)} viraram consulta`;
      if (consultas > 0 && vendas > 0) {
        frase += `, e de cada 100 consultas, ${Math.round((vendas / consultas) * 100)} viraram procedimento`;
      }
    } else if (consultas > 0 && vendas > 0) {
      frase += `. De cada 100 consultas, ${Math.round((vendas / consultas) * 100)} viraram procedimento`;
    }
    analise.push(frase + ".");
  }

  // 3. Custo por lead por tipo de campanha.
  const msg = k.campanhas?.mensagens;
  const form = k.campanhas?.formulario;
  const cplMsg = n(msg?.custoPorLead);
  const cplForm = n(form?.custoPorLead);
  if (cplMsg > 0 && cplForm > 0) {
    const caro = cplForm > cplMsg ? "formulário" : "mensagem";
    const barato = caro === "formulário" ? "mensagem" : "formulário";
    const razao = Math.max(cplForm, cplMsg) / Math.min(cplForm, cplMsg);
    analise.push(
      `O custo por lead ficou em ${brl2(cplMsg)} nas campanhas de mensagem e ${brl2(cplForm)} nas de formulário.`,
    );
    if (razao >= 1.5) {
      recomendacao.push(
        `Cada lead por ${caro} custa cerca de ${dec(razao, 1)}x o de ${barato}. ` +
        `Vale verificar se a qualidade justifica a diferença antes de manter a distribuição atual do investimento.`,
      );
    }
  } else if (cplMsg > 0) {
    analise.push(`O custo por lead ficou em ${brl2(cplMsg)} nas campanhas de mensagem.`);
  }

  // 4. Ticket médio e custo de aquisição.
  const ticket = n(k.ticketMedio);
  const custoVenda = n(k.custoPorVenda);
  if (ticket > 0 && custoVenda > 0) {
    analise.push(
      `Cada procedimento fechado custou ${brl(custoVenda)} em mídia, para um ticket médio de ${brl(ticket)}.`,
    );
  } else if (ticket > 0) {
    analise.push(`O ticket médio do período ficou em ${brl(ticket)}.`);
  }

  // 5. Presença no Instagram.
  const seguidores = n(k.novosSeguidores);
  if (seguidores > 0) {
    analise.push(`O perfil ganhou ${num(seguidores)} novos seguidores no período.`);
  }

  // ── Recomendações por retorno ───────────────────────────────────────────
  if (temMidia && receita > 0) {
    if (roas > 0 && roas < 1) {
      recomendacao.push(
        `Com ${dec(roas)}x, a receita registrada ficou abaixo do valor investido. ` +
        `Antes de ampliar o investimento, convém revisar o que acontece entre o agendamento e o fechamento.`,
      );
    } else if (roas >= 1 && roas < 2) {
      recomendacao.push(
        `O retorno de ${dec(roas)}x cobre o investimento com margem estreita. ` +
        `Ganhos na taxa de fechamento tendem a render mais do que aumento de verba neste cenário.`,
      );
    } else if (roas >= 3) {
      recomendacao.push(
        `Com ${dec(roas)}x de retorno, o investimento se paga com folga. ` +
        `Este é o cenário em que ampliar a verba costuma se sustentar.`,
      );
    }
  }

  if (consultas >= 10 && vendas > 0) {
    const taxa = (vendas / consultas) * 100;
    if (taxa < 15) {
      recomendacao.push(
        `A taxa de fechamento está em ${taxa.toFixed(0)}%. O ganho maior tende a vir do atendimento ` +
        `e do acompanhamento pós-consulta, antes de aumentar o volume de agendamentos.`,
      );
    }
  }

  if (!temMidia) {
    recomendacao.push(
      `Conectar a integração de mídia completa o relatório com investimento, custo por lead e retorno, ` +
      `que hoje não aparecem.`,
    );
  }

  if (recomendacao.length === 0) {
    recomendacao.push(
      `Manter o acompanhamento mensal dos indicadores, para identificar variações de fechamento ` +
      `e de ticket médio antes que afetem o resultado do trimestre.`,
    );
  }

  return { analise, recomendacao };
}
