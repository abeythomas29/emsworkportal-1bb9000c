# Invoice numbering integrity: no duplicates, no silent gaps

## What I found (verified in the database)

Tax invoices for FY 26-27 currently jump: **56, 67, 68, 75 are missing** (55 → 57, 66 → 69, 74 → 76). The counter is at 78.

Two root causes are possible and both are currently unguarded:

- `billing_documents` has **no uniqueness rule** on the invoice number — only a plain (non-unique) index. Two documents can carry the same number.
- Deleting a document is a **hard delete** with no record kept. Once a finalized invoice is deleted, its number vanishes with no trace, leaving exactly the kind of gap you are seeing.

There is no way to tell today which of the four numbers were deleted vs. never completed, because nothing was recorded.

## What I will build

**1. Numbers can never repeat**
A database-level uniqueness rule on invoice number per document type and financial year. Any attempt to save a duplicate is rejected by the database itself, not just by the screen.

**2. Finalized invoices can no longer be deleted — only cancelled**
A finalized tax invoice keeps its number forever. The three-dot menu will show **Cancel invoice** (asks for a reason) instead of Delete. Cancelled invoices stay in the list with a red "Cancelled" badge, are excluded from sales totals, and their number is still accounted for. Drafts (never numbered) can still be deleted freely.

**3. A deletion / change log**
Every delete, cancellation, and number change is recorded automatically with who did it, when, the reason, and a full snapshot of the document and its line items. Admins get a **Deleted & cancelled documents** view where the snapshot can be inspected and a PDF regenerated if needed.

**4. Number gap report**
A panel in Sales showing, per financial year, every missing number in the sequence and its explanation: cancelled, deleted (with who/when/reason), or "unaccounted — before audit log". The four existing gaps (56, 67, 68, 75) will be seeded as "unaccounted, predates logging" so the list is honest rather than empty.

**5. Number allocation logging**
Each time a number is issued it is logged, so if a finalize fails halfway the burnt number is visible in the gap report instead of disappearing.

## Technical notes

- Migration: unique partial index on `(doc_type, financial_year, doc_number)` where `doc_number is not null`; new tables `billing_document_audit` (action, actor, reason, snapshot jsonb, created_at) and `billing_number_allocations`; GRANTs + RLS (insert by authenticated, read by admin/manager) in the same migration.
- A `before delete` trigger on `billing_documents` writes the snapshot (header + items) to the audit table; a second trigger blocks deletes when `status = 'finalized'` so the rule cannot be bypassed from anywhere.
- `status` gains `cancelled`; `get_sales_dashboard_stats` and the billing list totals exclude it.
- `get_next_billing_number` also inserts into `billing_number_allocations`.
- Client: `useBilling` delete mutation becomes `cancelDocument` for finalized docs; `BillingListPanel` row menu, badges, and a new `NumberGapPanel` + `AuditLogDialog`.

## Out of scope

Recovering the actual content of invoices 56, 67, 68 and 75 — that data was hard-deleted and is not retrievable. They will be listed as unaccounted gaps; if you have the paper/PDF copies you can re-create them under those exact numbers once uniqueness is in place.
