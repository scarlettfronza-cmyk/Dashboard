import { describe, it, expect } from "vitest";
import { classificarCampanha, tipoPeloNome } from "./classificarCampanha";

describe("pelo nome", () => {
  it.each([
    ["[LINK] FORMULARIO BOTOX", "formulario"],
    ["Cadastro - Lead Form Harmonização", "formulario"],
    ["WPP - MAMO", "mensagens"],
    ["Msg iniciada Direct", "mensagens"],
    ["Vídeo Views - institucional", "video"],
    ["VISUALIZAÇÃO DE VÍDEO", "video"],
    ["Visitas ao perfil", "visitas"],
    ["SEGUIDORAS 25-45", "visitas"],
    ["Tráfego perfil", "visitas"],
  ])("%s → %s", (nome, tipo) => {
    expect(tipoPeloNome(nome)).toBe(tipo);
  });
  it("nome sem pista → null", () => {
    expect(tipoPeloNome("Campanha 03")).toBeNull();
  });
  it("nome com mais de uma pista: formulário vence, depois mensagens", () => {
    expect(tipoPeloNome("VIDEO - FORMULARIO")).toBe("formulario");
    expect(tipoPeloNome("WPP com vídeo")).toBe("mensagens");
  });
});

describe("pelo objetivo e pelo resultado", () => {
  it("MESSAGES → mensagens mesmo sem nome", () => {
    expect(classificarCampanha({ nome: "Camp 1", objective: "MESSAGES" })).toBe("mensagens");
  });
  it("OUTCOME_LEADS com conversas → mensagens; com lead de formulário → formulário; sem nada → formulário", () => {
    expect(classificarCampanha({ nome: "C", objective: "OUTCOME_LEADS", conversas: 12 })).toBe("mensagens");
    expect(classificarCampanha({ nome: "C", objective: "OUTCOME_LEADS", leadsFormulario: 3 })).toBe("formulario");
    expect(classificarCampanha({ nome: "C", objective: "OUTCOME_LEADS" })).toBe("formulario");
  });
  it("OUTCOME_ENGAGEMENT com views → vídeo; com conversas → mensagens", () => {
    expect(classificarCampanha({ nome: "C", objective: "OUTCOME_ENGAGEMENT", visualizacoes: 900 })).toBe("video");
    expect(classificarCampanha({ nome: "C", objective: "OUTCOME_ENGAGEMENT", conversas: 4, visualizacoes: 900 })).toBe("mensagens");
  });
  it("OUTCOME_TRAFFIC → visitas; VIDEO_VIEWS → vídeo", () => {
    expect(classificarCampanha({ nome: "C", objective: "OUTCOME_TRAFFIC" })).toBe("visitas");
    expect(classificarCampanha({ nome: "C", objective: "VIDEO_VIEWS" })).toBe("video");
  });
  it("sem nome e sem objetivo, o resultado decide", () => {
    expect(classificarCampanha({ nome: "C", conversas: 1 })).toBe("mensagens");
    expect(classificarCampanha({ nome: "C", leadsFormulario: 1 })).toBe("formulario");
    expect(classificarCampanha({ nome: "C", visualizacoes: 1 })).toBe("video");
  });
  it("nada casou → outros (não vai mais para mensagens)", () => {
    expect(classificarCampanha({ nome: "Campanha 03", objective: "OUTCOME_AWARENESS" })).toBe("outros");
  });
  it("o nome vence o objetivo", () => {
    expect(classificarCampanha({ nome: "Visitas perfil", objective: "MESSAGES" })).toBe("visitas");
  });
});
