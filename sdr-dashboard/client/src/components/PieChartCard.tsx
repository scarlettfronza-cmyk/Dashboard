/**
 * PieChartCard — Midnight Operations Dashboard
 * Pie/donut chart with legend, matching the Monday.com reference layout.
 */
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface DataItem {
  name: string;
  value: number;
  color: string;
}

interface PieChartCardProps {
  title: string;
  data: DataItem[];
  total?: number;
}

const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number; payload: DataItem }> }) => {
  if (active && payload && payload.length) {
    const item = payload[0];
    return (
      <div className="rounded-lg px-3 py-2 text-sm shadow-xl"
        style={{ background: "oklch(0.970 0.015 265.0)", border: "1px solid oklch(0.890 0.015 265.0)", color: "oklch(0.220 0.008 265.0)" }}>
        <p className="font-semibold">{item.name}</p>
        <p style={{ color: item.payload.color }}>{item.value} leads</p>
      </div>
    );
  }
  return null;
};

export function PieChartCard({ title, data, total }: PieChartCardProps) {
  const totalValue = total ?? data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="rounded-lg p-5 flex flex-col gap-4"
      style={{ background: "oklch(1.000 0.015 265.0)", border: "1px solid oklch(0.910 0.015 265.0)" }}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold" style={{ fontFamily: "'DM Sans', sans-serif", color: "oklch(0.250 0.008 265.0)" }}>
          {title}
        </h3>
        {totalValue > 0 && (
          <span className="text-sm px-2 py-0.5 rounded-full" style={{ background: "oklch(0.925 0.015 265.0)", color: "oklch(0.480 0.012 265.0)" }}>
            {totalValue} total
          </span>
        )}
      </div>

      {data.length === 0 ? (
        <div className="flex items-center justify-center h-40 text-sm" style={{ color: "oklch(0.600 0.012 265.0)" }}>
          Sem dados
        </div>
      ) : (
        <div className="flex gap-4 items-center min-h-[160px]">
          <div className="w-40 h-40 flex-shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} cx="50%" cy="50%" innerRadius={36} outerRadius={68} paddingAngle={2} dataKey="value">
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="oklch(1.000 0.015 265.0)" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex-1 space-y-1.5 min-w-0">
            {data.slice(0, 8).map((item) => {
              const pct = totalValue > 0 ? ((item.value / totalValue) * 100).toFixed(1) : "0";
              return (
                <div key={item.name} className="flex items-center gap-2 text-sm">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: item.color }} />
                  <span className="truncate flex-1" style={{ color: "oklch(0.380 0.008 265.0)" }}>{item.name}</span>
                  <span className="font-medium flex-shrink-0" style={{ color: "oklch(0.250 0.008 265.0)" }}>{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
