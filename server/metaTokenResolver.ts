/**
 * De onde vem o token do Meta de um cliente.
 *
 * O token era guardado por cliente, o que obrigava a colar o mesmo valor
 * dezenove vezes e a repetir tudo a cada renovação. Na prática a agência usa
 * um único usuário do sistema para todas as contas, então o token é um só.
 *
 * O Monday já resolvia assim — token global com queda para o do cliente — e
 * aqui o Meta passa a seguir o mesmo caminho. A conta de anúncio continua por
 * cliente: ela é o vínculo entre a clínica e a conta, não uma credencial.
 */

export const CHAVE_TOKEN_AGENCIA = "meta_access_token";

export type OrigemToken = "agencia" | "cliente" | null;

export type TokenResolvido = {
  token: string | null;
  origem: OrigemToken;
  /** Conta de anúncio do cliente; nunca vem do token da agência. */
  adAccountId: string | null;
};

/**
 * O token da agência tem precedência: ao renová-lo, todos os clientes passam
 * a usar o novo sem que seja preciso tocar em cada um.
 */
export function resolverToken(
  tokenAgencia: string | null | undefined,
  integracaoCliente: { accessToken?: string | null; adAccountId?: string | null } | null | undefined,
): TokenResolvido {
  const doCliente = integracaoCliente?.accessToken?.trim() || null;
  const daAgencia = tokenAgencia?.trim() || null;
  const adAccountId = integracaoCliente?.adAccountId?.trim() || null;

  if (daAgencia) return { token: daAgencia, origem: "agencia", adAccountId };
  if (doCliente) return { token: doCliente, origem: "cliente", adAccountId };
  return { token: null, origem: null, adAccountId };
}

/** Mensagem para a tela dizer por que os dados de mídia não aparecem. */
export function descreverAusencia(r: TokenResolvido): string | null {
  if (!r.token) return "Nenhum token do Meta configurado, nem da agência nem deste cliente.";
  if (!r.adAccountId) return "Token disponível, mas este cliente não tem conta de anúncio escolhida.";
  return null;
}
