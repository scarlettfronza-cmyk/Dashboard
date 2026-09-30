import mysql from "mysql2/promise";

const RANGE = { from: "2026-08-01", to: "2026-08-31" };
const CLIENTS = [
  { name: "Dra Tatiana Patruni", boards: ["18406678106", "6507769658", "18406678019"] },
  { name: "Dra Estéfani Molinar", boards: ["18406699335", "18406699304"] },
  { name: "Dr Jonas Lenzi", boards: ["18406696056", "18406695971"] },
  { name: "Dr. Mansur", boards: ["18406692406", "18246867020", "18406692374"] },
  { name: "Dr Lucas Moura", boards: ["18418032339", "18421311006"] },
];

const inAugust = (value) => typeof value === "string" && value >= RANGE.from && value <= RANGE.to;
const presente = (value) => /^(sim|compareceu|presente|ok)/i.test(String(value ?? "").trim());
const indicacao = (value) => /^(indicacao|indicacoes|indications?)$/i.test(String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim());

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL não está disponível para a auditoria.");
  const allBoards = CLIENTS.flatMap((client) => client.boards);
  const db = await mysql.createConnection(process.env.DATABASE_URL);
  try {
    const marks = allBoards.map(() => "?").join(",");
    const [rows] = await db.execute(`SELECT boardId, boardName, payload FROM board_snapshots WHERE boardId IN (${marks})`, allBoards);
    const snapshotByBoard = new Map(rows.map((row) => [row.boardId, { boardName: row.boardName, ...JSON.parse(row.payload) }]));

    const summary = CLIENTS.map((client) => {
      const snapshots = client.boards.map((id) => snapshotByBoard.get(id)).filter(Boolean);
      const leads = snapshots.flatMap((snapshot) => snapshot.leads ?? []);
      const atendimentos = snapshots.flatMap((snapshot) => snapshot.atendimentos ?? []);
      const agendamentosDiarios = atendimentos.filter((record) => inAugust(record.date)).reduce((sum, record) => sum + Number(record.consultaAgendada ?? 0), 0);
      const agendadosPorLead = leads.filter((lead) => inAugust(lead.dataConsulta));
      const fechados = leads.filter((lead) => lead.statusLead === "Negócio fechado" && inAugust(lead.dataFechamento || lead.dataConversao));
      const comparecimentosPorData = Object.fromEntries(
        ["dataConsulta", "dataProcedimento", "dataFechamento", "dataConversao"].map((field) => [
          field,
          leads.filter((lead) => inAugust(lead[field]) && presente(lead.compareceu)).length,
        ]),
      );
      const statusComparecimento = Object.fromEntries(
        agendadosPorLead.reduce((counts, lead) => {
          const status = String(lead.compareceu || "vazio").trim() || "vazio";
          counts.set(status, (counts.get(status) ?? 0) + 1);
          return counts;
        }, new Map()).entries(),
      );
      const diariosPorCampo = Object.fromEntries(
        ["novosContatos", "novosAds", "conversasRealizadas", "consultaAgendada", "agendadoAds", "procedimentoVendido"].map((field) => [
          field,
          atendimentos.filter((record) => inAugust(record.date)).reduce((sum, record) => sum + Number(record[field] ?? 0), 0),
        ]),
      );
      const resumoPorBoard = snapshots.map((snapshot) => {
        const leadsBoard = snapshot.leads ?? [];
        const agendaBoard = leadsBoard.filter((lead) => inAugust(lead.dataConsulta));
        const fechamentosPorCampo = Object.fromEntries(
          ["dataFechamento", "dataProcedimento", "dataConsulta", "dataConversao"].map((field) => {
            const itens = leadsBoard.filter((lead) => lead.statusLead === "Negócio fechado" && inAugust(lead[field]));
            return [field, { quantidade: itens.length, receita: itens.reduce((sum, lead) => sum + Number(lead.valor ?? 0), 0) }];
          }),
        );
        return {
          board: snapshot.boardName,
          agendamentos_diarios: (snapshot.atendimentos ?? []).filter((record) => inAugust(record.date)).reduce((sum, record) => sum + Number(record.consultaAgendada ?? 0), 0),
          agendamentos_no_board: agendaBoard.length,
          comparecimentos_total: agendaBoard.filter((lead) => presente(lead.compareceu)).length,
          comparecimentos_indicacao: agendaBoard.filter((lead) => indicacao(lead.canal) && presente(lead.compareceu)).length,
          fechamentos_por_campo: fechamentosPorCampo,
        };
      });
      return {
        client: client.name,
        boards: resumoPorBoard,
        agendamentos_diarios: agendamentosDiarios,
        agendamentos_no_board: agendadosPorLead.length,
        diarios_por_campo: diariosPorCampo,
        comparecimentos_por_data: comparecimentosPorData,
        status_comparecimento_agosto: statusComparecimento,
        comparecimentos_total: agendadosPorLead.filter((lead) => presente(lead.compareceu)).length,
        comparecimentos_indicacao: agendadosPorLead.filter((lead) => indicacao(lead.canal) && presente(lead.compareceu)).length,
        comparecimentos_sem_indicacao: agendadosPorLead.filter((lead) => !indicacao(lead.canal) && presente(lead.compareceu)).length,
        fechamentos: fechados.length,
        receita: fechados.reduce((sum, lead) => sum + Number(lead.valor ?? 0), 0),
      };
    });
    console.log(JSON.stringify({ range: RANGE, summary }, null, 2));
  } finally {
    await db.end();
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
