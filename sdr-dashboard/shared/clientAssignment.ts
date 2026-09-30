export type ClientAssignment = {
  sdrId: number;
  name: string;
  boardId: string;
  clientToken: string;
  isActive: boolean;
};

export function buildClientAssignment(input: Omit<ClientAssignment, "isActive">): ClientAssignment {
  return {
    ...input,
    name: input.name.trim(),
    boardId: input.boardId
      .split(",")
      .map(id => id.trim())
      .filter(Boolean)
      .join(","),
    isActive: true,
  };
}

export function transferClientAssignment<T extends { sdrId: number }>(client: T, nextSdrId: number): T {
  return { ...client, sdrId: nextSdrId };
}

export function listVisibleClients<T extends { sdrId: number; isActive: boolean }>(
  rows: T[],
  userRole: string,
  requestingSdrId: number,
): T[] {
  return rows.filter(row => row.isActive && (userRole === "admin" || row.sdrId === requestingSdrId));
}
