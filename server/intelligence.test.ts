import { describe, expect, it } from "vitest";
import { calculateMappingReadiness } from "./intelligence";

describe("prontidão do Mapeamento Mestre", () => {
  it("classifica como pronto quando todas as ligações essenciais estão confirmadas", () => {
    expect(calculateMappingReadiness({
      hasMetaAccount: true,
      hasMondayBoard: true,
      campaignTypesCount: 1,
      hasLeadChannel: true,
      mappingConfirmed: true,
    })).toEqual({ pendingFields: [], readiness: 100, status: "pronto" });
  });

  it("classifica como parcial quando faltam até duas informações", () => {
    expect(calculateMappingReadiness({
      hasMetaAccount: true,
      hasMondayBoard: true,
      campaignTypesCount: 0,
      hasLeadChannel: true,
      mappingConfirmed: false,
    })).toEqual({ pendingFields: ["Tipo de campanha", "Validação da Scarlett"], readiness: 60, status: "parcial" });
  });

  it("prioriza como pendente quando faltam as conexões essenciais", () => {
    expect(calculateMappingReadiness({
      hasMetaAccount: false,
      hasMondayBoard: false,
      campaignTypesCount: 0,
      hasLeadChannel: false,
      mappingConfirmed: false,
    })).toEqual({
      pendingFields: ["Conta Meta", "Quadro Monday", "Tipo de campanha", "Canal principal", "Validação da Scarlett"],
      readiness: 0,
      status: "pendente",
    });
  });
});

