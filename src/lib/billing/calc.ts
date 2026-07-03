export interface LineItemInput {
  item_name: string;
  hsn_sac?: string | null;
  quantity: number;
  unit?: string | null;
  unit_price: number;
  discount_percent: number;
  tax_percent: number;
  product_id?: string | null;
  description?: string | null;
}

export interface ComputedLine extends LineItemInput {
  taxable_value: number;
  discount_amount: number;
  cgst: number;
  sgst: number;
  igst: number;
  tax_amount: number;
  amount: number;
}

/** Returns financial year string like '25-26' for a given date */
export function financialYearOf(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const y = d.getFullYear();
  const m = d.getMonth() + 1; // 1-12
  const startYear = m >= 4 ? y : y - 1;
  const endYear = startYear + 1;
  return `${String(startYear).slice(-2)}-${String(endYear).slice(-2)}`;
}

export function computeLine(l: LineItemInput, sameState: boolean): ComputedLine {
  const gross = (Number(l.quantity) || 0) * (Number(l.unit_price) || 0);
  const discount_amount = gross * ((Number(l.discount_percent) || 0) / 100);
  const taxable_value = gross - discount_amount;
  const tax_amount = taxable_value * ((Number(l.tax_percent) || 0) / 100);
  const cgst = sameState ? tax_amount / 2 : 0;
  const sgst = sameState ? tax_amount / 2 : 0;
  const igst = sameState ? 0 : tax_amount;
  const amount = taxable_value + tax_amount;
  return {
    ...l,
    discount_amount,
    taxable_value,
    tax_amount,
    cgst,
    sgst,
    igst,
    amount,
  };
}

export interface Totals {
  sub_total: number;
  total_discount: number;
  total_taxable: number;
  total_cgst: number;
  total_sgst: number;
  total_igst: number;
  total_tax: number;
  gross_total: number;
  round_off: number;
  total: number;
}

export function computeTotals(lines: ComputedLine[]): Totals {
  const sub_total = lines.reduce((s, l) => s + l.quantity * l.unit_price, 0);
  const total_discount = lines.reduce((s, l) => s + l.discount_amount, 0);
  const total_taxable = lines.reduce((s, l) => s + l.taxable_value, 0);
  const total_cgst = lines.reduce((s, l) => s + l.cgst, 0);
  const total_sgst = lines.reduce((s, l) => s + l.sgst, 0);
  const total_igst = lines.reduce((s, l) => s + l.igst, 0);
  const total_tax = total_cgst + total_sgst + total_igst;
  const gross_total = total_taxable + total_tax;
  const total = Math.round(gross_total);
  const round_off = total - gross_total;
  return {
    sub_total,
    total_discount,
    total_taxable,
    total_cgst,
    total_sgst,
    total_igst,
    total_tax,
    gross_total,
    round_off,
    total,
  };
}

export interface HsnSummaryRow {
  hsn: string;
  taxable: number;
  cgst_rate: number;
  cgst: number;
  sgst_rate: number;
  sgst: number;
  igst_rate: number;
  igst: number;
  total_tax: number;
}

export function buildHsnSummary(lines: ComputedLine[], sameState: boolean): HsnSummaryRow[] {
  const map = new Map<string, HsnSummaryRow>();
  for (const l of lines) {
    const key = (l.hsn_sac || '—').trim() || '—';
    const existing = map.get(key) || {
      hsn: key,
      taxable: 0,
      cgst_rate: sameState ? (l.tax_percent || 0) / 2 : 0,
      cgst: 0,
      sgst_rate: sameState ? (l.tax_percent || 0) / 2 : 0,
      sgst: 0,
      igst_rate: sameState ? 0 : l.tax_percent || 0,
      igst: 0,
      total_tax: 0,
    };
    existing.taxable += l.taxable_value;
    existing.cgst += l.cgst;
    existing.sgst += l.sgst;
    existing.igst += l.igst;
    existing.total_tax += l.cgst + l.sgst + l.igst;
    map.set(key, existing);
  }
  return Array.from(map.values());
}
