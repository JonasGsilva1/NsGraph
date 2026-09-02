import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Tratamento de CORS para requests OPTIONS (preflight do navegador)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // Pegamos os dados enviados pelo frontend
    const { path, companyId, params } = await req.json()

    if (!path || !companyId) {
      return new Response(JSON.stringify({ error: 'path e companyId são obrigatórios' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // 1. Busca o token da empresa de forma segura
    // Como estamos usando o token de Auth do usuário na criação do supabaseClient,
    // o RLS garantirá que ele só conseguirá buscar o token se for Admin ou se pertencer à empresa.
    const { data: companyData, error: dbError } = await supabaseClient
      .from('companies')
      .select('api_token')
      .eq('id', companyId)
      .single()

    if (dbError || !companyData?.api_token) {
      return new Response(JSON.stringify({ error: 'Empresa não encontrada ou sem permissão de acesso.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      })
    }

    // 2. Constrói a URL para a API do ERP
    const baseUrl = 'https://api.meuerponline.com.br/publica'
    const targetUrl = new URL(`${baseUrl}${path}`)
    
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null && value !== '') {
          targetUrl.searchParams.set(key, String(value))
        }
      }
    }

    // 3. Faz a requisição para a API Externa com o token criptografado/escondido
    const apiResponse = await fetch(targetUrl.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Authentication ${companyData.api_token}`,
        'Accept': 'application/json'
      }
    })

    if (!apiResponse.ok) {
      const errText = await apiResponse.text()
      return new Response(JSON.stringify({ error: `Erro na API do ERP (${apiResponse.status}): ${errText}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: apiResponse.status,
      })
    }

    // 4. Retorna os dados para o Frontend
    const data = await apiResponse.json()
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
