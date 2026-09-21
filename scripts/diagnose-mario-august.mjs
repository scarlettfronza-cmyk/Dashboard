import { getSalesForPeriod } from "../server/db.ts";

const result = await getSalesForPeriod(30001, "2026-08-01", "2026-08-28");

console.log(JSON.stringify({
  period: "2026-08-01 a 2026-08-28",
  consultas: result.consultas,
  fechamentos: result.fechamentos,
  receitaConsultas: result.totalConsultas,
  receitaFechamentos: result.totalCirurgias,
  receitaTotalAtual: result.totalConsultas + result.totalCirurgias,
}, null, 2));
