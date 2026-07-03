## Add editable Terms & Conditions to POs

Let admins attach custom terms to each Purchase Order, save reusable term templates (like the reference image), pick one when creating a PO, and print those terms on the generated PDF. Seed one template with the "Pricing & Payment / Delivery / Quality…" wording you provided.

### What changes

**1. New "Terms Templates" library (admin only)**

- New table `po_term_templates` with fields: name, content, is_default.
- Managed from a small **"Terms templates"** button in the Purchases header.
- Dialog lists all saved templates (Name · preview · Default badge · Edit / Delete), with an "Add template" form (Name + multi-line Content + "Set as default" toggle).
- Seeded on migration with one template named **"Standard Purchase Terms"** containing the 8 clauses you sent (Pricing & Payment, Delivery, Quality, Warranty, Compliance, Indemnity, Termination, Governing Law), marked as default.

**2. Terms section inside "New PO" dialog**

Added below Notes:

```text
Terms & Conditions                    [ Load template ▾ ]  [ Save as new template ]
┌──────────────────────────────────────────────────────────┐
│ (multi-line textarea, pre-filled with default template)  │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

- **Load template** dropdown lists all saved templates; picking one replaces textarea content.
- **Save as new template** opens a tiny inline prompt for a name and saves the current textarea as a new template.
- Empty textarea = no terms printed on PDF (falls back to nothing, not the old hard-coded list).
- The default template is auto-loaded when opening the dialog for a fresh PO.

**3. PO stores its own terms**

Add `terms text` column to `purchase_orders` so what you saw when creating the PO is exactly what prints — future edits to the template don't rewrite past POs.

**4. PDF update**

`generatePOPdf` now reads `po.terms`:
- If present: split on blank lines into numbered clauses (each paragraph = one item), rendered under **TERMS & CONDITIONS** exactly like today's layout.
- If empty: the Terms section is skipped entirely, so the signature block moves up cleanly.

### Technical notes

- Migration adds `po_term_templates` (admin RLS via `has_role`), grants to `authenticated` + `service_role`, `updated_at` trigger, unique index enforcing at most one `is_default = true`, and seeds the "Standard Purchase Terms" row. Also adds `purchase_orders.terms text`.
- New hook `usePOTermTemplates` (list / upsert / remove / default).
- `usePurchaseOrders.createPO` accepts optional `terms`.
- `POListPanel` header gets a `[Terms templates]` button opening `TermsTemplatesDialog.tsx`.
- `NewPODialog.tsx` gets a Terms block with template loader + save-as-template action; state seeded from the default template on open.
- `poPdf.ts`: replace the hard-coded `terms` array with `po.terms?.split(/\n\s*\n/).map(t => t.trim()).filter(Boolean)`; skip the whole section if empty.

### Files

- Migration: `po_term_templates` table + seed + `purchase_orders.terms`.
- New: `src/hooks/usePOTermTemplates.ts`, `src/components/purchases/TermsTemplatesDialog.tsx`.
- Edited: `src/hooks/usePurchaseOrders.ts`, `src/components/purchases/NewPODialog.tsx`, `src/components/purchases/POListPanel.tsx`, `src/lib/purchases/poPdf.ts`.
