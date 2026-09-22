export type InstagramProfileCandidate = {
  igUserId: string;
  username: string;
  name: string;
  followersCount: number;
};

/**
 * Token para listar/confirmar perfis. O da agência (usuário do sistema,
 * não expira) vem primeiro: os tokens de OAuth guardados por cliente vieram
 * do Facebook antigo e morreram com ele.
 */
export function getProfileListingToken(oauthToken?: string | null, metaToken?: string | null, tokenAgencia?: string | null): string | null {
  return tokenAgencia || oauthToken || metaToken || null;
}

export function isPendingInstagramSelection(connection?: { accessToken?: string | null; metaIgUserId?: string | null } | null): boolean {
  return Boolean(connection?.accessToken && !connection?.metaIgUserId);
}

export function requireAccessibleInstagramProfile(
  profiles: InstagramProfileCandidate[],
  igUserId: string,
): InstagramProfileCandidate {
  const profile = profiles.find((candidate) => candidate.igUserId === igUserId);
  if (!profile) throw new Error("O perfil Instagram selecionado não faz parte da autorização atual.");
  return profile;
}
