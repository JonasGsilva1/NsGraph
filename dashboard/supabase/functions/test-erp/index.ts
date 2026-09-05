import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" } })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    let body: any = {};
    try { body = await req.json(); } catch {}

    const action = body?.action || 'query';

    if (action === 'reset-sync') {
      const companyId = body?.companyId;
      if (!companyId) {
        return new Response(JSON.stringify({ error: 'companyId required' }), { status: 400, headers: { "Content-Type": "application/json" } });
      }
      const { error } = await supabaseAdmin
        .from('sync_status')
        .update({ is_syncing: false, sync_error: null })
        .eq('company_id', companyId);
      return new Response(JSON.stringify({ success: true, error }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    if (action === 'sync-status') {
      const { data, error } = await supabaseAdmin.from('sync_status').select('*');
      return new Response(JSON.stringify({ data, error }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    if (action === 'companies') {
      const { data, error } = await supabaseAdmin.from('companies').select('id, name, created_at');
      return new Response(JSON.stringify({ data, error }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    if (action === 'erp-test') {
      const companyId = body?.companyId;
      const path = body?.path || '/api/documento/v1';
      
      const { data: company } = await supabaseAdmin
        .from('companies')
        .select('api_token')
        .eq('id', companyId)
        .single();
      
      if (!company) {
        return new Response(JSON.stringify({ error: 'Company not found' }), { status: 404, headers: { "Content-Type": "application/json" } });
      }

      let token = company.api_token.trim();
      if (token.toLowerCase().startsWith('authentication ')) {
        token = token.substring(15).trim();
      }

      const url = `https://api.meuerponline.com.br/publica${path}`;
      const erpRes = await fetch(url, {
        headers: { 'Authorization': `Authentication ${token}`, 'Accept': 'application/json' }
      });
      const data = await erpRes.text();
      let parsed;
      try { parsed = JSON.parse(data); } catch { parsed = data; }
      
      return new Response(JSON.stringify({ status: erpRes.status, ok: erpRes.ok, data: parsed }), { 
        status: 200, headers: { "Content-Type": "application/json" } 
      });
    }

    // Default: return sync status
    const { data, error } = await supabaseAdmin.from('sync_status').select('*');
    return new Response(JSON.stringify({ data, error }), { status: 200, headers: { "Content-Type": "application/json" } });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
