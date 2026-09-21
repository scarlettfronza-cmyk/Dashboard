export function shouldAutoSyncMonday(params: {
  managerToken: string | null;
  clientId: number | null;
  mondayBoardId: string | null | undefined;
}): boolean {
  return Boolean(params.managerToken && params.clientId && params.mondayBoardId);
}
