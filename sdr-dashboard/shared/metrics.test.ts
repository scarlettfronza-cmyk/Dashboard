import { describe, it, expect } from "vitest";
import {
  todayInTz,
  addDays,
  daysBetween,
  parseDate,
  resolvePreset,
  previousRange,
  computeMetrics,
  compareMetrics,
  filterAtendimentosByRange,
  filterLeadsByDate,
  type Lead,
} from "./metrics";

/** Lead mínimo; sobrescreva só os campos relevantes ao teste. */
function lead(overrides: Partial<Lead>): Lead {
  return {
    id: "1",
    name: "Paciente",
    group: "Agosto",
    sdr: "Luana",
    canal: "Google",
    procedimento: "Rinoplastia",
    dataConversao: "",
    dataConsulta: "",
    dataFechamento: "",
    dataProcedimento: "",
    compareceu: "",
    statusLead: "",
    valor: null,
    obs: "",
    boardId: "1",
    boardName: "Board",
    clientName: "Dra X",
    ...overrides,
  };
}

describe("datas no fuso de São Paulo", () => {
  it("não adianta o dia depois das 21h locais", () => {
    // 28/08 02:30 UTC = 27/08 23:30 em São Paulo
    const lateNight = new Date("2026-08-28T02:30:00Z");
    expect(todayInTz(lateNight)).toBe("2026-08-27");
    // demonstra o bug anterior:
    expect(lateNight.toISOString().slice(0, 10)).toBe("2026-08-28");
  });

  it("resolve os atalhos do filtro", () => {
    const now = new Date("2026-08-27T15:00:00Z");
    expect(resolvePreset("hoje", now)).toEqual({ from: "2026-08-27", to: "2026-08-27" });
    expect(resolvePreset("7d", now)).toEqual({ from: "2026-08-21", to: "2026-08-27" });
    expect(resolvePreset("mes", now)).toEqual({ from: "2026-08-01", to: "2026-08-27" });
  });

  it("nunca inclui datas futuras no atalho de mês", () => {
    const now = new Date("2026-08-10T15:00:00Z");
    expect(resolvePreset("mes", now).to).toBe("2026-08-10");
  });

  it("calcula o período anterior de mesma duração, sem sobreposição", () => {
    const atual = { from: "2026-08-01", to: "2026-08-31" };
    const anterior = previousRange(atual);
    expect(anterior).toEqual({ from: "2026-07-01", to: "2026-07-31" });
    expect(daysBetween(anterior.from, anterior.to)).toBe(daysBetween(atual.from, atual.to));
    expect(anterior.to < atual.from).toBe(true);
  });

  it("atravessa viradas de mês e ano", () => {
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("aceita os formatos que o Monday devolve", () => {
    expect(parseDate("5/8/2026")).toBe("2026-08-05");
    expect(parseDate("05/08/2026")).toBe("2026-08-05");
    expect(parseDate("2026-08-05T10:00:00Z")).toBe("2026-08-05");
    expect(parseDate("")).toBeNull();
    expect(parseDate("a definir")).toBeNull();
  });
});

describe("computeMetrics", () => {
  const agosto = { from: "2026-08-01", to: "2026-08-31" };

  const leads = [
    lead({ dataConversao: "01/08/2026", statusLead: "Em negociação" }),
    lead({
      dataConversao: "05/08/2026",
      dataConsulta: "10/08/2026",
      compareceu: "Sim",
      statusLead: "Negócio fechado",
      dataFechamento: "12/08/2026",
      valor: 15000,
    }),
    // convertido em julho, fechado em agosto
    lead({
      dataConversao: "20/07/2026",
      dataConsulta: "08/08/2026",
      compareceu: "Não",
      statusLead: "Negócio fechado",
      dataFechamento: "14/08/2026",
      valor: 20000,
    }),
    lead({ dataConversao: "22/08/2026", statusLead: "Negócio perdido" }),
    lead({ dataConversao: "", statusLead: "Em negociação" }),
  ];

  it("conta cada métrica pela sua própria data de referência", () => {
    const m = computeMetrics(leads, agosto);
    expect(m.leadsRecebidos).toBe(3); // exclui o de julho e o sem data
    expect(m.agendamentos).toBe(2);
    expect(m.comparecimentos).toBe(1);
    // o fechamento de agosto entra mesmo tendo sido convertido em julho
    expect(m.negociosFechados).toBe(2);
  });

  it("soma receita apenas de negócios fechados", () => {
    const m = computeMetrics(leads, agosto);
    expect(m.receitaTotal).toBe(35000);
    expect(m.ticketMedio).toBe(17500);
  });

  it("não conta valor de lead ainda em aberto", () => {
    const m = computeMetrics(
      [lead({ dataConversao: "02/08/2026", statusLead: "Em negociação", valor: 90000 })],
      agosto,
    );
    expect(m.receitaTotal).toBe(0);
  });

  it("dá o mesmo resultado com e sem filtro quando todos os leads cabem no período", () => {
    const dentro = leads.filter(l => l.dataConversao.includes("/08/"));
    expect(computeMetrics(dentro, agosto).leadsRecebidos).toBe(computeMetrics(dentro, null).leadsRecebidos);
  });

  it("inclui leads sem data quando não há período", () => {
    expect(computeMetrics(leads, null).leadsRecebidos).toBe(5);
  });

  it("não divide por zero em período vazio", () => {
    const m = computeMetrics([], agosto);
    expect(m.taxaConversao).toBe(0);
    expect(m.ticketMedio).toBe(0);
    expect(m.taxaComparecimento).toBe(0);
  });

  it("usa o relatório diário para agendamentos e exclui Indicação dos comparecimentos", () => {
    const presentesDiretos = Array.from({ length: 30 }, (_, index) => lead({
      id: `direto-${index}`,
      canal: "Whats/META",
      dataConsulta: "10/08/2026",
      compareceu: "Sim",
    }));
    const presentesIndicacao = Array.from({ length: 3 }, (_, index) => lead({
      id: `indicacao-${index}`,
      canal: index === 0 ? "Indicações" : "Indicação",
      dataConsulta: "11/08/2026",
      compareceu: "Sim",
    }));
    const diarios = [{
      date: "2026-08-12",
      novosContatos: 0,
      novosAds: 0,
      conversasRealizadas: 0,
      consultaAgendada: 40,
      agendadoAds: 0,
      procedimentoVendido: 0,
      boardId: "atendimento",
      clientName: "Dra X",
      sdrName: "Luana",
    }];

    const m = computeMetrics([...presentesDiretos, ...presentesIndicacao], agosto, diarios);
    expect(m.agendamentos).toBe(40);
    expect(m.comparecimentos).toBe(30);
    expect(m.taxaComparecimento).toBe(75);
  });

  it("mantém os agendamentos por lead dos clientes sem relatório diário na visão consolidada", () => {
    const tati = lead({ clientName: "Dra Tatiana", dataConsulta: "10/08/2026", compareceu: "Sim" });
    const outraClinica = lead({ id: "outra", clientName: "Dr Lucas", dataConsulta: "11/08/2026", compareceu: "Sim" });
    const diarios = [{
      date: "2026-08-12",
      novosContatos: 0,
      novosAds: 0,
      conversasRealizadas: 0,
      consultaAgendada: 40,
      agendadoAds: 0,
      procedimentoVendido: 0,
      boardId: "atendimento-tatiana",
      clientName: "Dra Tatiana",
      sdrName: "Luana",
    }];

    const m = computeMetrics([tati, outraClinica], agosto, diarios);
    expect(m.agendamentos).toBe(41);
    expect(m.comparecimentos).toBe(2);
  });

  it("diário com Consulta Agendada zerada não apaga as consultas do board de agendamentos", () => {
    // Caso do Dr. Jonas: o diário tem os dias preenchidos (contatos, conversas),
    // mas "Consulta Agendada" fica em zero; as consultas estão só no board.
    const consultas = ["01/09/2026", "15/09/2026", "22/09/2026"].map((data, i) =>
      lead({ id: `jonas-${i}`, clientName: "Dr Jonas", dataConsulta: data }),
    );
    const diaZerado = {
      date: "2026-09-29",
      novosContatos: 4,
      novosAds: 2,
      conversasRealizadas: 39,
      consultaAgendada: 0,
      agendadoAds: 0,
      procedimentoVendido: 0,
      boardId: "diario-jonas",
      clientName: "Dr Jonas",
      sdrName: "Luana",
    };

    const m = computeMetrics(consultas, { from: "2026-09-01", to: "2026-09-30" }, [diaZerado]);
    expect(m.agendamentos).toBe(3);
  });

  it("conta as consultas marcadas no período para depois dele", () => {
    const leads = [
      lead({ id: "marcou-agosto-para-setembro", dataConversao: "20/08/2026", dataConsulta: "05/09/2026" }),
      lead({ id: "marcou-agosto-para-agosto", dataConversao: "02/08/2026", dataConsulta: "10/08/2026" }),
      lead({ id: "marcou-julho-para-setembro", dataConversao: "25/07/2026", dataConsulta: "03/09/2026" }),
    ];
    expect(computeMetrics(leads, agosto).agendadasParaDepois).toBe(1);
    expect(computeMetrics(leads, null).agendadasParaDepois).toBe(0);
  });

  it("agendamentos são os feitos no período: consultas do mês mais as marcadas para o seguinte", () => {
    // Caso do Dr. Jonas em setembro: 10 consultas em setembro (8 com presença)
    // e 2 marcadas em setembro para outubro. O card mostra 12; a taxa de
    // comparecimento usa só as 10 que podiam ter acontecido.
    const setembro = { from: "2026-09-01", to: "2026-09-30" };
    const consultasSetembro = Array.from({ length: 10 }, (_, i) =>
      lead({ id: `set-${i}`, dataConversao: "20/08/2026", dataConsulta: `${String(i + 1).padStart(2, "0")}/09/2026`, compareceu: i < 8 ? "Sim" : "Não" }),
    );
    const paraOutubro = [
      lead({ id: "out-1", dataConversao: "29/09/2026", dataConsulta: "02/10/2026" }),
      lead({ id: "out-2", dataConversao: "29/09/2026", dataConsulta: "02/10/2026" }),
    ];
    const m = computeMetrics([...consultasSetembro, ...paraOutubro], setembro);
    expect(m.agendamentos).toBe(12);
    expect(m.agendadasParaDepois).toBe(2);
    expect(m.comparecimentos).toBe(8);
    expect(m.taxaComparecimento).toBe(80);
  });

  it("no cliente com diário, as marcadas para depois já estão no total do diário", () => {
    const diario = [{
      date: "2026-08-15", novosContatos: 0, novosAds: 0, conversasRealizadas: 0, consultaAgendada: 40,
      agendadoAds: 0, procedimentoVendido: 0, boardId: "diario", clientName: "Dra X", sdrName: "Luana",
    }];
    const paraSetembro = lead({ id: "set", dataConversao: "20/08/2026", dataConsulta: "05/09/2026" });
    const m = computeMetrics([paraSetembro], agosto, diario);
    expect(m.agendamentos).toBe(40);
    expect(m.agendadasParaDepois).toBe(1);
  });

  it("soma conversas realizadas e social selling do diário no período", () => {
    const dia = (date: string, conversas: number, social?: number) => ({
      date, novosContatos: 0, novosAds: 0, conversasRealizadas: conversas, consultaAgendada: 0, agendadoAds: 0,
      procedimentoVendido: 0, socialSelling: social, boardId: "d", clientName: "Dra X", sdrName: "Luana",
    });
    const m = computeMetrics([], agosto, [dia("2026-08-02", 159, 14), dia("2026-08-03", 70), dia("2026-09-01", 500, 50)]);
    expect(m.conversasRealizadas).toBe(229);
    expect(m.socialSelling).toBe(14);
  });

  it("soma as consultas pagas do período: presença e valor de consulta", () => {
    const leads = [
      lead({ id: "pagou", dataConsulta: "05/08/2026", compareceu: "Sim", valorConsulta: 750 }),
      lead({ id: "indicacao-pagou", canal: "Indicação", dataConsulta: "06/08/2026", compareceu: "Sim", valorConsulta: 750 }),
      lead({ id: "faltou", dataConsulta: "07/08/2026", compareceu: "Não", valorConsulta: 750 }),
      lead({ id: "convenio-sem-valor", dataConsulta: "08/08/2026", compareceu: "Sim", valorConsulta: null }),
      lead({ id: "setembro", dataConsulta: "02/09/2026", compareceu: "Sim", valorConsulta: 750 }),
    ];
    const m = computeMetrics(leads, agosto);
    expect(m.consultasPagas).toBe(2);
    expect(m.receitaConsultas).toBe(1500);
  });

  it("reconhece mês fechado do calendário", async () => {
    const { mesDoPeriodo } = await import("./metrics");
    expect(mesDoPeriodo({ from: "2026-08-01", to: "2026-08-31" })).toEqual({ mes: "agosto", seguinte: "setembro" });
    expect(mesDoPeriodo({ from: "2026-12-01", to: "2026-12-31" })).toEqual({ mes: "dezembro", seguinte: "janeiro" });
    expect(mesDoPeriodo({ from: "2026-02-01", to: "2026-02-28" })?.mes).toBe("fevereiro");
    expect(mesDoPeriodo({ from: "2026-08-01", to: "2026-08-30" })).toBeNull();
    expect(mesDoPeriodo({ from: "2026-08-03", to: "2026-08-31" })).toBeNull();
  });
});

describe("filtros compartilhados das abas", () => {
  const agosto = { from: "2026-08-01", to: "2026-08-31" };

  it("filtra agenda pela data da consulta e vendas pela data de fechamento", () => {
    const leads = [
      lead({ id: "agenda-agosto", dataConsulta: "10/08/2026", dataFechamento: "" }),
      lead({ id: "agenda-setembro", dataConsulta: "10/09/2026", dataFechamento: "05/08/2026" }),
    ];

    expect(filterLeadsByDate(leads, "dataConsulta", agosto).map(item => item.id)).toEqual(["agenda-agosto"]);
    expect(filterLeadsByDate(leads, "dataFechamento", agosto, "dataConversao").map(item => item.id)).toEqual(["agenda-setembro"]);
  });

  it("filtra registros diários de atendimento pelo mesmo intervalo", () => {
    const records = [
      { date: "2026-08-31", novosContatos: 1, novosAds: 0, conversasRealizadas: 2, consultaAgendada: 3, agendadoAds: 0, procedimentoVendido: 0, boardId: "1", clientName: "Dra X", sdrName: "Luana" },
      { date: "2026-09-01", novosContatos: 9, novosAds: 0, conversasRealizadas: 8, consultaAgendada: 7, agendadoAds: 0, procedimentoVendido: 0, boardId: "1", clientName: "Dra X", sdrName: "Luana" },
    ];

    expect(filterAtendimentosByRange(records, agosto)).toHaveLength(1);
    expect(filterAtendimentosByRange(records, agosto)[0]?.consultaAgendada).toBe(3);
  });
});

describe("compareMetrics", () => {
  it("calcula variação percentual e trata base zero", () => {
    const atual = computeMetrics([lead({ dataConversao: "01/08/2026" }), lead({ dataConversao: "02/08/2026" })], {
      from: "2026-08-01",
      to: "2026-08-31",
    });
    const anterior = computeMetrics([lead({ dataConversao: "01/07/2026" })], { from: "2026-07-01", to: "2026-07-31" });
    const cmp = compareMetrics(atual, anterior);
    expect(cmp.leadsRecebidos.variacaoPct).toBe(100);
    // sem base anterior, variação é null em vez de Infinity
    expect(cmp.receitaTotal.variacaoPct).toBeNull();
  });
});

describe("porMes usa a data do lead, não o grupo do Monday", () => {
  const noGrupoErrado = (over: Partial<Lead>) => lead({ group: "Agendamento- antigo", ...over });

  it("agrupa por mês real e rotula em português", () => {
    const m = computeMetrics(
      [
        noGrupoErrado({ dataConversao: "05/02/2026" }),
        noGrupoErrado({ dataConversao: "20/02/2026", statusLead: "Negócio fechado", dataFechamento: "22/02/2026" }),
        noGrupoErrado({ dataConversao: "03/04/2026" }),
      ],
      null,
    );
    expect(m.porMes).toEqual([
      { mes: "fev/26", leads: 2, fechados: 1 },
      { mes: "abr/26", leads: 1, fechados: 0 },
    ]);
  });

  it("ordena cronologicamente atravessando o ano", () => {
    const m = computeMetrics(
      [noGrupoErrado({ dataConversao: "10/01/2026" }), noGrupoErrado({ dataConversao: "11/12/2025" })],
      null,
    );
    expect(m.porMes.map(p => p.mes)).toEqual(["dez/25", "jan/26"]);
  });

  it("usa a data da consulta quando não há data de conversão", () => {
    const m = computeMetrics([noGrupoErrado({ dataConversao: "", dataConsulta: "09/05/2026" })], null);
    expect(m.porMes).toEqual([{ mes: "mai/26", leads: 1, fechados: 0 }]);
  });

  it("ignora leads sem nenhuma data em vez de criar uma barra 'Sem mês'", () => {
    const m = computeMetrics([noGrupoErrado({ dataConversao: "", dataConsulta: "" })], null);
    expect(m.porMes).toEqual([]);
  });
});
