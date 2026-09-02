import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { formatCurrency, formatCompact } from "@/lib/date-utils";
import type { RevenuePoint } from "@/lib/api-hooks";

interface RevenueChartProps {
  data: RevenuePoint[];
}

export function RevenueChart({ data }: RevenueChartProps) {
  return (
    <div className="chart-card animate-fade-in-delay-1 flex flex-col h-[400px]">
      <h3 className="font-semibold text-lg mb-1">Receita no período</h3>
      <p className="text-sm text-muted-foreground mb-6">
        Faturamento agregado por parte do período
      </p>

      <div className="flex-1 w-full min-h-0 relative">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
          >
            <defs>
              <linearGradient id="colorCurrent" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(160 84% 39%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(160 84% 39%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="hsl(222 20% 16%)"
            />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "hsl(215 20% 55%)", fontSize: 12 }}
              dy={10}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: "hsl(215 20% 55%)", fontSize: 12 }}
              tickFormatter={(value) => formatCompact(value)}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="previous"
              stroke="hsl(215 20% 35%)"
              strokeWidth={2}
              fill="transparent"
              strokeDasharray="4 4"
            />
            <Area
              type="monotone"
              dataKey="current"
              stroke="hsl(160 84% 39%)"
              strokeWidth={3}
              fillOpacity={1}
              fill="url(#colorCurrent)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function CustomTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    const current = payload.find((p: any) => p.dataKey === "current")?.value || 0;
    const previous =
      payload.find((p: any) => p.dataKey === "previous")?.value || 0;

    return (
      <div className="custom-tooltip">
        <p className="label font-medium mb-3">{label}</p>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-primary"></div>
            <span className="text-xs text-muted-foreground mr-4">Atual</span>
            <span className="value ml-auto">{formatCurrency(current)}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-muted-foreground"></div>
            <span className="text-xs text-muted-foreground mr-4">Anterior</span>
            <span className="value ml-auto text-muted-foreground font-medium">
              {formatCurrency(previous)}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
