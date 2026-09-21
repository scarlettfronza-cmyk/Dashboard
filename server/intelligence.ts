export type MappingReadinessInput = {
  hasMetaAccount: boolean;
  hasMondayBoard: boolean;
  campaignTypesCount: number;
  hasLeadChannel: boolean;
  mappingConfirmed: boolean;
};

export function calculateMappingReadiness(input: MappingReadinessInput) {
  const pendingFields: string[] = [];
  if (!input.hasMetaAccount) pendingFields.push("Conta Meta");
  if (!input.hasMondayBoard) pendingFields.push("Quadro Monday");
  if (!input.campaignTypesCount) pendingFields.push("Tipo de campanha");
  if (!input.hasLeadChannel) pendingFields.push("Canal principal");
  if (!input.mappingConfirmed) pendingFields.push("Validação da Scarlett");

  const readiness = Math.max(0, 100 - (pendingFields.length * 20));
  const status = pendingFields.length === 0 ? "pronto" : pendingFields.length <= 2 ? "parcial" : "pendente";
  return { pendingFields, readiness, status } as const;
}
