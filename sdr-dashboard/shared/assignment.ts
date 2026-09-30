/** Define quando o formulário de vínculo já pode ser enviado. */
export function canAssignClient(sdrId: number | null, boardIds: string[], clientName: string): boolean {
  return sdrId !== null && boardIds.length > 0 && clientName.trim().length > 0;
}
