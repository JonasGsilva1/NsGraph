import {
  subDays,
  subMonths,
  subYears,
  startOfDay,
  endOfDay,
  format,
  differenceInDays,
  eachDayOfInterval,
  eachWeekOfInterval,
  eachMonthOfInterval,
  startOfWeek,
  startOfMonth,
  endOfWeek,
  endOfMonth,
  isWithinInterval,
  parseISO,
} from "date-fns";
import { ptBR } from "date-fns/locale";

export type Preset = "today" | "7d" | "30d" | "90d" | "1y" | "custom";

export interface DateRange {
  from: Date;
  to: Date;
}

export function getPresetRange(preset: Preset): DateRange {
  const now = new Date();
  const to = endOfDay(now);

  switch (preset) {
    case "today":
      return { from: startOfDay(now), to };
    case "7d":
      return { from: startOfDay(subDays(now, 6)), to };
    case "30d":
      return { from: startOfDay(subDays(now, 29)), to };
    case "90d":
      return { from: startOfDay(subDays(now, 89)), to };
    case "1y":
      return { from: startOfDay(subYears(now, 1)), to };
    case "custom":
      return { from: startOfDay(subDays(now, 6)), to };
  }
}

export function getPreviousPeriod(range: DateRange): DateRange {
  const days = differenceInDays(range.to, range.from) + 1;
  return {
    from: startOfDay(subDays(range.from, days)),
    to: endOfDay(subDays(range.from, 1)),
  };
}

export function formatDateRange(range: DateRange): string {
  const days = differenceInDays(range.to, range.from) + 1;
  const fromStr = format(range.from, "dd 'de' MMM. 'de' yyyy", {
    locale: ptBR,
  });
  const toStr = format(range.to, "dd 'de' MMM. 'de' yyyy", { locale: ptBR });
  return `${fromStr} — ${toStr} · ${days} dias`;
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatCurrencyFull(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatCompact(value: number): string {
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1)} mi`;
  if (value >= 1_000) return `R$ ${(value / 1_000).toFixed(1)} mil`;
  return formatCurrency(value);
}

export function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("pt-BR").format(value);
}

export type AggregationLevel = "day" | "week" | "month";

export function getAggregationLevel(range: DateRange): AggregationLevel {
  const days = differenceInDays(range.to, range.from);
  if (days < 60) return "day";
  if (days < 180) return "week";
  return "month";
}

export interface TimeBucket {
  key: string;
  label: string;
  from: Date;
  to: Date;
}

export function getTimeBuckets(range: DateRange): TimeBucket[] {
  const level = getAggregationLevel(range);

  switch (level) {
    case "day":
      return eachDayOfInterval({ start: range.from, end: range.to }).map(
        (d) => ({
          key: format(d, "yyyy-MM-dd"),
          label: format(d, "dd/MM", { locale: ptBR }),
          from: startOfDay(d),
          to: endOfDay(d),
        })
      );
    case "week":
      return eachWeekOfInterval(
        { start: range.from, end: range.to },
        { weekStartsOn: 1 }
      ).map((d) => ({
        key: format(d, "yyyy-'W'II"),
        label: format(d, "dd/MM", { locale: ptBR }),
        from: startOfWeek(d, { weekStartsOn: 1 }),
        to: endOfWeek(d, { weekStartsOn: 1 }),
      }));
    case "month":
      return eachMonthOfInterval({ start: range.from, end: range.to }).map(
        (d) => ({
          key: format(d, "yyyy-MM"),
          label: format(d, "MMM/yy", { locale: ptBR }),
          from: startOfMonth(d),
          to: endOfMonth(d),
        })
      );
  }
}

export function assignToBucket(
  dateStr: string,
  buckets: TimeBucket[]
): string | null {
  const date = parseISO(dateStr);
  for (const bucket of buckets) {
    if (isWithinInterval(date, { start: bucket.from, end: bucket.to })) {
      return bucket.key;
    }
  }
  return null;
}

export function dateToISO(d: Date): string {
  return format(d, "yyyy-MM-dd'T'HH:mm:ss");
}

export function formatShortDate(d: Date): string {
  return format(d, "dd/MM/yy", { locale: ptBR });
}
