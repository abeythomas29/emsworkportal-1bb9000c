import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { numberToIndianWords } from '@/lib/billing/numberToWords';
import type { CompanySettings } from '@/hooks/useBilling';
import type { PurchaseOrder, POItem } from '@/hooks/usePurchaseOrders';

const BRAND_CHARCOAL: [number, number, number] = [58, 58, 58];
const BRAND_GOLD: [number, number, number] = [212, 160, 23];
const BRAND_GOLD_SOFT: [number, number, number] = [252, 244, 220];

const inr = (n: number) =>
  new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);

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

export async function generatePOPdf(
  po: PurchaseOrder & { items: POItem[] },
  company: CompanySettings | null,
  vendor: VendorInfo | null,
): Promise<jsPDF> {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 36;
  let y = margin;

  const logo = await loadImg(company?.logo_url);

  // Header band
  doc.setFillColor(...BRAND_GOLD_SOFT);
  doc.rect(0, 0, pageW, 90, 'F');
  doc.setFillColor(...BRAND_GOLD);
  doc.rect(0, 90, pageW, 3, 'F');

  if (logo) {
    try { doc.addImage(logo, 'PNG', margin, 18, 56, 56); } catch {}
  }

  const headerLeft = logo ? margin + 68 : margin;
  doc.setTextColor(...BRAND_CHARCOAL);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(company?.name || 'Company', headerLeft, 38);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const addrLines = [
    company?.address_line,
    [company?.city, company?.state, company?.pincode].filter(Boolean).join(', '),
    company?.gstin ? `GSTIN: ${company.gstin}` : null,
    [company?.phone, company?.email].filter(Boolean).join(' · '),
  ].filter(Boolean) as string[];
  addrLines.forEach((l, i) => doc.text(l, headerLeft, 54 + i * 11));

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...BRAND_GOLD);
  doc.text('PURCHASE ORDER', pageW - margin, 40, { align: 'right' });
  doc.setFontSize(9);
  doc.setTextColor(...BRAND_CHARCOAL);
  doc.setFont('helvetica', 'normal');
  doc.text(`PO #: ${po.po_number ?? '—'}`, pageW - margin, 58, { align: 'right' });
  doc.text(`Date: ${new Date(po.po_date).toLocaleDateString('en-GB')}`, pageW - margin, 70, { align: 'right' });
  if (po.expected_delivery) {
    doc.text(`Expected: ${new Date(po.expected_delivery).toLocaleDateString('en-GB')}`, pageW - margin, 82, { align: 'right' });
  }

  y = 115;

  // Vendor block
  doc.setDrawColor(220);
  doc.setLineWidth(0.6);
  doc.roundedRect(margin, y, pageW - margin * 2, 78, 6, 6);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text('VENDOR', margin + 12, y + 16);
  doc.setTextColor(...BRAND_CHARCOAL);
  doc.setFontSize(11);
  doc.text(vendor?.name || po.vendor_name, margin + 12, y + 32);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const vAddr = [
    vendor?.billing_street,
    [vendor?.billing_city, vendor?.billing_state, vendor?.billing_pincode].filter(Boolean).join(', '),
    vendor?.billing_country,
  ].filter(Boolean) as string[];
  vAddr.forEach((l, i) => doc.text(l, margin + 12, y + 46 + i * 11));
  const gst = vendor?.gstin || po.vendor_gstin;
  if (gst) doc.text(`GSTIN: ${gst}`, pageW - margin - 12, y + 32, { align: 'right' });
  if (vendor?.phone) doc.text(`Phone: ${vendor.phone}`, pageW - margin - 12, y + 46, { align: 'right' });

  y += 92;

  // Items
  autoTable(doc, {
    startY: y,
    head: [['#', 'Item', 'HSN', 'Qty', 'Unit', 'Rate', 'GST%', 'Amount']],
    body: po.items.map((it, i) => {
      const gross = (Number(it.quantity) || 0) * (Number(it.unit_price) || 0);
      const tax = gross * ((Number(it.tax_percent) || 0) / 100);
      return [
        i + 1,
        it.item_name,
        it.hsn_sac || '',
        String(it.quantity),
        it.unit || '',
        inr(Number(it.unit_price)),
        `${it.tax_percent}%`,
        inr(gross + tax),
      ];
    }),
    styles: { fontSize: 9, cellPadding: 6, textColor: BRAND_CHARCOAL, lineColor: [230, 230, 230] },
    headStyles: { fillColor: BRAND_CHARCOAL, textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 26, halign: 'center' },
      3: { halign: 'right' },
      5: { halign: 'right' },
      6: { halign: 'right' },
      7: { halign: 'right' },
    },
    margin: { left: margin, right: margin },
  });

  const afterTable = (doc as any).lastAutoTable.finalY + 12;

  // Totals block
  const totalsX = pageW - margin - 220;
  const totalsW = 220;
  let ty = afterTable;
  const rowH = 16;
  doc.setFontSize(10);
  const row = (label: string, val: string, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.text(label, totalsX + 8, ty + 11);
    doc.text(val, totalsX + totalsW - 8, ty + 11, { align: 'right' });
    ty += rowH;
  };
  doc.setDrawColor(220);
  doc.roundedRect(totalsX, ty, totalsW, rowH * 3 + 4, 4, 4);
  ty += 2;
  row('Subtotal', `₹${inr(Number(po.sub_total))}`);
  row('Tax', `₹${inr(Number(po.total_tax))}`);
  doc.setFillColor(...BRAND_GOLD_SOFT);
  doc.rect(totalsX, ty, totalsW, rowH, 'F');
  row('Grand Total', `₹${inr(Number(po.total))}`, true);

  ty += 8;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  doc.setTextColor(90);
  const words = numberToIndianWords(Number(po.total)) + ' only';
  doc.text(`Amount in words: ${words}`, margin, ty + 8, { maxWidth: pageW - margin * 2 });

  ty += 30;

  if (po.notes) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...BRAND_CHARCOAL);
    doc.setFontSize(10);
    doc.text('Notes', margin, ty);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(doc.splitTextToSize(po.notes, pageW - margin * 2), margin, ty + 14);
  }

  // Footer / signature
  const footY = doc.internal.pageSize.getHeight() - 90;
  doc.setDrawColor(220);
  doc.line(pageW - margin - 160, footY, pageW - margin, footY);
  doc.setFontSize(9);
  doc.setTextColor(...BRAND_CHARCOAL);
  doc.text(`For ${company?.name || 'Company'}`, pageW - margin - 80, footY - 6, { align: 'center' });
  doc.text('Authorised Signatory', pageW - margin - 80, footY + 14, { align: 'center' });

  doc.setFontSize(8);
  doc.setTextColor(140);
  doc.text(
    'This is a computer-generated purchase order.',
    pageW / 2,
    doc.internal.pageSize.getHeight() - 24,
    { align: 'center' },
  );

  return doc;
}
