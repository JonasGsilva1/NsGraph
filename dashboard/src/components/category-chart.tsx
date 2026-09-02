import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
} from "recharts";
import { formatCurrency, formatCompact } from "@/lib/date-utils";
import type { CategorySales } from "@/lib/api-hooks";

interface CategoryChartProps {
  data: CategorySales[];
}

const COLORS = [
  "hsl(160 84% 39%)",
  "hsl(200 80% 55%)",
  "hsl(280 70% 55%)",
  "hsl(40 90% 60%)",
  "hsl(340 75% 55%)",
  "hsl(160 60% 45%)",
  "hsl(200 60% 55%)",
  "hsl(280 50% 60%)",
  "hsl(40 70% 50%)",
  "hsl(340 50% 60%)",
];

export function CategoryChart({ data }: CategoryChartProps) {
  const chartData = data.map((d) => ({
    ...d,
    shortName: d.name.length > 20 ? d.name.substring(0, 18) + "..." : d.name,
  }));

  return (
    <div className="chart-card animate-fade-in-delay-3 flex flex-col h-[400px]">
      <h3 className="font-semibold text-lg mb-1">Vendas por categoria</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Receita agregada por grupo de produto
      </p>

      <div className="flex-1 w-full min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 0, right: 20, left: 20, bottom: 0 }}
          >
            <XAxis
              type="number"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "hsl(215 20% 55%)", fontSize: 11 }}
              tickFormatter={(value) => formatCompact(value)}
            />
            <YAxis
              type="category"
              dataKey="shortName"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "hsl(210 40% 98%)", fontSize: 11 }}
              width={110}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(222 30% 14%)" }} />
            <Bar dataKey="revenue" radius={[0, 4, 4, 0]} barSize={12}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function CustomTooltip({ active, payload }: any) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="custom-tooltip max-w-[200px]">
        <p className="text-xs text-muted-foreground mb-1">{data.name}</p>
        <p className="value">{formatCurrency(data.revenue)}</p>
      </div>
    );
  }
  return null;
}
