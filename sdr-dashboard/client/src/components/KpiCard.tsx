/**
 * KpiCard — Midnight Operations Dashboard
 * Compact metric card with left accent border and trend indicator.
 */
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface KpiCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  accentColor?: string;
  icon?: React.ReactNode;
  trend?: "up" | "down" | "neutral";
  trendLabel?: string;
  className?: string;
}

export function KpiCard({ label, value, subValue, accentColor = "#7c6af7", icon, trend, trendLabel, className }: KpiCardProps) {
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const trendColor = trend === "up" ? "#22c55e" : trend === "down" ? "#ef4444" : "#8b8fa8";

  return (
    <div
      className={cn("relative rounded-lg p-4 flex flex-col gap-1 overflow-hidden transition-all duration-200 hover:scale-[1.01]", className)}
      style={{
        background: "oklch(1.000 0.015 265.0)",
        border: "1px solid oklch(0.910 0.015 265.0)",
        borderLeft: `3px solid ${accentColor}`,
      }}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium uppercase tracking-wider" style={{ color: "oklch(0.520 0.012 265.0)" }}>
          {label}
        </span>
        {icon && (
          <span className="opacity-60" style={{ color: accentColor }}>
            {icon}
          </span>
        )}
      </div>
      <div className="flex items-end gap-2 mt-1">
        <span
          className="text-3xl font-extrabold leading-none tracking-tight"
          style={{ fontFamily: "'DM Sans', sans-serif", color: "oklch(0.200 0.008 265.0)", letterSpacing: "-0.02em" }}
        >
          {value}
        </span>
        {subValue && (
          <span className="text-sm mb-1" style={{ color: "oklch(0.560 0.012 265.0)", fontFamily: "'DM Mono', monospace" }}>
            {subValue}
          </span>
        )}
      </div>
      {trend && trendLabel && (
        <div className="flex items-center gap-1 mt-1">
          <TrendIcon size={11} style={{ color: trendColor }} />
          <span className="text-sm" style={{ color: trendColor }}>
            {trendLabel}
          </span>
        </div>
      )}
    </div>
  );
}
