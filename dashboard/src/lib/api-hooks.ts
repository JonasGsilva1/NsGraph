import { useState, useEffect, useRef, useCallback } from "react";
import {
  // Cache (Supabase direto)
  fetchCachedDocumentos,
  fetchCachedGrupos,
  fetchCachedFuncionarios,
  fetchSyncStatus,
  // Live API (fallback para > 2 meses)
  fetchLiveDocumentos,
  fetchLiveMercadoriasVendidas,
  fetchLiveGrupos,
  fetchLiveFuncionarios,
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

export interface PdvSales {
  id: number;
  name: string;
  revenue: number;
  count: number;
}

export interface PaymentSales {
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
  pdvSales: PdvSales[];
  paymentSales: PaymentSales[];
}

// ------ Helpers ------

const CACHE_WINDOW_MONTHS = 2;

/**
 * Determina se o período selecionado está dentro da janela de cache (2 meses).
 * Se sim, podemos usar dados do Supabase (instantâneo).
 * Se não, precisamos buscar da API ao vivo (com loading).
 */
function isWithinCacheWindow(range: DateRange): boolean {
  const now = new Date();
  const cacheLimit = new Date(now);
  cacheLimit.setMonth(cacheLimit.getMonth() - CACHE_WINDOW_MONTHS);
  cacheLimit.setHours(0, 0, 0, 0);
  return range.from >= cacheLimit;
}

// ------ Static Data Cache ------

let gruposCache: Map<string, MercadoriaGrupoResponse[]> = new Map();
let funcionariosCache: Map<string, FuncionarioResponse[]> = new Map();

// ------ Main Hook ------

export function useDashboardData(range: DateRange, companyId?: string | null) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<"cache" | "live" | null>(null);
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

    const useCache = isWithinCacheWindow(range);
    setSource(useCache ? "cache" : "live");

    try {
      const fromStr = dateToISO(range.from);
      const toStr = dateToISO(range.to);
      const prevRange = getPreviousPeriod(range);
      const prevFromStr = dateToISO(prevRange.from);
      const prevToStr = dateToISO(prevRange.to);
      const modelos = config.modelos;

      let currentDocs: DocumentoResponse[];
      let prevDocs: DocumentoResponse[];
      let allDocs: DocumentoResponse[] = [];
      let prevAllDocs: DocumentoResponse[] = [];
      let grupos: MercadoriaGrupoResponse[];
      let funcionarios: FuncionarioResponse[];

      if (useCache) {
        // ===== MODO CACHE (≤ 2 meses) =====
        // Busca instantânea direto do Supabase
        console.log("[dashboard] Usando dados do cache (Supabase)");

        const [
          cachedCurrentDocs,
          cachedPrevDocs,
          cachedGrupos,
          cachedFuncionarios,
        ] = await Promise.all([
          fetchCachedDocumentos(companyId, fromStr, toStr, undefined, "E"),
          fetchCachedDocumentos(companyId, prevFromStr, prevToStr, undefined, "E"),
          gruposCache.get(companyId) 
            ? Promise.resolve(gruposCache.get(companyId)!)
            : fetchCachedGrupos(companyId),
          funcionariosCache.get(companyId)
            ? Promise.resolve(funcionariosCache.get(companyId)!)
            : fetchCachedFuncionarios(companyId),
        ]);

        currentDocs = cachedCurrentDocs;
        prevDocs = cachedPrevDocs;
        grupos = cachedGrupos;
        funcionarios = cachedFuncionarios;

        // Se o usuário quer ver a taxa de conversão, buscar docs de todos os status
        if (config.showConversionRate) {
          const [cachedAll, cachedPrevAll] = await Promise.all([
            fetchCachedDocumentos(companyId, fromStr, toStr),
            fetchCachedDocumentos(companyId, prevFromStr, prevToStr),
          ]);
          allDocs = cachedAll;
          prevAllDocs = cachedPrevAll;
        }
      } else {
        // ===== MODO AO VIVO (> 2 meses) =====
        // Busca via API do ERP (mais lento, respeita rate limit)
        console.log("[dashboard] Usando API ao vivo (período > 2 meses)");

        // Fetch documentos
        const docPromises = modelos.map((m) =>
          fetchLiveDocumentos(fromStr, toStr, companyId, m, "E")
        );
        const prevDocPromises = modelos.map((m) =>
          fetchLiveDocumentos(prevFromStr, prevToStr, companyId, m, "E")
        );
        const allDocPromises = config.showConversionRate
          ? modelos.map((m) => fetchLiveDocumentos(fromStr, toStr, companyId, m))
          : [];
        const prevAllDocPromises = config.showConversionRate
          ? modelos.map((m) =>
              fetchLiveDocumentos(prevFromStr, prevToStr, companyId, m)
            )
          : [];

        const [docResults, prevDocResults, allDocResults, prevAllDocResults] =
          await Promise.all([
            Promise.all(docPromises),
            Promise.all(prevDocPromises),
            Promise.all(allDocPromises),
            Promise.all(prevAllDocPromises),
          ]);

        currentDocs = docResults.flat();
        prevDocs = prevDocResults.flat();
        allDocs = allDocResults.flat();
        prevAllDocs = prevAllDocResults.flat();

        // Fetch static data
        grupos = gruposCache.get(companyId) || (await fetchLiveGrupos(companyId));
        funcionarios =
          funcionariosCache.get(companyId) || (await fetchLiveFuncionarios(companyId));
      }

      if (abortRef.current) return;

      // Cache static data
      if (!gruposCache.has(companyId)) gruposCache.set(companyId, grupos);
      if (!funcionariosCache.has(companyId))
        funcionariosCache.set(companyId, funcionarios);

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

      // Build top products from document items
      const topProducts = buildTopProducts(currentDocs);

      // Build category sales
      const categorySales = buildCategorySales(currentDocs, grupos);

      // Build seller sales
      const sellerSales = buildSellerSales(currentDocs, funcionarios);

      // Build PDV sales
      const pdvSales = buildPdvSales(currentDocs);

      // Build payment method sales
      const paymentSales = buildPaymentSales(currentDocs);

      if (abortRef.current) return;

      setData({
        kpi,
        revenueTimeline,
        topProducts,
        categorySales,
        sellerSales,
        pdvSales,
        paymentSales,
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
  }, [range.from.getTime(), range.to.getTime(), companyId]);

  useEffect(() => {
    load();
    return () => {
      abortRef.current = true;
    };
  }, [load]);

  return { data, loading, error, source, reload: load };
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
  currentDocs: DocumentoResponse[]
): TopProduct[] {
  const productMap = new Map<string, { name: string; revenue: number }>();

  for (const doc of currentDocs) {
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
      salesMap.set(
        grupoId,
        (salesMap.get(grupoId) || 0) + (m.valTotalLiquido || 0)
      );
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

function buildPdvSales(docs: DocumentoResponse[]): PdvSales[] {
  const pdvMap = new Map<number, { revenue: number; count: number }>();

  for (const doc of docs) {
    // idCaixa comes from the raw document response
    const rawDoc = doc as any;
    const idCaixa = rawDoc.idCaixa || 0;
    if (idCaixa === 0) continue;

    const existing = pdvMap.get(idCaixa);
    if (existing) {
      existing.revenue += doc.valTotal || 0;
      existing.count += 1;
    } else {
      pdvMap.set(idCaixa, { revenue: doc.valTotal || 0, count: 1 });
    }
  }

  return Array.from(pdvMap.entries())
    .map(([id, data]) => ({
      id,
      name: `Caixa ${id}`,
      revenue: data.revenue,
      count: data.count,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);
}

function buildPaymentSales(docs: DocumentoResponse[]): PaymentSales[] {
  const paymentMap = new Map<string, number>();

  for (const doc of docs) {
    // pagamentosLista comes from the raw document response
    const rawDoc = doc as any;
    const pagamentos = rawDoc.pagamentosLista;
    if (!pagamentos || !Array.isArray(pagamentos)) continue;

    for (const pag of pagamentos) {
      const pagModel = pag.documentoPagamento;
      if (!pagModel) continue;

      const descricao = pagModel.descricao || "Não informado";
      const valor = pagModel.valor || 0;

      paymentMap.set(descricao, (paymentMap.get(descricao) || 0) + valor);
    }
  }

  return Array.from(paymentMap.entries())
    .map(([name, revenue]) => ({ name, revenue }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);
}
