import { sincronizar } from "../server/sync.ts";

const boards = [
  ["18406678106", "Dra Tatiana Patruni"],
  ["18406699335", "Dra Estéfani Molinar"],
  ["18406696056", "Dr Jonas Lenzi"],
  ["18406692406", "Dr. Mansur"],
  ["18418032339", "Dr Lucas Moura"],
].map(([id, clientName]) => ({ id, clientName }));

const result = await sincronizar(boards, {
  maxAttempts: 1,
  requestTimeoutMs: 12_000,
  boardTimeoutMs: 25_000,
  stopOnFailure: false,
});

console.log(JSON.stringify(result));
process.exit(0);
