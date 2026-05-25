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

    const sys = `You are an expert at reading shipping labels from Indian and international couriers. Carefully examine the image and identify:
1. The tracking/AWB/docket/consignment number (look near labels: AWB, CN No, C.N. No, Docket No, Consignment No, Waybill, Tracking No).
2. The courier company name — check the logo, header, branding colours, footer URL, phone number, and any company name printed on the label.
Reply ONLY in valid JSON.`;
    const userText = `Extract from this shipping label.
Return strict JSON: {"tracking_id":"...","courier":"...","confidence":"high|medium|low"}.

Courier MUST be exactly one of these canonical names:
Delhivery, Bluedart, DTDC, Ekart, Ecom Express, XpressBees, Shadowfax, India Post, DHL, FedEx, ST Courier, Professional, Trackon, Gati, Shree Maruti, Maruti, Other.

Courier identification hints:
- "Shree Maruti" / "Shri Maruti" / "Sree Maruthi" / "SMCS" / "SMILe" / "Shree Maruti Integrated Logistics" / "Shree Maruti Courier" → "Shree Maruti". The logo is usually red/orange with "Shree Maruti" text. Website shreemaruti.com.
- "Maruti" alone (Maruti Courier Service) is a different small courier; only use it if the logo clearly says just "Maruti Courier".
- "Blue Dart" / "BlueDart" → "Bluedart" (red/blue logo).
- "DTDC" → DTDC (red logo).
- "Delhivery" → Delhivery (red logo).
- "India Post" / "Speed Post" / "EMS" → India Post.
- "Ecom Express" / "ECOM" → Ecom Express.
- "XpressBees" / "Xpress Bees" → XpressBees.
- "Professional Couriers" / "TPC" → Professional.
- "Trackon" → Trackon.
- "Gati" / "Gati KWE" → Gati.
- If you cannot read the courier name from the label even after looking at the logo, footer URL, and phone numbers, return "Other".

Tracking ID rules:
- Usually a long numeric or alphanumeric code printed near "C.N. No", "AWB", "Docket", or below a barcode.
- Strip all spaces and dashes.
- If unsure of tracking id, return empty string.

Confidence:
- "high" if you can clearly read both the courier name and tracking number.
- "medium" if you are reasonably sure but parts are blurry.
- "low" if you had to guess.`;

    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: [{ type: 'text', text: userText }, imagePayload] },
        ],
        max_tokens: 300,
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
