const BOARD_IDS = ["18406678106", "18406699335", "18406696056", "18406692406", "18418032339"];

async function main() {
  const token = process.env.MONDAY_API_TOKEN;
  if (!token) throw new Error("MONDAY_API_TOKEN não está disponível para esta inspeção.");
  const query = `query { boards(ids: [${BOARD_IDS.join(",")}]) { id name columns { id title type } } }`;
  const response = await fetch("https://api.monday.com/v2", {
    method: "POST",
    headers: { Authorization: token, "Content-Type": "application/json", "API-Version": "2024-01" },
    body: JSON.stringify({ query }),
  });
  if (!response.ok) throw new Error(`Monday respondeu ${response.status}.`);
  const body = await response.json();
  if (body.errors?.length) throw new Error(body.errors.map((error) => error.message).join("; "));
  const safe = body.data.boards.map((board) => ({
    boardId: board.id,
    boardName: board.name,
    columns: board.columns.map((column) => ({ id: column.id, title: column.title, type: column.type })),
  }));
  console.log(JSON.stringify(safe, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
