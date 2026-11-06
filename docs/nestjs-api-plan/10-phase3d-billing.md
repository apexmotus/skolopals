# Phase 3d — Billing

Depends on Phase 3a (guardians/billing contacts) and Phase 3b (enrolments, packages — and
resolves the invoice-numbering dependency `08-...md` task 2 flagged, if it was deferred rather
than built inline in 3b). The highest-stakes module in the system: every bug here is either a
family billed wrong or a family not billed at all. Build order: **`billing-accounts` →
`invoices`/`invoice-lines` → `usp_Invoice_NextNumber` (if not already built in 3b) →
`payments`/`allocations` → `credit-notes` → `run-monthly-invoices`/`apply-late-fees`**. The
monthly run and late-fee endpoints come last deliberately: they're the two that touch
everything else in this module, so build and prove the pieces they orchestrate first.

## Modules, endpoints, business rules, SPs

Fully specified in `03-endpoints-and-business-rules.md` §`billing` and `02-sp-catalogue.md`
§`Billing`.

## Tasks specific to this slice

1. Resolve the invoice-numbering dependency from Phase 3b now if it wasn't resolved then:
   confirm `EnrolmentManager.activate()` calls `BillingManager.allocateInvoiceNumber()` (Manager
   → Manager, per generic spec §4.2), not a repository reached around the layer boundary.
2. Implement `usp_Invoice_GetStatus` (ports `v_invoice_status`) as the **only** place payment
   state (paid/part-paid/overdue/unpaid) is computed — grep the rest of the module's code
   during review for any place that stores or re-derives this independently; there should be
   none, matching the explicit "never stored" design intent carried over from Postgres.
3. `usp_Billing_RecordPayment`'s oldest-first allocation loop is deliberately row-by-row plpgsql
   (per the catalogue note) — don't "simplify" it into a single set-based `UPDATE` during
   review; the sequential dependency (each allocation's size depends on the running remainder)
   is real, not an artifact of a lazy implementation.
4. Write the two worked examples from `docs/SPEC-2026-centre-rebuild.md` §9.2–9.3 (join-before-
   the-15th, join-after-the-15th) as **e2e fixtures**, not just prose: seed an enrolment with
   the stated start date and package, run `usp_Billing_RunMonthlyInvoices` for the stated
   target periods via the admin endpoint, and assert the invoice numbers/lines/totals in the
   spec's tables come out byte-for-byte. These worked examples are the actual acceptance
   criteria the business plan and the owner already agreed to (SPEC §9.4 "Settled") — proving
   the API wiring against them is stronger evidence than any unit test this plan could invent.
5. Confirm `BillingSettings` current values (`IssueDay=15`, `DueDay=1`, `GraceDays=3`,
   `LateFeeCents=15000`) are correct in the real database for whatever environment this slice
   is tested against — there is no seed file to apply (Phase 0 doesn't produce one; the schema
   and its data already exist). Production values stay owner-entered, per the existing
   convention; nothing here is hardcoded into application code.

## Verify

- `pnpm lint && pnpm test && pnpm test:e2e` pass.
- Every endpoint in the billing endpoint table exists with the specified shape; Swagger
  complete; **Tutor role is confirmed absent from every one of them** (negative test: a Tutor
  JWT against each billing endpoint returns 403, not partial data).
- The two worked-example e2e fixtures from task 4 pass exactly.
- Idempotency proven, not just asserted: calling `usp_Billing_RunMonthlyInvoices` twice in a
  row for the same period produces identical state after the second call (no duplicate lines,
  no changed totals); same for `usp_Billing_ApplyLateFees`.
- Manager/Repository tests cover: payment allocation never exceeds payment value; invoice
  settlement never exceeds invoice total; registration billed once per learner across multiple
  enrolments for the same learner (re-enrolment after leaving, if that's a real scenario — flag
  to the owner if "a learner who left and re-enrolled" isn't an anticipated case, since the
  current Postgres schema's uniqueness check is per-learner, not per-enrolment, and this plan
  should confirm that's still the intended behaviour before shipping it unchanged).
