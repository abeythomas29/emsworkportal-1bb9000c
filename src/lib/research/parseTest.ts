// Lightweight parameter extraction from free-text research test instructions.
// Recognises common pigment-lab parameters (mica, TiCl4, SnCl4, flow rate, pH,
// temperature, time, rpm, percentages...) plus a generic "label: number unit"
// fallback so any structured line the lab writes gets picked up.

export interface ParsedParam {
  key: string; // canonical key (lowercase)
  label: string; // display label
  value: number; // NaN when the parameter is textual (see `text`)
  unit: string;
  text?: string; // textual value, e.g. mica grade "Ranchi 10-60"
}

interface Alias {
  key: string;
  label: string;
  patterns: RegExp[];
  unit?: string;
}

const NUM = String.raw`(-?\d+(?:[.,]\d+)?)`;
const UNIT = String.raw`\s*(%|kgs?|kg|gms?|gm|grams?|g|mg|ml\s*\/\s*min|ml|l(?:tr|itres?|iters?)?|min(?:utes?|s)?|hrs?|hours?|°\s*c|deg\s*c|c\b|rpm|ppm)?`;

function rx(names: string[]): RegExp[] {
  return names.map(
    (n) =>
      new RegExp(
        `(?:^|[^a-z0-9])${n}(?:\\s*(?:weight|wt|amount|qty|quantity|volume|conc|concentration))?\\s*[:=\\-–]?\\s*(?:of\\s+)?${NUM}${UNIT}`,
        'i',
      ),
  );
}

const ALIASES: Alias[] = [
  { key: 'mica', label: 'Mica', patterns: rx(['mica']) },
  { key: 'ticl4', label: 'TiCl4', patterns: rx(['ticl\\s*4', 'ticl4', 'titanium\\s+tetrachloride']) },
  { key: 'sncl4', label: 'SnCl4', patterns: rx(['sncl\\s*4', 'sncl4', 'tin\\s+tetrachloride']) },
  { key: 'sncl2', label: 'SnCl2', patterns: rx(['sncl\\s*2', 'sncl2', 'stannous\\s+chloride']) },
  { key: 'fecl3', label: 'FeCl3', patterns: rx(['fecl\\s*3', 'fecl3', 'ferric\\s+chloride']) },
  { key: 'naoh', label: 'NaOH', patterns: rx(['naoh', 'caustic']) },
  { key: 'hcl', label: 'HCl', patterns: rx(['hcl', 'hydrochloric']) },
  { key: 'water', label: 'Water / DM Water', patterns: rx(['dm\\s*water', 'di\\s*water', 'water']) },
  { key: 'flow_rate', label: 'Flow Rate', patterns: rx(['flow\\s*rate', 'dosing\\s*rate', 'feed\\s*rate', 'flow']) },
  { key: 'ph', label: 'pH', patterns: rx(['ph']) },
  { key: 'temperature', label: 'Temperature', patterns: rx(['temperature', 'temp']) },
  { key: 'time', label: 'Time / Duration', patterns: rx(['reaction\\s*time', 'duration', 'time']) },
  { key: 'rpm', label: 'Stirring (RPM)', patterns: rx(['rpm', 'stirring', 'stirrer\\s*speed', 'agitation']) },
  { key: 'calcination', label: 'Calcination Temp', patterns: rx(['calcination', 'calcined', 'furnace']) },
  { key: 'd90', label: 'D90', patterns: rx(['d\\s*90', 'd90']) },
  { key: 'coating', label: 'Coating %', patterns: rx(['coating\\s*(?:%|percentage|percent)?', 'coating']) },
  { key: 'yield', label: 'Yield', patterns: rx(['yield']) },
];

function normUnit(u?: string): string {
  if (!u) return '';
  const s = u.toLowerCase().replace(/\s+/g, '');
  if (['gm', 'gms', 'gram', 'grams', 'g'].includes(s)) return 'g';
  if (['kg', 'kgs'].includes(s)) return 'kg';
  if (['ltr', 'litre', 'litres', 'liter', 'liters', 'l'].includes(s)) return 'L';
  if (['min', 'mins', 'minute', 'minutes'].includes(s)) return 'min';
  if (['hr', 'hrs', 'hour', 'hours'].includes(s)) return 'hr';
  if (['°c', 'degc', 'c'].includes(s)) return '°C';
  if (s === 'ml/min') return 'ml/min';
  return s;
}

const GENERIC = new RegExp(
  String.raw`(?:^|\n)\s*(?:[-*•]\s*)?([A-Za-z][A-Za-z0-9 ()/.+-]{1,28}?)\s*[:=]\s*${NUM}${UNIT}`,
  'gi',
);


// ---------------------------------------------------------------------------
// Mica grade / particle size
// A mica grade is written as "<origin name> <min>-<max>" e.g. "Ranchi 10-60",
// "Bihar 10-40 micron". The name is the mica type and the number range is the
// particle size in microns — NOT a weight. We capture it as a textual grade
// plus min/max size params, and mask it out of the text so the numbers are
// never mistaken for a mica quantity.
// ---------------------------------------------------------------------------
const MICA_GRADE = new RegExp(
  String.raw`(?:^|[^a-z0-9])(?:mica\s*(?:grade|type)?\s*[:=-]?\s*)?([A-Za-z][A-Za-z]{2,15})?\s*(\d{1,4})\s*(?:-|–|to)\s*(\d{1,4})\s*(?:micron?s?|microns|µm|um|mesh)?`,
  'i',
);

function extractMicaGrade(src: string): { params: ParsedParam[]; masked: string } {
  const params: ParsedParam[] = [];
  let masked = src;

  // Prefer an explicit "mica ..." line if present
  const micaLine = src.split(/\n/).find((l) => /mica/i.test(l));
  const target = micaLine ?? src;
  const m = target.match(MICA_GRADE);
  if (m) {
    const [full, nameRaw, minRaw, maxRaw] = m;
    const min = parseFloat(minRaw);
    const max = parseFloat(maxRaw);
    if (!Number.isNaN(min) && !Number.isNaN(max) && max > min) {
      const name = nameRaw && !/^(mica|grade|type|size|psd)$/i.test(nameRaw) ? nameRaw : '';
      const grade = `${name ? name + ' ' : ''}${minRaw}-${maxRaw}`.trim();
      params.push({ key: 'mica_grade', label: 'Mica Grade', value: NaN, unit: '', text: grade });
      params.push({ key: 'mica_size_min', label: 'Mica Size (min)', value: min, unit: 'µm' });
      params.push({ key: 'mica_size_max', label: 'Mica Size (max)', value: max, unit: 'µm' });
      // mask only the numeric range so a real "Mica: 100 g" elsewhere still parses
      const range = full.slice(full.indexOf(minRaw));
      masked = src.replace(range, ' '.repeat(range.length));
    }
  }
  return { params, masked };
}

export function parseTestParams(text: string): ParsedParam[] {
  const out = new Map<string, ParsedParam>();
  const { params: micaParams, masked: src } = extractMicaGrade(text || '');
  for (const p of micaParams) out.set(p.key, p);

  for (const alias of ALIASES) {
    for (const p of alias.patterns) {
      const m = src.match(p);
      if (m) {
        const value = parseFloat(m[1].replace(',', '.'));
        if (!Number.isNaN(value)) {
          out.set(alias.key, { key: alias.key, label: alias.label, value, unit: normUnit(m[2]) });
        }
        break;
      }
    }
  }

  let g: RegExpExecArray | null;
  GENERIC.lastIndex = 0;
  while ((g = GENERIC.exec(src)) !== null) {
    const label = g[1].trim();
    const key = label.toLowerCase().replace(/\s+/g, '_');
    if (out.has(key)) continue;
    // skip if this label already matched a canonical alias by name
    if ([...out.values()].some((v) => v.label.toLowerCase() === label.toLowerCase())) continue;
    const value = parseFloat(g[2].replace(',', '.'));
    if (Number.isNaN(value)) continue;
    out.set(key, { key, label, value, unit: normUnit(g[3]) });
  }

  return [...out.values()];
}

export interface ComparisonRow {
  key: string;
  label: string;
  unit: string;
  values: (number | null)[];
  texts: (string | null)[];
  changed: boolean;
}

export function buildComparison(texts: string[]): ComparisonRow[] {
  const parsed = texts.map(parseTestParams);
  const keys: string[] = [];
  const meta = new Map<string, { label: string; unit: string }>();
  parsed.forEach((ps) =>
    ps.forEach((p) => {
      if (!meta.has(p.key)) {
        meta.set(p.key, { label: p.label, unit: p.unit });
        keys.push(p.key);
      } else if (!meta.get(p.key)!.unit && p.unit) {
        meta.get(p.key)!.unit = p.unit;
      }
    }),
  );

  return keys.map((key) => {
    const found = parsed.map((ps) => ps.find((p) => p.key === key));
    const texts = found.map((p) => p?.text ?? null);
    const values = found.map((p) => (p && !Number.isNaN(p.value) ? p.value : null));
    const isText = texts.some((t) => t !== null);
    const present: (string | number)[] = isText
      ? texts.filter((t): t is string => t !== null)
      : values.filter((v): v is number => v !== null);
    const changed = new Set(present).size > 1 || present.length !== values.length;
    return { key, label: meta.get(key)!.label, unit: meta.get(key)!.unit, values, texts, changed };
  });
}

export function pctDelta(prev: number | null, cur: number | null): number | null {
  if (prev === null || cur === null || prev === 0) return null;
  return ((cur - prev) / Math.abs(prev)) * 100;
}
