import { describe, expect, it } from "vitest";
import { montarDiagnostico, resumir, mesmoId, type Fatos } from "./metaDiagnostico";

const base: Fatos = {
  origemToken: "agencia", tokenValido: true, nomeToken: "Relatorio Escarlate",
  contasVisiveis: 63, contaConfigurada: "act_1625411728898223", contaEncontrada: true,
  investimentoPeriodo: 1500, periodo: "setembro",
};
const titulos = (f: Fatos) => montarDiagnostico(f).map((a) => a.titulo).join(" | ");

describe("comparação de id de conta", () => {
  it("ignora o prefixo act_", () => {
    expect(mesmoId("act_123", "123")).toBe(true);
    expect(mesmoId("123", "act_123")).toBe(true);
    expect(mesmoId("act_123", "act_123")).toBe(true);
  });
  it("distingue contas diferentes", () => {
    expect(mesmoId("act_123", "act_124")).toBe(false);
    expect(mesmoId(null, "act_1")).toBe(false);
  });
});

describe("diagnóstico do Meta", () => {
  it("para no primeiro impedimento, sem afirmar o que não verificou", () => {
    const r = montarDiagnostico({ ...base, origemToken: null });
    expect(r).toHaveLength(1);
    expect(r[0].titulo).toContain("Nenhum token");
  });

  it("relata token recusado e não segue adiante", () => {
    const r = montarDiagnostico({ ...base, tokenValido: false, erroToken: "expirado" });
    expect(r.at(-1)?.detalhe).toContain("expirado");
    expect(titulos({ ...base, tokenValido: false })).not.toContain("contas de anúncio visíveis");
  });

  it("aponta escopo quando nenhuma conta é vista", () => {
    const r = montarDiagnostico({ ...base, contasVisiveis: 0 });
    expect(r.at(-1)?.detalhe).toContain("ads_read");
  });

  it("explica que compartilhar como parceiro não basta", () => {
    const r = montarDiagnostico({ ...base, contaEncontrada: false });
    const ultimo = r.at(-1)!;
    expect(ultimo.nivel).toBe("erro");
    expect(ultimo.detalhe).toContain("usuário do sistema");
    expect(ultimo.detalhe).toContain("parceiro não basta");
  });

  it("sugere contas parecidas quando a configurada não aparece", () => {
    const r = montarDiagnostico({
      ...base, contaEncontrada: false,
      parecidas: [{ id: "act_476187328917757", name: "Mario" }],
    });
    expect(r.at(-1)?.detalhe).toContain("Mario");
  });

  it("distingue sem investimento de configuração errada", () => {
    const r = montarDiagnostico({ ...base, investimentoPeriodo: 0 });
    const ultimo = r.at(-1)!;
    expect(ultimo.nivel).toBe("aviso");
    expect(ultimo.detalhe).toContain("configuração está correta");
  });

  it("confirma quando há investimento", () => {
    const r = montarDiagnostico(base);
    expect(r.at(-1)?.nivel).toBe("ok");
    expect(resumir(r).nivel).toBe("ok");
  });

  it("avisa quando nenhuma conta foi escolhida", () => {
    const r = montarDiagnostico({ ...base, contaConfigurada: null });
    expect(r.at(-1)?.nivel).toBe("aviso");
    expect(r.at(-1)?.titulo).toContain("Nenhuma conta");
  });

  it("relata erro do Meta na consulta de desempenho", () => {
    const r = montarDiagnostico({ ...base, erroInsights: "(#100) versão não suportada" });
    expect(r.at(-1)?.nivel).toBe("erro");
    expect(r.at(-1)?.detalhe).toContain("versão não suportada");
  });

  it("o resumo prioriza erro sobre aviso", () => {
    expect(resumir(montarDiagnostico({ ...base, contaEncontrada: false })).nivel).toBe("erro");
    expect(resumir(montarDiagnostico({ ...base, investimentoPeriodo: 0 })).nivel).toBe("aviso");
  });

  it("diz de onde vem o token", () => {
    expect(titulos(base)).toContain("token da agência");
    expect(titulos({ ...base, origemToken: "cliente" })).toContain("token deste cliente");
  });
});
