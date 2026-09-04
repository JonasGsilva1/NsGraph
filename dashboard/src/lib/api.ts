import { supabase } from "./supabase";

// ============================================
// TIPOS
// ============================================

interface PagedResponse<T> {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  items: T[] | null;
}

export interface DocumentoResponse {
  codigo: number;
  idEmpresa: number;
  idPessoa: number;
  dataHora: string | null;
  numero: number;
  modelo: string | null;
  tipoMovimento: string | null;
  status: string | null;
  valTotal: number | null;
  mercadoriasLista: DocumentoMercadoriaAgrupado[] | null;
}

export interface DocumentoMercadoriaAgrupado {
  documentoMercadoria: DocumentoMercadoriaModel;
}

export interface DocumentoMercadoriaModel {
  _IdDocumento: number | null;
  _IdSequencia: number | null;
  idMercadoria: number | null;
  idMercadoriaVariacao: number | null;
  descricao: string | null;
  qtd: number | null;
  valUnitarioLiquido: number | null;
  valTotalLiquido: number | null;
  idSecao: number | null;
  idGrupo: number | null;
  idSubgrupo: number | null;
  idPessoaFuncionario: number | null;
}

export interface MercadoriaVendidaResponse {
  idMercadoriaVariacao: number;
  descricao: string | null;
  qtd: number | null;
  valTotalLiquido: number | null;
}

export interface FuncionarioComissaoResponse {
  idFuncionario: number;
  nomeFuncionario: string | null;
  valTotalLiquido: number;
  valTotalComissao: number;
  idDocumento: number;
  dataHora: string | null;
}

export interface MercadoriaGrupoResponse {
  codigo?: number;
  idGrupo?: number;
  descricao: string | null;
  ativo?: string | null;
}

export interface FuncionarioResponse {
  idPessoaFuncionario?: number;
  codigo?: number;
  nome: string | null;
  ativo?: string | null;
}

// ============================================
// FUNÇÕES DE CACHE (leitura direta do Supabase)
// ============================================

/**
 * Busca documentos do cache local (tabela erp_documentos).
 * Reconstrói o formato DocumentoResponse a partir do raw_json salvo.
 */
export async function fetchCachedDocumentos(
  companyId: string,
  dataInicio: string,
  dataFim: string,
  modelo?: string,
  status?: string
): Promise<DocumentoResponse[]> {
  let query = supabase
    .from("erp_documentos")
    .select("raw_json")
    .eq("company_id", companyId)
    .gte("data_hora", dataInicio)
    .lte("data_hora", dataFim);

  if (modelo) {
    query = query.eq("modelo", modelo);
  }
  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Erro ao buscar docs do cache:", error.message);
    throw new Error(`Erro ao buscar dados do cache: ${error.message}`);
  }

  if (!data) return [];

  // Reconstruir DocumentoResponse a partir do raw_json
  return data.map((row: any) => row.raw_json as DocumentoResponse);
}

/**
 * Busca grupos de mercadorias do cache local.
 */
export async function fetchCachedGrupos(
  companyId: string
): Promise<MercadoriaGrupoResponse[]> {
  const { data, error } = await supabase
    .from("erp_grupos")
    .select("id, descricao")
    .eq("company_id", companyId);

  if (error) {
    console.error("Erro ao buscar grupos do cache:", error.message);
    return [];
  }

  return (data || []).map((row: any) => ({
    codigo: row.id,
    idGrupo: row.id,
    descricao: row.descricao,
  }));
}

/**
 * Busca funcionários do cache local.
 */
export async function fetchCachedFuncionarios(
  companyId: string
): Promise<FuncionarioResponse[]> {
  const { data, error } = await supabase
    .from("erp_funcionarios")
    .select("id, nome")
    .eq("company_id", companyId);

  if (error) {
    console.error("Erro ao buscar funcionários do cache:", error.message);
    return [];
  }

  return (data || []).map((row: any) => ({
    idPessoaFuncionario: row.id,
    codigo: row.id,
    nome: row.nome,
  }));
}

/**
 * Verifica o status de sincronização de uma empresa.
 */
export async function fetchSyncStatus(companyId: string) {
  const { data } = await supabase
    .from("sync_status")
    .select("last_synced_at, last_full_sync_at, sync_error, is_syncing")
    .eq("company_id", companyId)
    .single();

  return data;
}

// ============================================
// FUNÇÕES DA API AO VIVO (via erp-proxy Edge Function)
// Usadas como fallback para períodos > 2 meses
// ============================================

// Queue to respect rate limit (20 req/min)
let requestQueue: Array<() => Promise<void>> = [];
let activeRequests = 0;
const MAX_CONCURRENT = 1;
let processing = false;

async function processQueue() {
  if (processing) return;
  processing = true;
  while (requestQueue.length > 0 && activeRequests < MAX_CONCURRENT) {
    const next = requestQueue.shift();
    if (next) {
      activeRequests++;
      next().finally(() => {
        activeRequests--;
        processQueue();
      });
    }
  }
  processing = false;
}

function enqueueRequest<T>(fn: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    requestQueue.push(async () => {
      try {
        const result = await fn();
        resolve(result);
      } catch (err) {
        reject(err);
      }
    });
    processQueue();
  });
}

async function fetchWithRetry<T>(
  path: string,
  companyId: string,
  params?: Record<string, string | number | undefined>,
  retries = 3
): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const invokePromise = supabase.functions.invoke("erp-proxy", {
        body: { path, companyId, params },
      });
      const timeoutPromise = new Promise<any>((_, reject) => {
        setTimeout(() => {
          const err = new Error("Timeout");
          err.name = "AbortError";
          reject(err);
        }, 30000); // 30s timeout for live API
      });

      const { data, error } = await Promise.race([
        invokePromise,
        timeoutPromise,
      ]);

      if (error) {
        throw new Error(`API error: ${error.message}`);
      }

      if (data && data.error) {
        if (data.error.includes("429") && attempt < retries) {
          const delay = Math.pow(2, attempt) * 3000;
          console.warn(`Rate limited (429). Retrying in ${delay}ms...`);
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
        throw new Error(data.error);
      }

      return data as T;
    } catch (fetchErr: any) {
      if (fetchErr.name === "AbortError") {
        console.warn(`Request timeout (attempt ${attempt})`);
        if (attempt === retries) throw new Error("API timeout excedido");
        continue;
      }
      throw fetchErr;
    }
  }
  throw new Error("Max retries exceeded");
}

async function apiGet<T>(
  path: string,
  companyId: string,
  params?: Record<string, string | number | undefined>
): Promise<T> {
  return enqueueRequest(async () => {
    return fetchWithRetry<T>(path, companyId, params);
  });
}

async function fetchAllPages<T>(
  path: string,
  companyId: string,
  params?: Record<string, string | number | undefined>,
  pageLimit = 50
): Promise<T[]> {
  const allItems: T[] = [];
  let page = 1;
  let hasNext = true;

  while (hasNext) {
    const response = await apiGet<PagedResponse<T>>(path, companyId, {
      ...params,
      page,
      limit: pageLimit,
    });

    if (response.items && response.items.length > 0) {
      allItems.push(...response.items);
    } else {
      break;
    }

    hasNext = response.hasNext;
    page++;

    if (page > 100) break;
  }

  return allItems;
}

// Funções de fallback (API ao vivo) — usadas para períodos > 2 meses
export function fetchLiveDocumentos(
  dataInicio: string,
  dataFim: string,
  companyId: string,
  modelo?: string,
  status?: string
) {
  return fetchAllPages<DocumentoResponse>("/api/documento/v1", companyId, {
    DataInicio: dataInicio,
    DataFim: dataFim,
    TipoMovimento: "S",
    Modelo: modelo,
    Status: status,
  });
}

export function fetchLiveMercadoriasVendidas(
  dataInicio: string,
  dataFim: string,
  modelo: string,
  companyId: string
) {
  return fetchAllPages<MercadoriaVendidaResponse>(
    "/api/documento/mercadorias-vendidas/v1",
    companyId,
    {
      Modelo: modelo,
      DataInicio: dataInicio,
      DataFim: dataFim,
    }
  );
}

export function fetchLiveGrupos(companyId: string) {
  return fetchAllPages<MercadoriaGrupoResponse>(
    "/api/mercadoria-grupo/v1",
    companyId
  );
}

export function fetchLiveFuncionarios(companyId: string) {
  return fetchAllPages<FuncionarioResponse>("/api/funcionario/v1", companyId);
}

export function clearRequestQueue() {
  requestQueue = [];
}
