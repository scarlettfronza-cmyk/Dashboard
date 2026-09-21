export type AdditionalAdAccount = { id: string; name: string };

export function buildClientAdAccountIds(
  primaryAccountId: string | null | undefined,
  additionalAccounts: AdditionalAdAccount[] = [],
) {
  const accountIds = [
    ...(primaryAccountId ?? "").split(","),
    ...additionalAccounts.map((account) => account.id),
  ]
    .map((accountId) => accountId.trim())
    .filter(Boolean);

  return Array.from(new Set(accountIds));
}
