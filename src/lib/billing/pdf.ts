import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { numberToIndianWords } from './numberToWords';
import { buildHsnSummary, computeTotals, ComputedLine } from './calc';
import emsLogoUrl from '@/assets/ems-logo.png';
import upiQrUrl from '@/assets/upi-qr.png';

// EMS brand palette
const BRAND_CHARCOAL: [number, number, number] = [58, 58, 58];
const BRAND_GOLD: [number, number, number] = [212, 160, 23];
const BRAND_TEAL: [number, number, number] = [95, 196, 192];
const BRAND_GOLD_SOFT: [number, number, number] = [252, 244, 220];

// Preload EMS logo as data URL for default branding
let emsLogoImg: HTMLImageElement | null = null;
const emsLogoPromise: Promise<HTMLImageElement | null> = new Promise((resolve) => {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => { emsLogoImg = img; resolve(img); };
  img.onerror = () => resolve(null);
  img.src = emsLogoUrl;
});

let upiQrImg: HTMLImageElement | null = null;
const upiQrPromise: Promise<HTMLImageElement | null> = new Promise((resolve) => {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => { upiQrImg = img; resolve(img); };
  img.onerror = () => resolve(null);
  img.src = upiQrUrl;
});

export async function prepareBrandingAssets(): Promise<void> {
  await Promise.all([emsLogoPromise, upiQrPromise]);
}

function getDefaultLogoImg(): HTMLImageElement | null {
  return emsLogoImg;
}

function dataUrlToImg(dataUrl: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

// Cache for user-uploaded logo/signature converted to Image elements
const imgCache = new Map<string, HTMLImageElement | null>();
export async function preloadCompanyImages(company: { logo_url?: string | null; signature_url?: string | null }): Promise<void> {
  const jobs: Promise<void>[] = [];
  for (const url of [company.logo_url, company.signature_url]) {
    if (url && !imgCache.has(url)) {
      jobs.push(dataUrlToImg(url).then((img) => { imgCache.set(url, img); }));
    }
  }
  await Promise.all(jobs);
}
function getCompanyImg(url: string | null | undefined): HTMLImageElement | null {
  if (!url) return null;
  return imgCache.get(url) ?? null;
}

export interface CompanyInfo {
  name: string;
  address_line?: string | null;
  city?: string | null;
  state?: string | null;
  state_code?: string | null;
  pincode?: string | null;
  gstin?: string | null;
  phone?: string | null;
  email?: string | null;
  bank_name?: string | null;
  bank_account?: string | null;
  bank_ifsc?: string | null;
  bank_micr?: string | null;
  bank_branch_code?: string | null;
  bank_swift?: string | null;
  logo_url?: string | null;
  signature_url?: string | null;
}

export interface PartySnapshot {
  name: string;
  gstin?: string | null;
  phone?: string | null;
  billing_street?: string | null;
  billing_city?: string | null;
  billing_state?: string | null;
  billing_state_code?: string | null;
  billing_pincode?: string | null;
  shipping_same?: boolean;
  shipping_street?: string | null;
  shipping_city?: string | null;
  shipping_state?: string | null;
  shipping_state_code?: string | null;
  shipping_pincode?: string | null;
}

export interface PdfDocInput {
  doc_type: 'tax_invoice' | 'proforma' | 'estimate';
  doc_number: string;
  doc_date: string;
  place_of_supply_state?: string | null;
  place_of_supply_code?: string | null;
  payment_mode?: string | null;
  terms?: string | null;
  company: CompanyInfo;
  party: PartySnapshot;
  lines: ComputedLine[];
  sameState: boolean;
}

const TITLE: Record<PdfDocInput['doc_type'], string> = {
  tax_invoice: 'TAX INVOICE',
  proforma: 'PROFORMA INVOICE',
  estimate: 'ESTIMATE',
};

function inr(n: number) {
  return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function generateBillingPdf(input: PdfDocInput): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  const pageW = doc.internal.pageSize.getWidth();
  const M = 10;
  const totals = computeTotals(input.lines);
  const hsn = buildHsnSummary(input.lines, input.sameState);

  // ---- Header (logo + company block) with EMS brand accent
  const headerY = M;
  const headerH = 32;

  // Left brand strip (teal)
  doc.setFillColor(...BRAND_TEAL);
  doc.rect(M, headerY, 3, headerH, 'F');
  // Header background (soft cream)
  doc.setFillColor(...BRAND_GOLD_SOFT);
  doc.rect(M + 3, headerY, pageW - 2 * M - 3, headerH, 'F');
  doc.setDrawColor(...BRAND_CHARCOAL);
  doc.setLineWidth(0.3);
  doc.rect(M, headerY, pageW - 2 * M, headerH);

  const logo = getCompanyImg(input.company.logo_url) || getDefaultLogoImg();
  const logoW = 32;
  const textLeft = logo ? M + 6 + logoW + 6 : M + 8;
  if (logo) {
    doc.addImage(logo, 'PNG', M + 6, headerY + 3, logoW, headerH - 6, undefined, 'FAST');
  }

  doc.setTextColor(...BRAND_CHARCOAL);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(input.company.name, textLeft, headerY + 7);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  const headerMaxW = pageW - M - 3 - textLeft;
  const addr = [
    input.company.address_line,
    [input.company.city, input.company.state, input.company.pincode].filter(Boolean).join(', '),
    `GSTIN: ${input.company.gstin || '—'}   State Code: ${input.company.state_code || '—'}`,
    `Phone: ${input.company.phone || '—'}   Email: ${input.company.email || '—'}`,
  ].filter(Boolean) as string[];
  let addrY = headerY + 12;
  addr.forEach((line) => {
    const wrapped = doc.splitTextToSize(String(line), headerMaxW);
    doc.text(wrapped, textLeft, addrY);
    addrY += wrapped.length * 4.2;
  });

  // Title bar under header (charcoal with gold underline)
  let y = headerY + headerH + 2;
  doc.setFillColor(...BRAND_CHARCOAL);
  doc.rect(M, y, pageW - 2 * M, 8, 'F');
  doc.setFillColor(...BRAND_GOLD);
  doc.rect(M, y + 8, pageW - 2 * M, 1.2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(TITLE[input.doc_type], pageW / 2, y + 5.7, { align: 'center' });
  doc.setTextColor(0, 0, 0);
  y += 9.2;
  const colW = (pageW - 2 * M) / 2;
  const detailH = 34;
  doc.rect(M, y, colW, detailH);
  doc.rect(M + colW, y, colW, detailH);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Bill To', M + 3, y + 5);
  doc.setFont('helvetica', 'normal');
  const p = input.party;
  const partyLines = [
    p.name,
    p.billing_street,
    [p.billing_city, p.billing_state, p.billing_pincode].filter(Boolean).join(', '),
    p.gstin ? `GSTIN: ${p.gstin}` : null,
    p.phone ? `Phone: ${p.phone}` : null,
  ].filter(Boolean) as string[];
  const partyMaxW = colW - 6;
  let py = y + 10;
  partyLines.forEach((l) => {
    const wrapped = doc.splitTextToSize(String(l), partyMaxW);
    doc.text(wrapped, M + 3, py);
    py += wrapped.length * 4.5;
  });

  doc.setFont('helvetica', 'bold');
  doc.text('Invoice Details', M + colW + 3, y + 5);
  doc.setFont('helvetica', 'normal');
  const details: [string, string][] = [
    ['Invoice No', input.doc_number || 'DRAFT'],
    ['Date', fmtDate(input.doc_date)],
    ['Place of Supply', `${input.place_of_supply_state || '—'}${input.place_of_supply_code ? ' (' + input.place_of_supply_code + ')' : ''}`],
  ];
  if (input.doc_type === 'tax_invoice' && input.payment_mode) {
    details.push(['Payment Mode', input.payment_mode]);
  }
  details.forEach(([k, v], i) => {
    doc.text(k, M + colW + 3, y + 10 + i * 5);
    doc.text(': ' + v, M + colW + 32, y + 10 + i * 5);
  });

  y += detailH + 2;

  // ---- Line items
  const showSplit = input.sameState;
  const head = showSplit
    ? [['#', 'Item', 'HSN/SAC', 'Qty', 'Unit', 'Price/Unit', 'CGST', 'SGST', 'Amount']]
    : [['#', 'Item', 'HSN/SAC', 'Qty', 'Unit', 'Price/Unit', 'IGST', 'Amount']];

  const rows = input.lines.map((l, i) => {
    const base = [
      String(i + 1),
      l.item_name + (l.description ? `\n${l.description}` : ''),
      l.hsn_sac || '—',
      String(l.quantity),
      l.unit || '',
      inr(l.unit_price),
    ];
    if (showSplit) {
      return [
        ...base,
        `${inr(l.cgst)}\n(${(l.tax_percent / 2).toFixed(1)}%)`,
        `${inr(l.sgst)}\n(${(l.tax_percent / 2).toFixed(1)}%)`,
        inr(l.amount),
      ];
    }
    return [
      ...base,
      `${inr(l.igst)}\n(${l.tax_percent.toFixed(1)}%)`,
      inr(l.amount),
    ];
  });

  autoTable(doc, {
    startY: y,
    head,
    body: rows,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 1.5 },
    headStyles: { fillColor: BRAND_CHARCOAL, textColor: 255, fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: 8 }, 1: { cellWidth: 55 } },
    margin: { left: M, right: M },
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 3;

  // ---- HSN summary
  const hsnHead = showSplit
    ? [
        [
          { content: 'HSN/SAC', rowSpan: 2 },
          { content: 'Taxable Value', rowSpan: 2 },
          { content: 'CGST', colSpan: 2 },
          { content: 'SGST', colSpan: 2 },
          { content: 'Total Tax', rowSpan: 2 },
        ],
        [{ content: 'Rate' }, { content: 'Amount' }, { content: 'Rate' }, { content: 'Amount' }],
      ]
    : [
        [
          { content: 'HSN/SAC', rowSpan: 2 },
          { content: 'Taxable Value', rowSpan: 2 },
          { content: 'IGST', colSpan: 2 },
          { content: 'Total Tax', rowSpan: 2 },
        ],
        [{ content: 'Rate' }, { content: 'Amount' }],
      ];

  const hsnBody = hsn.map((r) =>
    showSplit
      ? [r.hsn, inr(r.taxable), `${r.cgst_rate.toFixed(1)}%`, inr(r.cgst), `${r.sgst_rate.toFixed(1)}%`, inr(r.sgst), inr(r.total_tax)]
      : [r.hsn, inr(r.taxable), `${r.igst_rate.toFixed(1)}%`, inr(r.igst), inr(r.total_tax)]
  );
  // TOTAL row
  const totalRow = showSplit
    ? [{ content: 'TOTAL', styles: { fontStyle: 'bold' as const } }, inr(totals.total_taxable), '', inr(totals.total_cgst), '', inr(totals.total_sgst), inr(totals.total_tax)]
    : [{ content: 'TOTAL', styles: { fontStyle: 'bold' as const } }, inr(totals.total_taxable), '', inr(totals.total_igst), inr(totals.total_tax)];
  hsnBody.push(totalRow as unknown as string[]);

  autoTable(doc, {
    startY: y,
    head: hsnHead as never,
    body: hsnBody,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 1.5, halign: 'center' },
    headStyles: { fillColor: BRAND_CHARCOAL, textColor: 255, fontStyle: 'bold', halign: 'center' },
    margin: { left: M, right: M },
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 3;

  // ---- Totals block
  const totalsX = pageW - M - 70;
  doc.setFontSize(9);
  const totalsRows: [string, string][] = [
    ['Sub Total', inr(totals.total_taxable)],
    showSplit ? ['CGST', inr(totals.total_cgst)] : ['IGST', inr(totals.total_igst)],
    showSplit ? ['SGST', inr(totals.total_sgst)] : ['', ''],
    ['Round Off', (totals.round_off >= 0 ? '+' : '') + inr(totals.round_off)],
  ].filter((r) => r[0]) as [string, string][];

  totalsRows.forEach(([k, v], i) => {
    doc.setFont('helvetica', 'normal');
    doc.text(k, totalsX, y + 5 + i * 5);
    doc.text(v, pageW - M - 2, y + 5 + i * 5, { align: 'right' });
  });
  const totalY = y + 5 + totalsRows.length * 5 + 1;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Total', totalsX, totalY);
  doc.text('INR ' + inr(totals.total), pageW - M - 2, totalY, { align: 'right' });

  // Amount in Words + Terms — bordered layout block
  y = totalY + 5;
  const infoW = pageW - 2 * M;
  const words = numberToIndianWords(totals.total);
  const wordsWrapped = doc.splitTextToSize(words, infoW - 6);
  const wordsH = 5 + wordsWrapped.length * 4 + 3;

  doc.setDrawColor(...BRAND_CHARCOAL);
  doc.setLineWidth(0.2);
  doc.rect(M, y, infoW, wordsH);
  doc.setFillColor(...BRAND_GOLD_SOFT);
  doc.rect(M, y, infoW, 5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...BRAND_CHARCOAL);
  doc.text('AMOUNT IN WORDS', M + 3, y + 3.6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  doc.text(wordsWrapped, M + 3, y + 9);
  y += wordsH + 2;

  if (input.terms) {
    const t = doc.splitTextToSize(input.terms, infoW - 6);
    const termsH = 5 + t.length * 4 + 3;
    doc.rect(M, y, infoW, termsH);
    doc.setFillColor(...BRAND_GOLD_SOFT);
    doc.rect(M, y, infoW, 5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...BRAND_CHARCOAL);
    doc.text('TERMS & CONDITIONS', M + 3, y + 3.6);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(0, 0, 0);
    doc.text(t, M + 3, y + 9);
    y += termsH + 2;
  }

  // Footer: Bank details + Signature
  const footerH = 34;
  const footerY = y + 2;
  doc.rect(M, footerY, pageW - 2 * M, footerH);
  doc.line(M + colW, footerY, M + colW, footerY + footerH);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Bank Details', M + 3, footerY + 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const bank = input.company;
  const bankLines = [
    `Bank: ${bank.bank_name || '—'}`,
    `A/c No: ${bank.bank_account || '—'}`,
    `IFSC: ${bank.bank_ifsc || '—'}    MICR: ${bank.bank_micr || '—'}`,
    `Branch Code: ${bank.bank_branch_code || '—'}   SWIFT: ${bank.bank_swift || '—'}`,
  ];
  bankLines.forEach((l, i) => doc.text(l, M + 3, footerY + 10 + i * 4.5));

  // Signature column — centered
  const sigColX = M + colW;
  const sigColW = pageW - M - sigColX;
  const sigColCenter = sigColX + sigColW / 2;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(`For ${input.company.name}`, sigColCenter, footerY + 5, { align: 'center' });

  const sig = getCompanyImg(input.company.signature_url);
  const sigW = 40;
  const sigH = 16;
  if (sig) {
    doc.addImage(sig, 'PNG', sigColCenter - sigW / 2, footerY + 8, sigW, sigH, undefined, 'FAST');
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Authorized Signatory', sigColCenter, footerY + footerH - 3, { align: 'center' });

  return doc;
}
