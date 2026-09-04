import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ERP_BASE_URL = 'https://api.meuerponline.com.br/publica'
const MODELOS = ['65', '55', '59', 'PV']
const REQUEST_DELAY_MS = 3500 // ~17 requests/min (safety margin under 20/min)
const PAGE_LIMIT = 50

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Make one ERP API call
async function erpGet(path: string, token: string, params?: Record<string, string>) {
  const url = new URL(`${ERP_BASE_URL}${path}`)
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, value)
      }
    }
  }

  // Clean token prefix
  let safeToken = token.trim()
  if (safeToken.toLowerCase().startsWith('authentication ')) {
    safeToken = safeToken.substring(15).trim()
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Authorization': `Authentication ${safeToken}`,
      'Accept': 'application/json',
    },
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`ERP API error (${response.status}): ${errText}`)
  }

  return await response.json()
}

// Fetch all pages for a given path, respecting rate limits
async function erpGetAllPages(path: string, token: string, params?: Record<string, string>): Promise<any[]> {
  const allItems: any[] = []
  let page = 1
  let hasNext = true

  while (hasNext && page <= 100) {
    await sleep(REQUEST_DELAY_MS)
    
    const data = await erpGet(path, token, {
      ...params,
      page: String(page),
      limit: String(PAGE_LIMIT),
    })

    if (data.items && data.items.length > 0) {
      allItems.push(...data.items)
    } else {
      break
    }

    hasNext = data.hasNext === true
    page++
  }

  return allItems
}

// Format date to ISO string without timezone for the ERP API
function formatDateForErp(date: Date): string {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}T00:00:00`
}

function formatDateEndForErp(date: Date): string {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}T23:59:59`
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify the cron secret
    const authHeader = req.headers.get('authorization') || ''
    const cronSecret = Deno.env.get('CRON_SECRET') || ''
    
    console.log('authHeader:', authHeader);
    console.log('cronSecret:', cronSecret);

    // Accept either the cron secret or a valid Supabase auth token (for manual triggers)
    const isValidCron = cronSecret && authHeader === `Bearer ${cronSecret}`
    console.log('isValidCron:', isValidCron);
    
    // Create admin client (bypasses RLS)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    if (!isValidCron) {
      // Try validating as a logged-in admin user
      const supabaseUser = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: authHeader } } }
      )
      const { data: { user } } = await supabaseUser.auth.getUser()
      if (!user) {
        return new Response(JSON.stringify({ error: 'Não autorizado', debug: { authHeader, cronSecretLength: cronSecret.length } }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        })
      }
      // Verify admin role
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      if (profile?.role !== 'admin') {
        return new Response(JSON.stringify({ error: 'Acesso restrito a administradores' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403,
        })
      }
    }

    // Parse optional body
    let requestBody: any = {}
    try {
      requestBody = await req.json()
    } catch { /* no body is fine */ }
    
    const specificCompanyId = requestBody?.companyId || null
    const forceFullSync = requestBody?.fullSync === true

    // Fetch companies to sync
    let companiesQuery = supabaseAdmin.from('companies').select('id, api_token')
    if (specificCompanyId) {
      companiesQuery = companiesQuery.eq('id', specificCompanyId)
    }
    const { data: companies, error: companiesError } = await companiesQuery
    
    if (companiesError || !companies || companies.length === 0) {
      return new Response(JSON.stringify({ error: 'Nenhuma empresa encontrada', detail: companiesError?.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    const results: any[] = []

    for (const company of companies) {
      if (!company.api_token) {
        results.push({ companyId: company.id, status: 'skipped', reason: 'no token' })
        continue
      }

      // Mark as syncing
      await supabaseAdmin.from('sync_status').upsert({
        company_id: company.id,
        is_syncing: true,
        sync_error: null,
      })

      try {
        // Determine sync window
        const now = new Date()
        let syncFrom: Date
        
        // Check if we need a full sync (first time or daily full sync)
        const { data: syncStatus } = await supabaseAdmin
          .from('sync_status')
          .select('last_synced_at, last_full_sync_at')
          .eq('company_id', company.id)
          .single()

        const needsFullSync = forceFullSync || 
          !syncStatus?.last_full_sync_at ||
          (now.getTime() - new Date(syncStatus.last_full_sync_at).getTime()) > 24 * 60 * 60 * 1000

        if (needsFullSync) {
          // Full sync: last 2 months
          syncFrom = new Date(now)
          syncFrom.setMonth(syncFrom.getMonth() - 2)
          syncFrom.setHours(0, 0, 0, 0)
        } else {
          // Incremental sync: last 3 days
          syncFrom = new Date(now)
          syncFrom.setDate(syncFrom.getDate() - 3)
          syncFrom.setHours(0, 0, 0, 0)
        }

        const fromStr = formatDateForErp(syncFrom)
        const toStr = formatDateEndForErp(now)

        console.log(`[sync-erp] Company ${company.id}: ${needsFullSync ? 'FULL' : 'INCREMENTAL'} sync from ${fromStr} to ${toStr}`)

        // --- Sync documentos ---
        let totalDocs = 0
        for (const modelo of MODELOS) {
          const docs = await erpGetAllPages('/api/documento/v1', company.api_token, {
            DataInicio: fromStr,
            DataFim: toStr,
            TipoMovimento: 'S',
            Modelo: modelo,
            Status: 'E',
          })

          if (docs.length > 0) {
            // Prepare rows for upsert
            const rows = docs.map((doc: any) => ({
              id: doc.codigo,
              company_id: company.id,
              data_hora: doc.dataHora,
              numero: doc.numero,
              modelo: doc.modelo,
              tipo_movimento: doc.tipoMovimento,
              status: doc.status,
              val_total: doc.valTotal || 0,
              id_pessoa: doc.idPessoa,
              raw_json: doc,
              synced_at: new Date().toISOString(),
            }))

            // Upsert in batches of 500
            for (let i = 0; i < rows.length; i += 500) {
              const batch = rows.slice(i, i + 500)
              const { error: upsertError } = await supabaseAdmin
                .from('erp_documentos')
                .upsert(batch, { onConflict: 'id,company_id' })
              
              if (upsertError) {
                console.error(`[sync-erp] Upsert error (docs): ${upsertError.message}`)
              }
            }

            totalDocs += docs.length
          }
        }

        // --- Sync grupos (static, only on full sync) ---
        let totalGrupos = 0
        if (needsFullSync) {
          const grupos = await erpGetAllPages('/api/mercadoria-grupo/v1', company.api_token)
          if (grupos.length > 0) {
            const rows = grupos.map((g: any) => ({
              id: g.codigo ?? g.idGrupo ?? 0,
              company_id: company.id,
              descricao: g.descricao,
              synced_at: new Date().toISOString(),
            }))

            const { error: upsertError } = await supabaseAdmin
              .from('erp_grupos')
              .upsert(rows, { onConflict: 'id,company_id' })

            if (upsertError) {
              console.error(`[sync-erp] Upsert error (grupos): ${upsertError.message}`)
            }
            totalGrupos = grupos.length
          }
        }

        // --- Sync funcionários (static, only on full sync) ---
        let totalFuncionarios = 0
        if (needsFullSync) {
          const funcionarios = await erpGetAllPages('/api/funcionario/v1', company.api_token)
          if (funcionarios.length > 0) {
            const rows = funcionarios.map((f: any) => ({
              id: f.idPessoaFuncionario ?? f.codigo ?? 0,
              company_id: company.id,
              nome: f.nome,
              synced_at: new Date().toISOString(),
            }))

            const { error: upsertError } = await supabaseAdmin
              .from('erp_funcionarios')
              .upsert(rows, { onConflict: 'id,company_id' })

            if (upsertError) {
              console.error(`[sync-erp] Upsert error (funcionarios): ${upsertError.message}`)
            }
            totalFuncionarios = funcionarios.length
          }
        }

        // Update sync status
        await supabaseAdmin.from('sync_status').upsert({
          company_id: company.id,
          last_synced_at: new Date().toISOString(),
          last_full_sync_at: needsFullSync ? new Date().toISOString() : syncStatus?.last_full_sync_at,
          sync_error: null,
          is_syncing: false,
        })

        results.push({
          companyId: company.id,
          status: 'success',
          type: needsFullSync ? 'full' : 'incremental',
          docs: totalDocs,
          grupos: totalGrupos,
          funcionarios: totalFuncionarios,
        })

      } catch (syncErr: any) {
        console.error(`[sync-erp] Error syncing company ${company.id}: ${syncErr.message}`)
        
        await supabaseAdmin.from('sync_status').upsert({
          company_id: company.id,
          sync_error: syncErr.message,
          is_syncing: false,
        })

        results.push({
          companyId: company.id,
          status: 'error',
          error: syncErr.message,
        })
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: any) {
    console.error(`[sync-erp] Fatal error: ${error.message}`)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  }
})
