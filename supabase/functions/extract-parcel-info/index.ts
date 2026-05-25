import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { imageBase64, imageUrl } = await req.json();
    if (!imageBase64 && !imageUrl) {
      return new Response(JSON.stringify({ error: 'imageBase64 or imageUrl required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not configured');

    const imagePayload = imageBase64
      ? { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }
      : { type: 'image_url', image_url: { url: imageUrl } };

    const sys = `You read shipping labels from Indian couriers. Identify the tracking/AWB/docket/consignment number (look for labels like AWB, CN No, C.N. No, Docket No, Consignment No) and the courier company name from the logo/header. Reply ONLY in JSON.`;
    const userText = `Extract from this shipping label.
Return strict JSON: {"tracking_id":"...","courier":"...","confidence":"high|medium|low"}.
Courier MUST be exactly one of: Delhivery, Bluedart, DTDC, Ekart, Ecom Express, XpressBees, Shadowfax, India Post, DHL, FedEx, ST Courier, Professional, Trackon, Gati, Shree Maruti, Maruti, Other.
Notes:
- "Shree Maruti" / "Shri Maruti" / "Sree Maruthi" / "SMCS" / "SMILe" all mean "Shree Maruti".
- "Maruti" alone (Maruti Courier Service) is a different small courier; only use it if logo clearly says just "Maruti Courier".
- Tracking ID is usually a long numeric/alphanumeric code near "C.N. No" or "AWB". Strip spaces.
- If unsure of tracking id, return tracking_id as empty string.`;
If unsure of tracking id, return tracking_id as empty string.`;

    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: [{ type: 'text', text: userText }, imagePayload] },
        ],
        max_tokens: 200,
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      console.error('OpenAI error', resp.status, t);
      return new Response(JSON.stringify({ error: `OpenAI ${resp.status}`, detail: t }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content ?? '{}';
    let parsed: { tracking_id?: string; courier?: string; confidence?: string } = {};
    try { parsed = JSON.parse(content); } catch { parsed = {}; }

    return new Response(JSON.stringify({
      tracking_id: parsed.tracking_id || '',
      courier: parsed.courier || 'Other',
      confidence: parsed.confidence || 'low',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('extract-parcel-info error', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
