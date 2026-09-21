import { describe, expect, it } from "vitest";
import { lerPeriodo } from "./analiseRelatorio";

// A formatação de moeda usa espaço não separável entre o símbolo e o número;
// normalizar evita comparações que falham por um caractere invisível.
const juntar = (xs: string[]) => xs.join(" ").replace(/\u00A0/g, " ");

describe("leitura do período", () => {
  it("escreve decimais com vírgula, como o resto do relatório", () => {
    const r = lerPeriodo({ investimento: 100, receitaTotal: 482, roas: 4.82, mediaDataAvailable: true });
    const t = juntar([...r.analise, ...r.recomendacao]);
    expect(t).toContain("4,82x");
    expect(t).not.toContain("4.82x");
  });

  it("relata o retorno quando há dado de mídia", () => {
    const r = lerPeriodo({
      investimento: 10000, receitaTotal: 48200, roas: 4.82,
      mediaDataAvailable: true, leads: 300, consultas: 120, vendas: 30,
    });
    expect(juntar(r.analise)).toContain("4,82x");
    expect(juntar(r.analise)).toContain("R$ 10.000");
  });

  it("diz que o investimento não está disponível, em vez de omitir", () => {
    const r = lerPeriodo({ receitaTotal: 48200, consultas: 120, vendas: 30 });
    expect(juntar(r.analise)).toContain("não está disponível");
    expect(juntar(r.recomendacao)).toContain("Conectar a integração");
  });

  it("descreve o funil com taxas de passagem", () => {
    const r = lerPeriodo({ leads: 200, consultas: 50, vendas: 10 });
    const t = juntar(r.analise);
    expect(t).toContain("De cada 100 leads, 25 viraram consulta");
    expect(t).toContain("de cada 100 consultas, 20 viraram procedimento");
  });

  it("compara o custo por lead entre mensagem e formulário", () => {
    const r = lerPeriodo({
      mediaDataAvailable: true, investimento: 5000,
      campanhas: {
        mensagens: { custoPorLead: 20 },
        formulario: { custoPorLead: 60 },
      },
    });
    expect(juntar(r.analise)).toContain("R$ 20,00");
    expect(juntar(r.analise)).toContain("R$ 60,00");
    expect(juntar(r.recomendacao)).toContain("3,0x");
  });

  it("não compara custos quando só um tipo existe", () => {
    const r = lerPeriodo({ campanhas: { mensagens: { custoPorLead: 20 } } });
    expect(juntar(r.analise)).toContain("campanhas de mensagem");
    expect(juntar(r.recomendacao)).not.toContain("x o de");
  });

  it("recomenda cautela com retorno abaixo de 1", () => {
    const r = lerPeriodo({ investimento: 10000, receitaTotal: 6000, roas: 0.6, mediaDataAvailable: true });
    expect(juntar(r.recomendacao)).toContain("abaixo do valor investido");
  });

  it("recomenda ampliar quando o retorno é alto", () => {
    const r = lerPeriodo({ investimento: 10000, receitaTotal: 50000, roas: 5, mediaDataAvailable: true });
    expect(juntar(r.recomendacao)).toContain("ampliar a verba");
  });

  it("aponta o atendimento quando o fechamento é baixo", () => {
    const r = lerPeriodo({ consultas: 100, vendas: 8 });
    expect(juntar(r.recomendacao)).toContain("atendimento");
  });

  it("não afirma nada sobre fechamento com poucas consultas", () => {
    const r = lerPeriodo({ consultas: 5, vendas: 0 });
    expect(juntar(r.recomendacao)).not.toContain("taxa de fechamento está");
  });

  it("nunca devolve listas vazias", () => {
    const r = lerPeriodo({});
    expect(r.recomendacao.length).toBeGreaterThan(0);
  });

  it("não quebra com campos nulos", () => {
    const r = lerPeriodo({ investimento: null, leads: null, campanhas: null });
    expect(Array.isArray(r.analise)).toBe(true);
  });
});
