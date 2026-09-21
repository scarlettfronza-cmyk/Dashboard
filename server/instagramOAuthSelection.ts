export type InstagramProfileCandidate = {
  igUserId: string;
  username: string;
  name: string;
  followersCount: number;
};

export function getProfileListingToken(oauthToken?: string | null, metaToken?: string | null): string | null {
  return oauthToken || metaToken || null;
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
