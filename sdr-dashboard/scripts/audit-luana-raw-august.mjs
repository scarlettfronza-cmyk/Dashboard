const BOARDS = [
  { id: "18406678106", client: "Dra Tatiana Patruni" },
  { id: "18406699335", client: "Dra Estéfani Molinar" },
  { id: "18406696056", client: "Dr Jonas Lenzi" },
  { id: "18406692406", client: "Dr. Mansur" },
  { id: "18418032339", client: "Dr Lucas Moura" },
];

const RANGE = { from: "2026-08-01", to: "2026-08-31" };
const DATE_TITLES = ["Data da consulta", "Data Consulta Fechada", "Data Fechamento", "Data Procedimento Fechado", "Data do Procedimento", "Data da cirurgia"];

function parseDate(value) {
  const raw = String(value ?? "").trim();
  const br = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (br) return `${br[3]}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
  const iso = raw.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : null;
}

function parseMoney(value) {
  const compact = String(value ?? "").replace(/[^\d,.-]/g, "");
  if (!compact) return 0;
  const normalized = compact.includes(",") && compact.includes(".")
    ? compact.replace(/\./g, "").replace(",", ".")
    : compact.replace(/\.(?=\d{3}\b)/g, "").replace(",", ".");
  return Number(normalized) || 0;
}

const isAugust = (value) => {
  const date = parseDate(value);
  return Boolean(date && date >= RANGE.from && date <= RANGE.to);
};

async function monday(query) {
  const response = await fetch("https://api.monday.com/v2", {
    method: "POST",
    headers: { Authorization: process.env.MONDAY_API_TOKEN, "Content-Type": "application/json", "API-Version": "2024-01" },
    body: JSON.stringify({ query }),
  });
  if (!response.ok) throw new Error(`Monday respondeu ${response.status}.`);
  const body = await response.json();
  if (body.errors?.length) throw new Error(body.errors.map((error) => error.message).join("; "));
  return body.data;
}

async function fetchBoard(board) {
  const allItems = [];
  let cursor = null;
  let boardName = "";
  let columns = [];
  do {
    const cursorArg = cursor ? `, cursor: \"${cursor.replace(/\"/g, "\\\"")}\"` : "";
    const data = await monday(`query { boards(ids: [${board.id}]) { name columns { id title type } items_page(limit: 500${cursorArg}) { cursor items { column_values { id text } } } } }`);
    const source = data.boards?.[0];
    boardName = source?.name ?? boardName;
    columns = source?.columns ?? columns;
    allItems.push(...(source?.items_page?.items ?? []));
    cursor = source?.items_page?.cursor ?? null;
    if (cursor) await new Promise((resolve) => setTimeout(resolve, 350));
  } while (cursor);
  return { ...board, boardName, columns, items: allItems };
}

function summarize(board) {
  const titleById = new Map(board.columns.map((column) => [column.id, column.title]));
  const numberColumns = board.columns.filter((column) => ["numbers", "numeric"].includes(column.type));
  const dateIds = DATE_TITLES.map((title) => [title, board.columns.find((column) => column.title.toLowerCase() === title.toLowerCase())?.id]).filter(([, id]) => id);
  const statusId = board.columns.find((column) => column.title.toLowerCase() === "status do lead")?.id;
  const closed = board.items.filter((item) => {
    const cells = Object.fromEntries(item.column_values.map((value) => [value.id, value.text ?? ""]));
    return cells[statusId] === "Negócio fechado";
  });
  const byReferenceDate = Object.fromEntries(dateIds.map(([title, id]) => {
    const qualified = closed.filter((item) => {
      const cells = Object.fromEntries(item.column_values.map((value) => [value.id, value.text ?? ""]));
      return isAugust(cells[id]);
    });
    const sums = Object.fromEntries(numberColumns.map((column) => [column.title, qualified.reduce((sum, item) => {
      const cells = Object.fromEntries(item.column_values.map((value) => [value.id, value.text ?? ""]));
      return sum + parseMoney(cells[column.id]);
    }, 0)]));
    return [title, { fechamentos: qualified.length, valores_por_coluna: sums }];
  }));
  return { client: board.client, board: board.boardName, fechamentos_por_data: byReferenceDate, colunas_numericas: numberColumns.map((column) => titleById.get(column.id)) };
}

async function main() {
  if (!process.env.MONDAY_API_TOKEN) throw new Error("MONDAY_API_TOKEN não está disponível para a auditoria.");
  const result = [];
  for (const board of BOARDS) {
    result.push(summarize(await fetchBoard(board)));
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  console.log(JSON.stringify({ range: RANGE, boards: result }, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
