import { TrendingDown, TrendingUp } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, YAxis } from "recharts";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { type KpiData } from "@/lib/api-hooks";
import { formatCurrency, formatPercent, formatNumber } from "@/lib/date-utils";

interface KpiCardsProps {
  data: KpiData | undefined;
  loading: boolean;
  showOrders?: boolean;
  showConversionRate?: boolean;
}

export function KpiCards({
  data,
  loading,
  showOrders = true,
  showConversionRate = false,
}: KpiCardsProps) {
  // Count how many cards to show
  const cardCount = 2 + (showOrders ? 1 : 0) + (showConversionRate ? 1 : 0);

  if (loading || !data) {
    return (
      <div
        className="kpi-grid mb-6"
        style={{
          gridTemplateColumns: `repeat(${cardCount}, 1fr)`,
        }}
      >
        {Array.from({ length: cardCount }).map((_, i) => (
          <Skeleton key={i} className="h-[120px] w-full" />
        ))}
      </div>
    );
  }

  const revenueChange = calculateChange(data.revenue, data.prevRevenue);
  const ordersChange = calculateChange(data.orders, data.prevOrders);
  const ticketChange = calculateChange(
    data.averageTicket,
    data.prevAverageTicket
  );
  const convChange = calculateChange(
    data.conversionRate,
    data.prevConversionRate
  );

  return (
    <div
      className="kpi-grid mb-6"
      style={{
        gridTemplateColumns: `repeat(${cardCount}, 1fr)`,
      }}
    >
      <KpiCard
        title="Faturamento"
        value={formatCurrency(data.revenue)}
        change={revenueChange}
        chartData={data.revenueByDay}
        color="hsl(160 84% 39%)"
      />
      {showOrders && (
        <KpiCard
          title="Pedidos"
          value={formatNumber(data.orders)}
          change={ordersChange}
          chartData={data.ordersByDay}
          color="hsl(200 80% 55%)"
        />
      )}
      <KpiCard
        title="Ticket Médio"
        value={formatCurrency(data.averageTicket)}
        change={ticketChange}
        chartData={data.ticketByDay}
        color="hsl(40 90% 60%)"
      />
      {showConversionRate && (
        <KpiCard
          title="Conversão"
          value={formatPercent(data.conversionRate)}
          change={convChange}
          chartData={data.conversionByDay}
          color="hsl(340 75% 55%)"
        />
      )}
    </div>
  );
}

function calculateChange(current: number, prev: number) {
  if (prev === 0) return current > 0 ? 100 : 0;
  return ((current - prev) / prev) * 100;
}

interface KpiCardProps {
  title: string;
  value: string;
  change: number;
  chartData: { value: number }[];
  color: string;
}

function KpiCard({ title, value, change, chartData, color }: KpiCardProps) {
  const isPositive = change >= 0;
  const isNeutral = change === 0;

  // Simple heuristic for Y scale
  const values = chartData.map((d) => d.value);
  const min = Math.min(...values) * 0.9;
  const max = Math.max(...values) * 1.1;

  return (
    <div className="kpi-card flex flex-col justify-between">
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {title}
        </h3>
        <Badge
          variant={isPositive ? "default" : "destructive"}
          className={`px-1.5 py-0.5 text-[10px] h-5 font-semibold ${
            isNeutral ? "bg-muted text-muted-foreground" : ""
          } ${
            isPositive && !isNeutral
              ? "bg-primary/20 text-primary hover:bg-primary/30"
              : ""
          } ${
            !isPositive
              ? "bg-destructive/20 text-destructive hover:bg-destructive/30"
              : ""
          }`}
        >
          {isPositive && !isNeutral && <TrendingUp className="w-3 h-3 mr-1" />}
          {!isPositive && <TrendingDown className="w-3 h-3 mr-1" />}
          {isPositive ? "+" : ""}
          {change.toFixed(1)}%
        </Badge>
      </div>

      <div className="flex-1 flex flex-col justify-end relative z-10">
        <div className="text-2xl font-bold tracking-tight mb-4">{value}</div>

        <div className="h-10 w-[calc(100%+2.5rem)] -mx-5 -mb-5 opacity-60">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient
                  id={`gradient-${title}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="5%" stopColor={color} stopOpacity={0.4} />
                  <stop offset="95%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <YAxis domain={[min, max]} hide />
              <Area
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={2}
                fillOpacity={1}
                fill={`url(#gradient-${title})`}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
