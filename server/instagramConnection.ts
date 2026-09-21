import { getIntegration } from "./db";

export type InstagramIntegrationCandidate = {
  accessToken?: string | null;
  metaIgUserId?: string | null;
  metaIgUsername?: string | null;
};

export type PreferredInstagramConnection = {
  accessToken: string;
  metaIgUserId: string;
  metaIgUsername: string | null;
  source: "instagram_oauth" | "meta_token";
};

/**
 * Keeps Instagram identity and content tied to the dedicated OAuth selection.
 * A Meta Ads token may supply authentication only when the OAuth row has no token.
 */
export function pickPreferredInstagramConnection(
  instagramOAuth: InstagramIntegrationCandidate | null | undefined,
  metaToken: InstagramIntegrationCandidate | null | undefined,
): PreferredInstagramConnection | null {
  const selectedIdentity = instagramOAuth?.metaIgUserId
    ? { integration: instagramOAuth, source: "instagram_oauth" as const }
    : metaToken?.metaIgUserId
      ? { integration: metaToken, source: "meta_token" as const }
      : null;

  const accessToken = instagramOAuth?.accessToken || metaToken?.accessToken || null;
  if (!selectedIdentity?.integration.metaIgUserId || !accessToken) return null;

  return {
    accessToken,
    metaIgUserId: selectedIdentity.integration.metaIgUserId,
    metaIgUsername: selectedIdentity.integration.metaIgUsername ?? null,
    source: selectedIdentity.source,
  };
}

export async function resolvePreferredInstagramConnection(clientId: number) {
  const [instagramOAuth, metaToken] = await Promise.all([
    getIntegration(clientId, "instagram_oauth"),
    getIntegration(clientId, "meta_token"),
  ]);

  return pickPreferredInstagramConnection(instagramOAuth, metaToken);
}
