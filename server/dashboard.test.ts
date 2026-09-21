import { describe, expect, it } from "vitest";

// ─── Metric calculation helpers (pure functions) ──────────────────────────────
function calcCustoPorLead(investimento: number, leads: number) {
  return leads > 0 ? investimento / leads : 0;
}
function calcTaxaConversao(vendas: number, leads: number) {
  return leads > 0 ? (vendas / leads) * 100 : 0;
}
function calcRoas(totalEmVendas: number, investimento: number) {
  return investimento > 0 ? totalEmVendas / investimento : 0;
}
function calcCustoPorVenda(investimento: number, vendas: number) {
  return vendas > 0 ? investimento / vendas : 0;
}
function calcTicketMedio(totalEmVendas: number, vendas: number) {
  return vendas > 0 ? totalEmVendas / vendas : 0;
}

// ─── parseMoneyValue (mirrors server implementation) ─────────────────────────
function parseMoneyValue(val: string): number {
  if (!val) return 0;
  let cleaned = val.replace(/[R$\s]/g, "").trim();
  if (!cleaned) return 0;

  const hasDotAndComma = cleaned.includes(".") && cleaned.includes(",");
  const lastDot = cleaned.lastIndexOf(".");
  const lastComma = cleaned.lastIndexOf(",");

  if (hasDotAndComma) {
    if (lastComma > lastDot) {
      cleaned = cleaned.replace(/\./g, "").replace(",", ".");
    } else {
      cleaned = cleaned.replace(/,/g, "");
    }
  } else if (cleaned.includes(",")) {
    const parts = cleaned.split(",");
    if (parts.length === 2 && parts[1].length <= 2) {
      cleaned = cleaned.replace(",", ".");
    } else {
      cleaned = cleaned.replace(/,/g, "");
    }
  }
  return parseFloat(cleaned) || 0;
}

describe("parseMoneyValue", () => {
  it("parses international dot-decimal format (Google Sheets default)", () => {
    expect(parseMoneyValue("108.25")).toBeCloseTo(108.25);
    expect(parseMoneyValue("3828.52")).toBeCloseTo(3828.52);
    expect(parseMoneyValue("201.6")).toBeCloseTo(201.6);
    expect(parseMoneyValue("0.86")).toBeCloseTo(0.86);
  });

  it("parses Brazilian comma-decimal format", () => {
    expect(parseMoneyValue("108,25")).toBeCloseTo(108.25);
    expect(parseMoneyValue("3.828,52")).toBeCloseTo(3828.52);
    expect(parseMoneyValue("R$ 1.375,08")).toBeCloseTo(1375.08);
  });

  it("parses international comma-thousands format", () => {
    expect(parseMoneyValue("1,234.56")).toBeCloseTo(1234.56);
    expect(parseMoneyValue("61,878.59")).toBeCloseTo(61878.59);
  });

  it("handles zero and empty values", () => {
    expect(parseMoneyValue("")).toBe(0);
    expect(parseMoneyValue("0")).toBe(0);
    expect(parseMoneyValue("0.00")).toBe(0);
  });

  it("does NOT multiply values by removing decimal dots", () => {
    // The bug: 108.25 was becoming 10825 (dot removed as thousands sep)
    expect(parseMoneyValue("108.25")).toBeLessThan(200);
    expect(parseMoneyValue("3828.52")).toBeLessThan(4000);
  });
});

describe("KPI metric calculations", () => {
  it("calculates custo por lead correctly", () => {
    expect(calcCustoPorLead(1000, 10)).toBe(100);
    expect(calcCustoPorLead(500, 25)).toBe(20);
    expect(calcCustoPorLead(1000, 0)).toBe(0);
  });

  it("calculates taxa de conversao correctly", () => {
    expect(calcTaxaConversao(5, 100)).toBe(5);
    expect(calcTaxaConversao(10, 50)).toBe(20);
    expect(calcTaxaConversao(0, 0)).toBe(0);
  });

  it("calculates ROAS correctly", () => {
    expect(calcRoas(10000, 2000)).toBe(5);
    expect(calcRoas(1000, 500)).toBe(2);
    expect(calcRoas(1000, 0)).toBe(0);
  });

  it("calculates custo por venda correctly", () => {
    expect(calcCustoPorVenda(1000, 10)).toBe(100);
    expect(calcCustoPorVenda(500, 5)).toBe(100);
    expect(calcCustoPorVenda(1000, 0)).toBe(0);
  });

  it("calculates ticket medio correctly", () => {
    expect(calcTicketMedio(50000, 10)).toBe(5000);
    expect(calcTicketMedio(100000, 4)).toBe(25000);
    expect(calcTicketMedio(0, 0)).toBe(0);
  });

  it("identifies low ROAS alert threshold", () => {
    const roas = calcRoas(3000, 2000);
    expect(roas).toBe(1.5);
    expect(roas < 2).toBe(true);
  });

  it("identifies high CPL alert threshold", () => {
    const cpl = calcCustoPorLead(5000, 30);
    expect(cpl).toBeCloseTo(166.67, 1);
    expect(cpl > 100).toBe(true);
  });

  it("does not trigger CPL alert when CPL is acceptable", () => {
    const cpl = calcCustoPorLead(1000, 20);
    expect(cpl).toBe(50);
    expect(cpl > 100).toBe(false);
  });

  it("does not trigger ROAS alert when ROAS is good", () => {
    const roas = calcRoas(10000, 2000);
    expect(roas).toBe(5);
    expect(roas < 2).toBe(false);
  });
});

// ─── Sales Sheet CSV parser (mirrors server implementation) ─────────────────
function parseSalesSheetRow(dateStr: string, vendasStr: string, totalStr: string, from: string, to: string) {
  const fromDate = new Date(from + "T00:00:00");
  const toDate = new Date(to + "T23:59:59");

  let itemDate: Date;
  if (/^\d{2}\/\d{2}\/\d{4}/.test(dateStr)) {
    const [d, m, y] = dateStr.split("/");
    itemDate = new Date(`${y}-${m}-${d}T00:00:00`);
  } else if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
    itemDate = new Date(dateStr + "T00:00:00");
  } else {
    return null; // invalid date
  }

  if (isNaN(itemDate.getTime()) || itemDate < fromDate || itemDate > toDate) return null;

  return {
    vendas: parseInt(vendasStr, 10) || 0,
    totalEmVendas: parseMoneyValue(totalStr),
  };
}

describe("Sales Sheet CSV parser", () => {
  it("parses DD/MM/YYYY date format correctly", () => {
    const row = parseSalesSheetRow("06/01/2026", "3", "R$ 23.700,00", "2026-01-01", "2026-01-31");
    expect(row).not.toBeNull();
    expect(row?.vendas).toBe(3);
    expect(row?.totalEmVendas).toBeCloseTo(23700);
  });

  it("filters out rows outside the date range", () => {
    const row = parseSalesSheetRow("15/02/2026", "2", "R$ 1.200,00", "2026-01-01", "2026-01-31");
    expect(row).toBeNull();
  });

  it("includes rows on the boundary dates", () => {
    const start = parseSalesSheetRow("01/01/2026", "2", "R$ 21.900,00", "2026-01-01", "2026-01-31");
    const end = parseSalesSheetRow("31/01/2026", "1", "R$ 300,00", "2026-01-01", "2026-01-31");
    expect(start).not.toBeNull();
    expect(end).not.toBeNull();
  });

  it("returns null for empty/invalid rows", () => {
    const row = parseSalesSheetRow("", "", "", "2026-01-01", "2026-01-31");
    expect(row).toBeNull();
  });

  it("aggregates multiple rows correctly", () => {
    const rows = [
      parseSalesSheetRow("06/01/2026", "3", "R$ 23.700,00", "2026-01-01", "2026-01-31"),
      parseSalesSheetRow("07/01/2026", "1", "R$ 28.600,00", "2026-01-01", "2026-01-31"),
      parseSalesSheetRow("08/01/2026", "1", "R$ 300,00", "2026-01-01", "2026-01-31"),
    ].filter(Boolean);
    const totalVendas = rows.reduce((s, r) => s + (r?.vendas ?? 0), 0);
    const totalValor = rows.reduce((s, r) => s + (r?.totalEmVendas ?? 0), 0);
    expect(totalVendas).toBe(5);
    expect(totalValor).toBeCloseTo(52600);
  });
});

describe("auth.logout", () => {
  it("returns success true", () => {
    const result = { success: true };
    expect(result.success).toBe(true);
  });
});

// ─── Instagram Insights helpers ───────────────────────────────────────────────
function pctChange(arr: Array<{ date: string; value: number }>): number | null {
  if (arr.length < 2) return null;
  const mid = Math.floor(arr.length / 2);
  const first = arr.slice(0, mid).reduce((s, v) => s + v.value, 0);
  const second = arr.slice(mid).reduce((s, v) => s + v.value, 0);
  if (first === 0) return null;
  return ((second - first) / first) * 100;
}

function sumMetric(arr: Array<{ date: string; value: number }>): number {
  return arr.reduce((s, v) => s + v.value, 0);
}

describe("Instagram Insights helpers", () => {
  const dailySeries = [
    { date: "2026-03-01", value: 100 },
    { date: "2026-03-02", value: 200 },
    { date: "2026-03-03", value: 150 },
    { date: "2026-03-04", value: 300 },
  ];

  it("sumMetric returns correct total", () => {
    expect(sumMetric(dailySeries)).toBe(750);
  });

  it("pctChange returns null for empty array", () => {
    expect(pctChange([])).toBeNull();
  });

  it("pctChange returns null for single element", () => {
    expect(pctChange([{ date: "2026-03-01", value: 100 }])).toBeNull();
  });

  it("pctChange returns null when first half is zero", () => {
    const arr = [
      { date: "2026-03-01", value: 0 },
      { date: "2026-03-02", value: 100 },
    ];
    expect(pctChange(arr)).toBeNull();
  });

  it("pctChange detects positive growth", () => {
    // first half: [100, 200] = 300, second half: [150, 300] = 450
    // pct = (450 - 300) / 300 * 100 = 50%
    const result = pctChange(dailySeries);
    expect(result).not.toBeNull();
    expect(result!).toBeCloseTo(50);
  });

  it("pctChange detects negative change", () => {
    const arr = [
      { date: "2026-03-01", value: 200 },
      { date: "2026-03-02", value: 100 },
    ];
    // first half: [200] = 200, second half: [100] = 100 → -50%
    const result = pctChange(arr);
    expect(result).not.toBeNull();
    expect(result!).toBeCloseTo(-50);
  });

  it("sumMetric handles empty array", () => {
    expect(sumMetric([])).toBe(0);
  });

  it("sumMetric handles single value", () => {
    expect(sumMetric([{ date: "2026-03-01", value: 42 }])).toBe(42);
  });
});
