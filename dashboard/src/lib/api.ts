import { supabase } from "./supabase";



interface PagedResponse<T> {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  items: T[] | null;
}

// Queue to respect rate limit (20 req/min)
let requestQueue: Array<() => Promise<void>> = [];
let activeRequests = 0;
const MAX_CONCURRENT = 3;
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
  retries = 0
): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const invokePromise = supabase.functions.invoke('erp-proxy', {
        body: { path, companyId, params }
      });
      const timeoutPromise = new Promise<any>((_, reject) => {
        setTimeout(() => {
          const err = new Error('Timeout');
          err.name = 'AbortError';
          reject(err);
        }, 15000);
      });

      const { data, error } = await Promise.race([invokePromise, timeoutPromise]);

      if (error) {
      // O Supabase Functions wrapper lança erro se houver problemas de rede ou status 5xx
      // Vamos checar se é um Rate Limit (429) no corpo do erro, se possível, mas 
      // geralmente o status HTTP fica disponível no objeto de resposta ou temos que extrair.
      throw new Error(`API error: ${error.message}`);
    }

    if (data && data.error) {
      if (data.error.includes('429') && attempt < retries) {
        const delay = Math.pow(2, attempt) * 2000;
        console.warn(`Rate limited (429). Retrying in ${delay}ms...`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw new Error(`API error: ${data.error}`);
    }

      return data as T;
    } catch (fetchErr: any) {
      if (fetchErr.name === 'AbortError') {
        console.warn(`Request timeout (attempt ${attempt})`);
        if (attempt === retries) throw new Error('API timeout excedido');
        continue;
      }
      throw fetchErr;
    }
  }
  throw new Error("Max retries exceeded");
}



export async function apiGet<T>(
  path: string,
  companyId: string,
  params?: Record<string, string | number | undefined>
): Promise<T> {
  return enqueueRequest(async () => {
    return fetchWithRetry<T>(path, companyId, params);
  });
}

export async function fetchAllPages<T>(
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
      break; // Stop if no items are returned, even if hasNext is true
    }

    hasNext = response.hasNext;
    page++;

    // Safety cap to avoid infinite loops
    if (page > 100) break;
  }

  return allItems;
}

// ------ Typed API calls ------

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

export function fetchDocumentos(
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

export function fetchMercadoriasVendidas(
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

export function fetchComissoes(dataInicio: string, dataFim: string, companyId: string) {
  return fetchAllPages<FuncionarioComissaoResponse>(
    "/api/funcionario/comissoes/v1",
    companyId,
    {
      dataInicio,
      dataFim,
    }
  );
}

export function fetchMercadoriaGrupos(companyId: string) {
  return fetchAllPages<MercadoriaGrupoResponse>("/api/mercadoria-grupo/v1", companyId);
}

export function fetchFuncionarios(companyId: string) {
  return fetchAllPages<FuncionarioResponse>("/api/funcionario/v1", companyId);
}

export function clearRequestQueue() {
  requestQueue = [];
}
