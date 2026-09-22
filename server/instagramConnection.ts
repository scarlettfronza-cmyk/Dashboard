import { getIntegration } from "./db";
import { getSystemSetting } from "./_core/systemRouter";
import { CHAVE_TOKEN_AGENCIA } from "./metaTokenResolver";

export type InstagramIntegrationCandidate = {
  accessToken?: string | null;
  metaIgUserId?: string | null;
  metaIgUsername?: string | null;
};

export type PreferredInstagramConnection = {
  accessToken: string;
  metaIgUserId: string;
  metaIgUsername: string | null;
  /** De onde veio a identidade (qual perfil). */
  source: "instagram_oauth" | "meta_token";
  /** De onde veio a autenticação (qual token). */
  tokenOrigem: "agencia" | "instagram_oauth" | "meta_token";
};

/**
 * A identidade (qual perfil) segue a escolha feita na tela: primeiro a linha
 * instagram_oauth, depois a meta_token. A autenticação é outra história: o
 * token da agência, quando existe, vale para todos os perfis que o usuário
 * do sistema enxerga e não expira — por isso vem antes dos tokens por
 * cliente, que ficaram órfãos quando o Facebook antigo foi removido.
 */
export function pickPreferredInstagramConnection(
  instagramOAuth: InstagramIntegrationCandidate | null | undefined,
  metaToken: InstagramIntegrationCandidate | null | undefined,
  tokenAgencia?: string | null,
): PreferredInstagramConnection | null {
  const selectedIdentity = instagramOAuth?.metaIgUserId
    ? { integration: instagramOAuth, source: "instagram_oauth" as const }
    : metaToken?.metaIgUserId
      ? { integration: metaToken, source: "meta_token" as const }
      : null;

  const auth = tokenAgencia
    ? { accessToken: tokenAgencia, tokenOrigem: "agencia" as const }
    : instagramOAuth?.accessToken
      ? { accessToken: instagramOAuth.accessToken, tokenOrigem: "instagram_oauth" as const }
      : metaToken?.accessToken
        ? { accessToken: metaToken.accessToken, tokenOrigem: "meta_token" as const }
        : null;
  if (!selectedIdentity?.integration.metaIgUserId || !auth) return null;

  return {
    ...auth,
    metaIgUserId: selectedIdentity.integration.metaIgUserId,
    metaIgUsername: selectedIdentity.integration.metaIgUsername ?? null,
    source: selectedIdentity.source,
  };
}

export async function resolvePreferredInstagramConnection(clientId: number) {
  const [instagramOAuth, metaToken, tokenAgencia] = await Promise.all([
    getIntegration(clientId, "instagram_oauth"),
    getIntegration(clientId, "meta_token"),
    getSystemSetting(CHAVE_TOKEN_AGENCIA),
  ]);

  return pickPreferredInstagramConnection(instagramOAuth, metaToken, tokenAgencia);
}
