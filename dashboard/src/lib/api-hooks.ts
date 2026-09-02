import { useState, useEffect, useRef, useCallback } from "react";
import {
  fetchDocumentos,
  fetchMercadoriasVendidas,
  fetchMercadoriaGrupos,
  fetchFuncionarios,
  clearRequestQueue,
  type DocumentoResponse,
  type MercadoriaVendidaResponse,
  type MercadoriaGrupoResponse,
  type FuncionarioResponse,
} from "./api";
import { getConfig } from "./config";
import {
  type DateRange,
  dateToISO,
  getPreviousPeriod,
  getTimeBuckets,
  assignToBucket,
} from "./date-utils";

// ------ Types ------

export interface KpiData {
  revenue: number;
  orders: number;
  averageTicket: number;
  conversionRate: number;
  prevRevenue: number;
  prevOrders: number;
  prevAverageTicket: number;
  prevConversionRate: number;
  revenueByDay: { key: string; label: string; value: number }[];
  ordersByDay: { key: string; label: string; value: number }[];
  ticketByDay: { key: string; label: string; value: number }[];
  conversionByDay: { key: string; label: string; value: number }[];
}

export interface TopProduct {
  id: number;
  name: string;
  revenue: number;
}

export interface CategorySales {
  id: number;
  name: string;
  revenue: number;
}

export interface SellerSales {
  id: number;
  name: string;
  revenue: number;
}

export interface RevenuePoint {
  key: string;
  label: string;
  current: number;
  previous: number;
}

export interface DashboardData {
  kpi: KpiData;
  revenueTimeline: RevenuePoint[];
  topProducts: TopProduct[];
  categorySales: CategorySales[];
  sellerSales: SellerSales[];
}

// ------ Static Data Cache ------

let gruposCache: MercadoriaGrupoResponse[] | null = null;
let funcionariosCache: FuncionarioResponse[] | null = null;

// ------ Main Hook ------

export function useDashboardData(range: DateRange, companyId?: string | null) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef(false);

  const load = useCallback(async () => {
    abortRef.current = false;
    setLoading(true);
    setError(null);
    clearRequestQueue();

    const config = getConfig();
    if (!companyId) {
      setError("Empresa não selecionada.");
      setLoading(false);
      return;
    }

    try {
      const fromStr = dateToISO(range.from);
      const toStr = dateToISO(range.to);
      const prevRange = getPreviousPeriod(range);
      const prevFromStr = dateToISO(prevRange.from);
      const prevToStr = dateToISO(prevRange.to);
      const modelos = config.modelos;

      // Fetch static data (cached)
      if (!gruposCache) {
        gruposCache = await fetchMercadoriaGrupos(companyId);
      }
      if (!funcionariosCache) {
        funcionariosCache = await fetchFuncionarios(companyId);
      }

      if (abortRef.current) return;

      // Fetch current period documents (emitted, sales)
      const docPromises = modelos.map((m) =>
        fetchDocumentos(fromStr, toStr, companyId, m, "E")
      );
      // Fetch all status docs for conversion rate
      const allDocPromises = config.showConversionRate
        ? modelos.map((m) => fetchDocumentos(fromStr, toStr, companyId, m))
        : [];

      // Fetch previous period documents
      const prevDocPromises = modelos.map((m) =>
        fetchDocumentos(prevFromStr, prevToStr, companyId, m, "E")
      );
      const prevAllDocPromises = config.showConversionRate
        ? modelos.map((m) => fetchDocumentos(prevFromStr, prevToStr, companyId, m))
        : [];

      // Fetch mercadorias vendidas for current period
      const mercsPromises = modelos
        .filter((m) => m !== "PV")
        .map((m) => fetchMercadoriasVendidas(fromStr, toStr, m, companyId));

      const [
        docResults,
        allDocResults,
        prevDocResults,
        prevAllDocResults,
        mercsResults,
      ] = await Promise.all([
        Promise.all(docPromises),
        Promise.all(allDocPromises),
        Promise.all(prevDocPromises),
        Promise.all(prevAllDocPromises),
        Promise.all(mercsPromises),
      ]);

      if (abortRef.current) return;

      const currentDocs = docResults.flat();
      const allDocs = allDocResults.flat();
      const prevDocs = prevDocResults.flat();
      const prevAllDocs = prevAllDocResults.flat();
      const mercsVendidas = mercsResults.flat();

      // Build KPI data
      const kpi = buildKpiData(
        currentDocs,
        allDocs,
        prevDocs,
        prevAllDocs,
        range,
        prevRange,
        config.showConversionRate
      );

      // Build revenue timeline
      const revenueTimeline = buildRevenueTimeline(
        currentDocs,
        prevDocs,
        range,
        prevRange
      );

      // Build top products
      const topProducts = buildTopProducts(mercsVendidas, currentDocs);

      // Build category sales
      const categorySales = buildCategorySales(currentDocs, gruposCache!);

      // Build seller sales
      const sellerSales = buildSellerSales(currentDocs, funcionariosCache!);

      if (abortRef.current) return;

      setData({
        kpi,
        revenueTimeline,
        topProducts,
        categorySales,
        sellerSales,
      });
    } catch (err) {
      if (!abortRef.current) {
        setError(
          err instanceof Error ? err.message : "Erro ao carregar dados"
        );
      }
    } finally {
      if (!abortRef.current) {
        setLoading(false);
      }
    }
  }, [range, companyId]);

  useEffect(() => {
    load();
    return () => {
      abortRef.current = true;
    };
  }, [load]);

  return { data, loading, error, reload: load };
}

// ------ Builders ------

function buildKpiData(
  currentDocs: DocumentoResponse[],
  allDocs: DocumentoResponse[],
  prevDocs: DocumentoResponse[],
  prevAllDocs: DocumentoResponse[],
  range: DateRange,
  prevRange: DateRange,
  showConversion: boolean
): KpiData {
  const revenue = currentDocs.reduce((sum, d) => sum + (d.valTotal || 0), 0);
  const orders = currentDocs.length;
  const averageTicket = orders > 0 ? revenue / orders : 0;

  const prevRevenue = prevDocs.reduce((sum, d) => sum + (d.valTotal || 0), 0);
  const prevOrders = prevDocs.length;
  const prevAverageTicket = prevOrders > 0 ? prevRevenue / prevOrders : 0;

  let conversionRate = 0;
  let prevConversionRate = 0;
  if (showConversion) {
    const totalAll = allDocs.length;
    const emitted = allDocs.filter((d) => d.status === "E").length;
    conversionRate = totalAll > 0 ? (emitted / totalAll) * 100 : 0;

    const prevTotalAll = prevAllDocs.length;
    const prevEmitted = prevAllDocs.filter((d) => d.status === "E").length;
    prevConversionRate =
      prevTotalAll > 0 ? (prevEmitted / prevTotalAll) * 100 : 0;
  }

  // Sparkline data
  const buckets = getTimeBuckets(range);
  const prevBuckets = getTimeBuckets(prevRange);

  const revenueByDay = buildSparkline(currentDocs, buckets);
  const ordersByDay = buildSparklineCount(currentDocs, buckets);
  const ticketByDay = buckets.map((b) => {
    const rev = revenueByDay.find((r) => r.key === b.key)?.value || 0;
    const ord = ordersByDay.find((r) => r.key === b.key)?.value || 0;
    return { key: b.key, label: b.label, value: ord > 0 ? rev / ord : 0 };
  });

  const conversionByDay = showConversion
    ? buildConversionSparkline(allDocs, buckets)
    : buckets.map((b) => ({ key: b.key, label: b.label, value: 0 }));

  return {
    revenue,
    orders,
    averageTicket,
    conversionRate,
    prevRevenue,
    prevOrders,
    prevAverageTicket,
    prevConversionRate,
    revenueByDay,
    ordersByDay,
    ticketByDay,
    conversionByDay,
  };
}

function buildSparkline(
  docs: DocumentoResponse[],
  buckets: ReturnType<typeof getTimeBuckets>
) {
  const map = new Map<string, number>();
  buckets.forEach((b) => map.set(b.key, 0));

  for (const doc of docs) {
    if (!doc.dataHora) continue;
    const key = assignToBucket(doc.dataHora, buckets);
    if (key) map.set(key, (map.get(key) || 0) + (doc.valTotal || 0));
  }

  return buckets.map((b) => ({
    key: b.key,
    label: b.label,
    value: map.get(b.key) || 0,
  }));
}

function buildSparklineCount(
  docs: DocumentoResponse[],
  buckets: ReturnType<typeof getTimeBuckets>
) {
  const map = new Map<string, number>();
  buckets.forEach((b) => map.set(b.key, 0));

  for (const doc of docs) {
    if (!doc.dataHora) continue;
    const key = assignToBucket(doc.dataHora, buckets);
    if (key) map.set(key, (map.get(key) || 0) + 1);
  }

  return buckets.map((b) => ({
    key: b.key,
    label: b.label,
    value: map.get(b.key) || 0,
  }));
}

function buildConversionSparkline(
  allDocs: DocumentoResponse[],
  buckets: ReturnType<typeof getTimeBuckets>
) {
  const totalMap = new Map<string, number>();
  const emittedMap = new Map<string, number>();
  buckets.forEach((b) => {
    totalMap.set(b.key, 0);
    emittedMap.set(b.key, 0);
  });

  for (const doc of allDocs) {
    if (!doc.dataHora) continue;
    const key = assignToBucket(doc.dataHora, buckets);
    if (key) {
      totalMap.set(key, (totalMap.get(key) || 0) + 1);
      if (doc.status === "E") {
        emittedMap.set(key, (emittedMap.get(key) || 0) + 1);
      }
    }
  }

  return buckets.map((b) => {
    const total = totalMap.get(b.key) || 0;
    const emitted = emittedMap.get(b.key) || 0;
    return {
      key: b.key,
      label: b.label,
      value: total > 0 ? (emitted / total) * 100 : 0,
    };
  });
}

function buildRevenueTimeline(
  currentDocs: DocumentoResponse[],
  prevDocs: DocumentoResponse[],
  range: DateRange,
  prevRange: DateRange
): RevenuePoint[] {
  const currentBuckets = getTimeBuckets(range);
  const prevBuckets = getTimeBuckets(prevRange);

  const currentMap = new Map<string, number>();
  currentBuckets.forEach((b) => currentMap.set(b.key, 0));
  for (const doc of currentDocs) {
    if (!doc.dataHora) continue;
    const key = assignToBucket(doc.dataHora, currentBuckets);
    if (key)
      currentMap.set(key, (currentMap.get(key) || 0) + (doc.valTotal || 0));
  }

  const prevMap = new Map<string, number>();
  prevBuckets.forEach((b) => prevMap.set(b.key, 0));
  for (const doc of prevDocs) {
    if (!doc.dataHora) continue;
    const key = assignToBucket(doc.dataHora, prevBuckets);
    if (key)
      prevMap.set(key, (prevMap.get(key) || 0) + (doc.valTotal || 0));
  }

  const prevValues = Array.from(prevMap.values());

  return currentBuckets.map((b, i) => ({
    key: b.key,
    label: b.label,
    current: currentMap.get(b.key) || 0,
    previous: prevValues[i] ?? 0,
  }));
}

function buildTopProducts(
  mercsVendidas: MercadoriaVendidaResponse[],
  currentDocs: DocumentoResponse[]
): TopProduct[] {
  // Merge from mercadorias-vendidas endpoint + document items
  const productMap = new Map<string, { name: string; revenue: number }>();

  // From mercadorias vendidas endpoint (already aggregated)
  for (const m of mercsVendidas) {
    const key = m.descricao || `Produto #${m.idMercadoriaVariacao}`;
    const existing = productMap.get(key);
    if (existing) {
      existing.revenue += m.valTotalLiquido || 0;
    } else {
      productMap.set(key, {
        name: key,
        revenue: m.valTotalLiquido || 0,
      });
    }
  }

  // Also include PV items from documents
  for (const doc of currentDocs) {
    if (doc.modelo !== "PV") continue;
    if (!doc.mercadoriasLista) continue;
    for (const item of doc.mercadoriasLista) {
      const m = item.documentoMercadoria;
      const key = m.descricao || `Produto #${m.idMercadoriaVariacao}`;
      const existing = productMap.get(key);
      if (existing) {
        existing.revenue += m.valTotalLiquido || 0;
      } else {
        productMap.set(key, {
          name: key,
          revenue: m.valTotalLiquido || 0,
        });
      }
    }
  }

  return Array.from(productMap.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)
    .map((p, i) => ({ id: i, ...p }));
}

function buildCategorySales(
  docs: DocumentoResponse[],
  grupos: MercadoriaGrupoResponse[]
): CategorySales[] {
  const grupoMap = new Map<number, string>();
  for (const g of grupos) {
    const id = g.codigo ?? g.idGrupo ?? 0;
    grupoMap.set(id, g.descricao || `Grupo #${id}`);
  }

  const salesMap = new Map<number, number>();

  for (const doc of docs) {
    if (!doc.mercadoriasLista) continue;
    for (const item of doc.mercadoriasLista) {
      const m = item.documentoMercadoria;
      const grupoId = m.idGrupo || 0;
      if (grupoId === 0) continue;
      salesMap.set(grupoId, (salesMap.get(grupoId) || 0) + (m.valTotalLiquido || 0));
    }
  }

  return Array.from(salesMap.entries())
    .map(([id, revenue]) => ({
      id,
      name: grupoMap.get(id) || `Grupo #${id}`,
      revenue,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);
}

function buildSellerSales(
  docs: DocumentoResponse[],
  funcionarios: FuncionarioResponse[]
): SellerSales[] {
  const funcMap = new Map<number, string>();
  for (const f of funcionarios) {
    const id = f.idPessoaFuncionario ?? f.codigo ?? 0;
    funcMap.set(id, f.nome || `Vendedor #${id}`);
  }

  const salesMap = new Map<number, number>();

  for (const doc of docs) {
    if (!doc.mercadoriasLista) continue;
    for (const item of doc.mercadoriasLista) {
      const m = item.documentoMercadoria;
      const funcId = m.idPessoaFuncionario || 0;
      if (funcId === 0) continue;
      salesMap.set(
        funcId,
        (salesMap.get(funcId) || 0) + (m.valTotalLiquido || 0)
      );
    }
  }

  return Array.from(salesMap.entries())
    .map(([id, revenue]) => ({
      id,
      name: funcMap.get(id) || `Vendedor #${id}`,
      revenue,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);
}
