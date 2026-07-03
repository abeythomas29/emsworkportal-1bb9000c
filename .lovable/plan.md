
# Purchases Module

Mirror the Sales portal for the expense side: create Purchase Orders, upload vendor tax invoices (PDF/image) that AI auto-fills, and see monthly purchase totals with the same Executive Dark Command look.

## 1. Navigation & Access

- New route `/purchases`, admin-only (same guard as `/sales`).
- Sidebar entry "Purchases" (ShoppingBag icon) under the admin group.
- Page shell copies `Sales.tsx`: pill tabs → **Purchase Orders**, **Invoices**, **Reports**.

## 2. Database (new tables)

**`purchase_orders`**
- vendor_id (→ parties), vendor_name_snapshot, po_number (auto: `PO-YY-YY-####`), po_date, expected_delivery
- status: `draft | approved | sent | partially_received | received | cancelled`
- notes, total, created_by, approved_by, approved_at
- Auto-numbered via reused `billing_number_series` (doc_type `purchase_order`).

**`purchase_order_items`** — po_id, item_name, hsn_sac, quantity, unit, unit_price, tax_percent, amount, product_id (nullable), raw_material_id (nullable).

**`purchase_invoices`**
- vendor_id, vendor_name, vendor_gstin
- invoice_no (vendor's), invoice_date, po_id (nullable link)
- sub_total, total_tax, total, payment_status (`unpaid|partial|paid`), amount_paid
- attachment_url (storage path), attachment_mime
- extraction_status (`pending|extracted|manual|failed`), extraction_raw (jsonb)
- uploaded_by, created_at

**`purchase_invoice_items`** — invoice_id, item_name, hsn_sac, quantity, unit, unit_price, tax_percent, amount.

**Storage bucket**: `purchase-invoices` (private).

RLS: admin-only for all four tables (uses `has_role(auth.uid(),'admin')`), GRANTs to authenticated + service_role.

## 3. Purchase Order workflow

Lifecycle: **draft → approved → sent → partially_received / received** (or **cancelled**).
- New PO dialog (vendor picker reuses `parties`, line items reuse billing calc helpers).
- List panel with status filter + monthly total pills.
- Row actions: view, edit (draft only), approve, mark sent, mark received, cancel, delete (draft/cancelled only).
- Approved POs display in a compact picker when logging an invoice.

## 4. Invoice upload + AI extraction

- "Upload Invoice" button opens a dropzone (PDF, JPG, PNG, ≤10 MB).
- File uploads to `purchase-invoices` bucket → edge function `extract-purchase-invoice` called with signed URL.
- Edge function uses Lovable AI (`google/gemini-2.5-flash`, structured output) to extract: vendor name, GSTIN, invoice no/date, line items (name, qty, unit price, tax%), sub_total, tax total, grand total.
- Result opens a review dialog prefilled with extracted values; admin edits, links to a PO (optional), and saves.
- Manual entry path available if extraction fails.

## 5. Reports (mirrors `SalesReportsPanel`)

- Month selector, KPI cards: Total Spend, Invoice Count, Top Vendor, Avg Invoice Value.
- 6-month trend chart, top vendors + top items tables, unpaid outstanding widget.

## 6. Dashboard touch

- Small "Purchases this month" tile next to the Sales KPI strip (admin only).

## 7. Files to add / edit

New:
- `src/pages/Purchases.tsx`
- `src/components/purchases/PurchasesModule.tsx`
- `src/components/purchases/POListPanel.tsx`, `NewPODialog.tsx`, `POEditDialog.tsx`
- `src/components/purchases/InvoiceListPanel.tsx`, `UploadInvoiceDialog.tsx`, `ReviewExtractedInvoiceDialog.tsx`
- `src/components/purchases/PurchaseReportsPanel.tsx`
- `src/hooks/usePurchaseOrders.ts`, `usePurchaseInvoices.ts`
- `supabase/functions/extract-purchase-invoice/index.ts`

Edited:
- `src/App.tsx` (route), `src/components/layout/Sidebar.tsx` (nav item), `src/components/dashboard/…` (optional tile).

## Technical notes

- Reuse `src/lib/billing/calc.ts` and `financialYearOf` for numbering + line math.
- Reuse `get_next_billing_number` RPC by adding `purchase_order` as a valid doc_type (default prefix `PO-`).
- Extraction edge function sends the file as an `image_url` (image) or `file` (PDF) content block per the multimodal spec, with a strict JSON schema. Falls back to `manual` status on any error so the admin can key it in.
- Storage access via signed URLs (bucket is private).
- All new UI reuses the same tokens, pill tabs, gradient KPI cards, and empty-state style as the Sales portal so the look stays consistent.
