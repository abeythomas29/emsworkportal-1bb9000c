import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { gstin } = await req.json();
    if (!gstin || typeof gstin !== 'string' || gstin.length !== 15) {
      return new Response(JSON.stringify({ error: 'A valid 15-character GSTIN is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const GSTVERIFY_API_KEY = Deno.env.get('GSTVERIFY_API_KEY');
    if (!GSTVERIFY_API_KEY) throw new Error('GSTVERIFY_API_KEY not configured');

    const resp = await fetch(`https://gstverify.co.in/api/v1/verify/${encodeURIComponent(gstin.toUpperCase())}`, {
      headers: { 'X-API-Key': GSTVERIFY_API_KEY },
    });

    if (!resp.ok) {
      const t = await resp.text();
      console.error('gstverify.co.in error', resp.status, t);
      return new Response(JSON.stringify({ error: `GST lookup failed (${resp.status})`, detail: t }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const result = await resp.json();
    if (!result.success) {
      return new Response(JSON.stringify({ error: 'GSTIN not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      legal_name: result.data?.legal_name || '',
      trade_name: result.data?.trade_name || '',
      status: result.data?.status || '',
      state: result.data?.state || '',
      address: result.data?.address || '',
      cached: !!result.cached,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('verify-gstin error', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
