import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import { formatCurrency } from "@/lib/date-utils";
import type { PaymentSales } from "@/lib/api-hooks";

interface PaymentChartProps {
  data: PaymentSales[];
}

const COLORS = [
  "hsl(160 84% 39%)",
  "hsl(200 80% 55%)",
  "hsl(280 70% 55%)",
  "hsl(40 90% 60%)",
  "hsl(340 75% 55%)",
  "hsl(160 60% 45%)",
  "hsl(15 80% 55%)",
  "hsl(200 60% 55%)",
  "hsl(280 50% 60%)",
  "hsl(40 70% 50%)",
];

export function PaymentChart({ data }: PaymentChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="chart-card animate-fade-in-delay-3 flex flex-col h-[400px]">
        <h3 className="font-semibold text-lg mb-1">Formas de pagamento</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Distribuição do faturamento por tipo de pagamento
        </p>
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
          Sem dados de pagamento disponíveis
        </div>
      </div>
    );
  }

  const total = data.reduce((sum, d) => sum + d.revenue, 0);

  return (
    <div className="chart-card animate-fade-in-delay-3 flex flex-col h-[400px]">
      <h3 className="font-semibold text-lg mb-1">Formas de pagamento</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Distribuição do faturamento por tipo de pagamento
      </p>

      <div className="flex-1 w-full min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="45%"
              innerRadius="45%"
              outerRadius="75%"
              dataKey="revenue"
              nameKey="name"
              paddingAngle={2}
              strokeWidth={0}
            >
              {data.map((_entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={COLORS[index % COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip total={total} />} />
            <Legend
              verticalAlign="bottom"
              height={36}
              formatter={(value: string) => (
                <span style={{ color: "hsl(210 40% 98%)", fontSize: 11 }}>
                  {value}
                </span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function CustomTooltip({ active, payload, total }: any) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const percent = total > 0 ? ((data.revenue / total) * 100).toFixed(1) : "0";
    return (
      <div className="custom-tooltip max-w-[220px]">
        <p className="text-xs text-muted-foreground mb-1">{data.name}</p>
        <p className="value">{formatCurrency(data.revenue)}</p>
        <p className="text-xs text-muted-foreground mt-1">
          {percent}% do total
        </p>
      </div>
    );
  }
  return null;
}
