/**
 * BarChartCard — Midnight Operations Dashboard
 * Bar chart for monthly leads vs closed deals.
 */
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface BarChartCardProps {
  title: string;
  data: { mes: string; leads: number; fechados: number }[];
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg px-3 py-2 text-sm shadow-xl"
        style={{ background: "oklch(0.970 0.015 265.0)", border: "1px solid oklch(0.890 0.015 265.0)", color: "oklch(0.220 0.008 265.0)" }}>
        <p className="font-semibold mb-1">{label}</p>
        {payload.map((p) => (
          <p key={p.name} style={{ color: p.color }}>{p.name}: {p.value}</p>
        ))}
      </div>
    );
  }
  return null;
};

export function BarChartCard({ title, data }: BarChartCardProps) {
  // Shorten month names
  const chartData = data.map((d) => ({
    ...d,
    mes: d.mes.replace("Mês ", "").replace(" 2026", "").replace(" 2025", ""),
  }));

  return (
    <div className="rounded-lg p-5 flex flex-col gap-4"
      style={{ background: "oklch(1.000 0.015 265.0)", border: "1px solid oklch(0.910 0.015 265.0)" }}>
      <h3 className="text-sm font-semibold" style={{ fontFamily: "'DM Sans', sans-serif", color: "oklch(0.250 0.008 265.0)" }}>
        {title}
      </h3>
      {data.length === 0 ? (
        <div className="flex items-center justify-center h-40 text-sm" style={{ color: "oklch(0.600 0.012 265.0)" }}>
          Sem dados
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.925 0.015 265.0)" vertical={false} />
            <XAxis dataKey="mes" tick={{ fill: "oklch(0.520 0.012 265.0)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "oklch(0.520 0.012 265.0)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "oklch(0.970 0.015 265.0/ 0.5)" }} />
            <Legend formatter={(v) => <span style={{ color: "oklch(0.440 0.012 265.0)", fontSize: 11 }}>{v}</span>} />
            <Bar dataKey="leads" name="Total Leads" fill="oklch(0.62 0.19 280)" radius={[3, 3, 0, 0]} />
            <Bar dataKey="fechados" name="Fechados" fill="oklch(0.72 0.18 160)" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

