const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { tests, comparison, seriesName } = await req.json();
    if (!Array.isArray(tests) || tests.length === 0) {
      return new Response(JSON.stringify({ error: 'tests required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

    const sys = `You are a senior R&D chemist specialising in mica-based pearlescent (effect) pigments produced by wet chemical coating (TiCl4 / SnCl4 / FeCl3 hydrolysis on mica followed by calcination).
You are given a set of lab trials from one series, each with its written procedure, the numeric parameters extracted from it, and the observed result.
Your job: explain cause and effect between PARAMETER CHANGES and PRODUCT OUTCOME.
DOMAIN NOTE — mica naming: a mica entry like "Ranchi 10-60", "Paras 10-60", "Bihar 10-40" or just "10-60" is a MICA GRADE (Ranchi, Paras, Bihar, Chennai, muscovite, sericite etc. are mica types/sources), not a quantity. The word is the mica source/type name and the number range is the PARTICLE SIZE RANGE IN MICRONS (µm) of the flakes. Never read it as a weight, volume, percentage or ratio. Coarser ranges (e.g. 10-60) give stronger sparkle/glitter and need more TiCl4 for the same coating thickness (lower specific surface area), while finer ranges (e.g. 5-25) give smoother, silkier lustre and higher opacity.
Be concrete and practical. Never invent data that is not present; if something is missing, say what should be recorded next time.
Reply in clean markdown with these sections:
## What changed between the tests
## Effect of each change on the product
## Most likely drivers of the best result
## Recommended next trial (specific numbers)
## Data gaps to record next time`;

    const body = tests
      .map((t: Record<string, unknown>, i: number) => {
        return `### Test ${i + 1} — ${t.title || 'Untitled'} (${t.test_date})
Parameters: ${JSON.stringify(t.params ?? {})}
Procedure:
${t.instructions}
Observation: ${t.observation || '(none recorded)'}
Planned next changes: ${t.next_test_changes || '(none)'}`;
      })
      .join('\n\n');

    const userMsg = `Series: ${seriesName || 'Unnamed'}

Parameter comparison matrix (per test, in order):
${JSON.stringify(comparison ?? [], null, 1)}

${body}`;

    const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: userMsg },
        ],
      }),
    });

    if (res.status === 429) {
      return new Response(JSON.stringify({ error: 'Rate limit reached, please try again shortly.' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (res.status === 402) {
      return new Response(JSON.stringify({ error: 'AI credits exhausted. Please top up in Settings.' }), {
        status: 402,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`AI gateway error: ${res.status} ${txt}`);
    }

    const json = await res.json();
    const analysis = json.choices?.[0]?.message?.content ?? '';

    return new Response(JSON.stringify({ analysis }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
