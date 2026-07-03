import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { numberToIndianWords } from './numberToWords';
import { buildHsnSummary, computeTotals, ComputedLine } from './calc';

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
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const M = 10;
  const totals = computeTotals(input.lines);
  const hsn = buildHsnSummary(input.lines, input.sameState);

  // ---- Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(TITLE[input.doc_type], pageW / 2, M + 6, { align: 'center' });

  // ---- Company info box
  let y = M + 10;
  const boxH = 26;
  doc.setDrawColor(0);
  doc.rect(M, y, pageW - 2 * M, boxH);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(input.company.name, M + 3, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const addr = [
    input.company.address_line,
    [input.company.city, input.company.state, input.company.pincode].filter(Boolean).join(', '),
    `GSTIN: ${input.company.gstin || '—'}   State Code: ${input.company.state_code || '—'}`,
    `Phone: ${input.company.phone || '—'}   Email: ${input.company.email || '—'}`,
  ].filter(Boolean) as string[];
  addr.forEach((line, i) => doc.text(line, M + 3, y + 11 + i * 4));

  // ---- Bill To / Invoice details
  y += boxH;
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
  partyLines.forEach((l, i) => doc.text(String(l), M + 3, y + 10 + i * 4.5));

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
    headStyles: { fillColor: [230, 230, 230], textColor: 0, fontStyle: 'bold' },
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
    headStyles: { fillColor: [230, 230, 230], textColor: 0, fontStyle: 'bold', halign: 'center' },
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

  // Amount in words
  y = totalY + 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Amount in Words:', M, y);
  doc.setFont('helvetica', 'normal');
  const words = numberToIndianWords(totals.total);
  const wrapped = doc.splitTextToSize(words, pageW - 2 * M - 35);
  doc.text(wrapped, M + 35, y);
  y += (wrapped.length * 4) + 3;

  // Terms
  if (input.terms) {
    doc.setFont('helvetica', 'bold');
    doc.text('Terms & Conditions', M, y);
    doc.setFont('helvetica', 'normal');
    const t = doc.splitTextToSize(input.terms, pageW - 2 * M);
    doc.text(t, M, y + 4);
    y += 4 + t.length * 4 + 2;
  }

  // Footer: Bank details + Signature
  const footerH = 32;
  const footerY = Math.max(y, doc.internal.pageSize.getHeight() - M - footerH);
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

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(`For ${input.company.name}`, M + colW + 3, footerY + 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Authorized Signatory', pageW - M - 3, footerY + footerH - 3, { align: 'right' });

  return doc;
}
