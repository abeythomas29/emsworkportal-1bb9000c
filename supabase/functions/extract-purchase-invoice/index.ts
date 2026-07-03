import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { fileBase64, mimeType } = await req.json();
    if (!fileBase64 || !mimeType) {
      return new Response(JSON.stringify({ error: 'fileBase64 and mimeType are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

    const isPdf = mimeType === 'application/pdf';
    const isImage = mimeType.startsWith('image/');
    if (!isPdf && !isImage) {
      return new Response(JSON.stringify({ error: 'Only PDF or image files are supported' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const dataUrl = `data:${mimeType};base64,${fileBase64}`;
    const filePart = isPdf
      ? { type: 'file', file: { filename: 'invoice.pdf', file_data: dataUrl } }
      : { type: 'image_url', image_url: { url: dataUrl } };

    const sys = `You are an accountant assistant that reads Indian GST tax invoices from vendors. Extract structured data. Reply ONLY as valid JSON matching the requested schema. Use numbers (not strings) for all monetary and quantity fields. If a field is missing, use null for strings and 0 for numbers.`;

    const userText = `Extract this vendor tax invoice. Return strict JSON:
{
  "vendor_name": string|null,
  "vendor_gstin": string|null,
  "invoice_no": string|null,
  "invoice_date": string|null,   // ISO date YYYY-MM-DD
  "sub_total": number,           // taxable value before tax
  "total_tax": number,           // CGST+SGST+IGST total
  "total": number,               // grand total incl tax and round-off
  "items": [
    {
      "item_name": string,
      "hsn_sac": string|null,
      "quantity": number,
      "unit": string|null,
      "unit_price": number,
      "tax_percent": number,     // combined GST rate for this line (e.g. 18)
      "amount": number           // line total incl tax
    }
  ]
}
Rules:
- Prefer the invoice's own totals if present; do not re-compute if it disagrees with the printed grand total.
- Date: if only DD/MM/YYYY is visible, convert to YYYY-MM-DD.
- Vendor name is the SELLER (issuer of the invoice), not the buyer/consignee.
- GSTIN is a 15-character alphanumeric code.
- If the document isn't a tax invoice, still extract what you can and set unknown fields to null/0.`;

    const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Lovable-API-Key': LOVABLE_API_KEY,
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: [{ type: 'text', text: userText }, filePart] },
        ],
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      console.error('Lovable AI error', resp.status, t);
      return new Response(JSON.stringify({ error: `AI ${resp.status}`, detail: t }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content ?? '{}';
    let parsed: any = {};
    try { parsed = JSON.parse(content); } catch { parsed = {}; }

    return new Response(JSON.stringify({
      vendor_name: parsed.vendor_name ?? null,
      vendor_gstin: parsed.vendor_gstin ?? null,
      invoice_no: parsed.invoice_no ?? null,
      invoice_date: parsed.invoice_date ?? null,
      sub_total: Number(parsed.sub_total) || 0,
      total_tax: Number(parsed.total_tax) || 0,
      total: Number(parsed.total) || 0,
      items: Array.isArray(parsed.items) ? parsed.items.map((it: any) => ({
        item_name: String(it.item_name || ''),
        hsn_sac: it.hsn_sac ?? null,
        quantity: Number(it.quantity) || 0,
        unit: it.unit ?? null,
        unit_price: Number(it.unit_price) || 0,
        tax_percent: Number(it.tax_percent) || 0,
        amount: Number(it.amount) || 0,
      })) : [],
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('extract-purchase-invoice error', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
