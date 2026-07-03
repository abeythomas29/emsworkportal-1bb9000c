import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { numberToIndianWords } from '@/lib/billing/numberToWords';
import type { CompanySettings } from '@/hooks/useBilling';
import type { PurchaseOrder, POItem, POStatus } from '@/hooks/usePurchaseOrders';

// --- Palette (EMS corporate) ---
const INK: [number, number, number] = [23, 27, 34];        // near-black text
const MUTED: [number, number, number] = [110, 116, 128];   // secondary text
const HAIR: [number, number, number] = [222, 226, 232];    // hairline rules
const SOFT: [number, number, number] = [247, 248, 250];    // zebra + surface
const GOLD: [number, number, number] = [194, 145, 20];     // brand accent
const GOLD_SOFT: [number, number, number] = [253, 245, 219];
const OK: [number, number, number] = [22, 128, 96];
const WARN: [number, number, number] = [176, 108, 8];
const DANGER: [number, number, number] = [176, 42, 42];

// Helvetica in jsPDF has no ₹ glyph — use ASCII-safe "INR "
const money = (n: number) =>
  'INR ' + new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);

const dt = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export interface VendorInfo {
  name: string;
  gstin?: string | null;
  billing_street?: string | null;
  billing_city?: string | null;
  billing_state?: string | null;
  billing_state_code?: string | null;
  billing_pincode?: string | null;
  billing_country?: string | null;
  phone?: string | null;
}

function loadImg(url?: string | null): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (!url) return resolve(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

const STATUS_STYLE: Record<POStatus, { label: string; fg: [number, number, number]; bg: [number, number, number] }> = {
  draft:              { label: 'DRAFT',              fg: MUTED, bg: SOFT },
  approved:           { label: 'APPROVED',           fg: OK,    bg: [227, 245, 236] },
  sent:               { label: 'SENT TO VENDOR',     fg: [36, 84, 160], bg: [227, 236, 250] },
  partially_received: { label: 'PARTIALLY RECEIVED', fg: WARN,  bg: [253, 240, 214] },
  received:           { label: 'RECEIVED',           fg: OK,    bg: [227, 245, 236] },
  cancelled:          { label: 'CANCELLED',          fg: DANGER, bg: [251, 230, 230] },
};

function addressLines(a: {
  billing_street?: string | null;
  billing_city?: string | null;
  billing_state?: string | null;
  billing_pincode?: string | null;
  billing_country?: string | null;
}): string[] {
  const cityLine = [a.billing_city, a.billing_state, a.billing_pincode].filter(Boolean).join(', ');
  return [a.billing_street, cityLine, a.billing_country].filter((x): x is string => !!x && x.trim().length > 0);
}

function companyAddressLines(c: CompanySettings | null): string[] {
  if (!c) return [];
  const cityLine = [c.city, c.state, c.pincode].filter(Boolean).join(', ');
  return [c.address_line, cityLine, c.country].filter((x): x is string => !!x && x.trim().length > 0);
}

export async function generatePOPdf(
  po: PurchaseOrder & { items: POItem[] },
  company: CompanySettings | null,
  vendor: VendorInfo | null,
): Promise<jsPDF> {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 40; // page margin

  const logo = await loadImg(company?.logo_url);
  const signature = await loadImg(company?.signature_url);

  // ─────────────── HEADER ───────────────
  // Slim gold accent bar (top)
  doc.setFillColor(...GOLD);
  doc.rect(0, 0, pageW, 4, 'F');

  let cursorY = 34;

  // Left: logo + company
  if (logo) {
    try { doc.addImage(logo, 'PNG', M, cursorY - 4, 44, 44); } catch {}
  }
  const brandX = logo ? M + 56 : M;
  doc.setTextColor(...INK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(company?.name || 'Company', brandX, cursorY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  const addr = companyAddressLines(company);
  addr.forEach((l, i) => doc.text(l, brandX, cursorY + 20 + i * 10));
  const contactLine = [company?.phone, company?.email].filter(Boolean).join('  ·  ');
  if (contactLine) doc.text(contactLine, brandX, cursorY + 20 + addr.length * 10);

  // Right: document wordmark
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(...INK);
  doc.text('PURCHASE ORDER', pageW - M, cursorY + 4, { align: 'right' });

  doc.setFont('courier', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...GOLD);
  doc.text(po.po_number ?? 'DRAFT', pageW - M, cursorY + 22, { align: 'right' });

  // Status pill
  const st = STATUS_STYLE[po.status] ?? STATUS_STYLE.draft;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  const pillW = doc.getTextWidth(st.label) + 14;
  const pillH = 14;
  const pillX = pageW - M - pillW;
  const pillY = cursorY + 30;
  doc.setFillColor(...st.bg);
  doc.roundedRect(pillX, pillY, pillW, pillH, 3, 3, 'F');
  doc.setTextColor(...st.fg);
  doc.text(st.label, pillX + pillW / 2, pillY + 9.5, { align: 'center' });

  // Divider under header
  const headerBottom = Math.max(cursorY + 20 + addr.length * 10 + 20, pillY + pillH + 14);
  doc.setDrawColor(...HAIR);
  doc.setLineWidth(0.5);
  doc.line(M, headerBottom, pageW - M, headerBottom);

  // ─────────────── META STRIP ───────────────
  const metaY = headerBottom + 14;
  const metaCellW = (pageW - M * 2) / 4;
  const metaLabels = ['PO NUMBER', 'PO DATE', 'EXPECTED DELIVERY', 'PAYMENT TERMS'];
  const metaValues = [
    po.po_number ?? '—',
    dt(po.po_date),
    dt(po.expected_delivery),
    'Net 30 days',
  ];
  metaLabels.forEach((lab, i) => {
    const x = M + metaCellW * i;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text(lab, x, metaY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(...INK);
    doc.text(String(metaValues[i]), x, metaY + 14);
  });
  const metaBottom = metaY + 26;
  doc.setDrawColor(...HAIR);
  doc.line(M, metaBottom, pageW - M, metaBottom);

  // ─────────────── VENDOR + SHIP TO ───────────────
  const partsY = metaBottom + 18;
  const colW = (pageW - M * 2 - 20) / 2;

  const drawParty = (
    x: number,
    label: string,
    name: string,
    lines: string[],
    gstin?: string | null,
    phone?: string | null,
  ) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...GOLD);
    doc.text(label, x, partsY);
    doc.setTextColor(...INK);
    doc.setFontSize(12);
    doc.text(name || '—', x, partsY + 16);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    let yy = partsY + 30;
    lines.forEach((l) => { doc.text(l, x, yy); yy += 12; });
    if (gstin) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...INK);
      doc.text('GSTIN', x, yy + 4);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...MUTED);
      doc.text(gstin, x + 40, yy + 4);
      yy += 14;
    }
    if (phone) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...INK);
      doc.text('Phone', x, yy + 4);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...MUTED);
      doc.text(phone, x + 40, yy + 4);
      yy += 14;
    }
    return yy;
  };

  const vendorLines = vendor ? addressLines(vendor) : [];
  const y1 = drawParty(
    M,
    'VENDOR',
    vendor?.name || po.vendor_name,
    vendorLines,
    vendor?.gstin || po.vendor_gstin,
    vendor?.phone,
  );
  const shipLines = companyAddressLines(company);
  const y2 = drawParty(
    M + colW + 20,
    'SHIP TO',
    company?.name || 'Company',
    shipLines,
    company?.gstin,
    company?.phone,
  );
  const partsBottom = Math.max(y1, y2) + 10;

  // ─────────────── ITEMS TABLE ───────────────
  autoTable(doc, {
    startY: partsBottom,
    head: [['#', 'Description', 'HSN/SAC', 'Qty', 'Unit', 'Rate', 'GST', 'Amount']],
    body: po.items.map((it, i) => {
      const gross = (Number(it.quantity) || 0) * (Number(it.unit_price) || 0);
      const tax = gross * ((Number(it.tax_percent) || 0) / 100);
      return [
        String(i + 1),
        it.item_name,
        it.hsn_sac || '—',
        String(it.quantity),
        it.unit || '—',
        money(Number(it.unit_price)),
        `${it.tax_percent}%`,
        money(gross + tax),
      ];
    }),
    theme: 'plain',
    styles: {
      font: 'helvetica',
      fontSize: 9,
      cellPadding: { top: 8, right: 8, bottom: 8, left: 8 },
      textColor: INK,
      lineColor: HAIR,
      lineWidth: 0,
    },
    headStyles: {
      fontStyle: 'bold',
      fontSize: 7.5,
      textColor: MUTED,
      fillColor: [255, 255, 255],
      lineWidth: { bottom: 0.8, top: 0.8, left: 0, right: 0 },
      lineColor: INK,
      cellPadding: { top: 8, right: 8, bottom: 8, left: 8 },
    },
    alternateRowStyles: { fillColor: SOFT },
    columnStyles: {
      0: { cellWidth: 22, halign: 'center', textColor: MUTED },
      1: { cellWidth: 'auto', fontStyle: 'bold' },
      2: { cellWidth: 60, textColor: MUTED },
      3: { cellWidth: 34, halign: 'right' },
      4: { cellWidth: 38, textColor: MUTED },
      5: { cellWidth: 72, halign: 'right' },
      6: { cellWidth: 34, halign: 'right', textColor: MUTED },
      7: { cellWidth: 82, halign: 'right', fontStyle: 'bold' },
    },
    margin: { left: M, right: M },
    didDrawPage: () => {
      // page numbers drawn after loop below
    },
  });
  const afterTable = (doc as any).lastAutoTable.finalY;

  // Table closing rule
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.8);
  doc.line(M, afterTable + 1, pageW - M, afterTable + 1);

  // ─────────────── TOTALS ───────────────
  const totalsW = 240;
  const totalsX = pageW - M - totalsW;
  let ty = afterTable + 18;
  const totalRow = (label: string, value: string, opts: { bold?: boolean; big?: boolean } = {}) => {
    doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
    doc.setFontSize(opts.big ? 12 : 10);
    doc.setTextColor(opts.bold ? INK[0] : MUTED[0], opts.bold ? INK[1] : MUTED[1], opts.bold ? INK[2] : MUTED[2]);
    doc.text(label, totalsX, ty);
    doc.setTextColor(...INK);
    doc.text(value, totalsX + totalsW, ty, { align: 'right' });
    ty += opts.big ? 20 : 16;
  };
  totalRow('Subtotal', money(Number(po.sub_total)));
  totalRow('Tax (GST)', money(Number(po.total_tax)));
  // Gold grand total band
  const gtY = ty - 4;
  doc.setFillColor(...GOLD_SOFT);
  doc.roundedRect(totalsX - 10, gtY, totalsW + 10, 26, 3, 3, 'F');
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.6);
  doc.roundedRect(totalsX - 10, gtY, totalsW + 10, 26, 3, 3, 'S');
  ty = gtY + 17;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...INK);
  doc.text('GRAND TOTAL', totalsX, ty);
  doc.setFontSize(13);
  doc.text(money(Number(po.total)), totalsX + totalsW, ty, { align: 'right' });
  ty = gtY + 40;

  // Amount in words (left column, aligned with totals top)
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  const words = numberToIndianWords(Number(po.total)) + ' only';
  const wrapped = doc.splitTextToSize(`Amount in words: ${words}`, pageW - M * 2 - totalsW - 20);
  doc.text(wrapped, M, afterTable + 22);

  let blockY = Math.max(ty, afterTable + 22 + wrapped.length * 11) + 18;

  // ─────────────── NOTES & TERMS ───────────────
  if (po.notes && po.notes.trim().length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...GOLD);
    doc.text('NOTES', M, blockY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...INK);
    const noteLines = doc.splitTextToSize(po.notes, pageW - M * 2);
    doc.text(noteLines, M, blockY + 14);
    blockY += 14 + noteLines.length * 12 + 12;
  }

  const terms = (po.terms ?? '')
    .split(/\n\s*\n/)
    .map((t) => t.trim())
    .filter(Boolean);

  let termY = blockY;
  if (terms.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...GOLD);
    doc.text('TERMS & CONDITIONS', M, blockY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...MUTED);
    termY = blockY + 14;
    terms.forEach((t, i) => {
      doc.text(`${i + 1}.`, M, termY);
      const tw = doc.splitTextToSize(t, pageW - M * 2 - 14);
      doc.text(tw, M + 14, termY);
      termY += tw.length * 11 + 6;
    });
  }

  // ─────────────── SIGNATURE ───────────────
  const sigW = 180;
  const sigX = pageW - M - sigW;
  const sigY = Math.max(termY + 24, pageH - 130);
  if (signature) {
    try { doc.addImage(signature, 'PNG', sigX + sigW / 2 - 36, sigY - 42, 72, 40); } catch {}
  }
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.4);
  doc.line(sigX, sigY, sigX + sigW, sigY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...INK);
  doc.text(`For ${company?.name || 'Company'}`, sigX + sigW / 2, sigY + 12, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text('Authorised Signatory', sigX + sigW / 2, sigY + 24, { align: 'center' });

  // ─────────────── FOOTER (all pages) ───────────────
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    // hairline
    doc.setDrawColor(...HAIR);
    doc.setLineWidth(0.5);
    doc.line(M, pageH - 34, pageW - M, pageH - 34);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    const footL = [company?.name, company?.gstin ? `GSTIN ${company.gstin}` : null, company?.email]
      .filter(Boolean).join('  ·  ');
    doc.text(footL, M, pageH - 20);
    doc.text(`Page ${i} of ${pageCount}`, pageW - M, pageH - 20, { align: 'right' });
    doc.setFontSize(6.5);
    doc.text('This is a computer-generated purchase order and does not require a physical signature to be valid.',
      pageW / 2, pageH - 10, { align: 'center' });
  }

  return doc;
}
