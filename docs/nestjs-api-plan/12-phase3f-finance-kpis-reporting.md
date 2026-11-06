# Phase 3f — Finance & KPI Reporting

Depends on every other feature module: every KPI view here reads data owned by `billing`
(3d), `timetable`/`attendance`/`programmes` (3b), `assessment` (3c), and `enquiries` (3e). Build
this last among the Phase 3 slices. This is the `finance` module referenced in
`01-app-definition.md` and deferred from `03-endpoints-and-business-rules.md`.

## Endpoints

All admin-only, all read-only except the two expense-recording endpoints. One repository
method per KPI, each calling a thin wrapper around the matching **existing** Postgres view
(`SELECT * FROM <view> WHERE ...`) — the views (including the ones using `FILTER`,
`generate_series`, etc.) already exist and already do this derivation work; Phase 0 §5 voids
any "recreate the views" or "replace `generate_series`" translation work entirely. There is
nothing to port here beyond writing the thin read wrapper and the Manager method calling it.

| # | Method | Path | Roles | Manager method | SP | Ports view | Notes |
|---|---|---|---|---|---|---|---|
| 1 | GET | `/finance/expense-categories` | Admin | `listCategories()` | `usp_ExpenseCategory_List` | — | |
| 2 | POST | `/finance/expense-categories` | Admin | `createCategory(dto)` | `usp_ExpenseCategory_Create` | — | |
| 3 | GET | `/finance/expenses` | Admin | `listExpenses(query)` | `usp_Expense_List` | — | |
| 4 | POST | `/finance/expenses` | Admin | `recordExpense(dto)` | `usp_Expense_Create` | — | |
| 5 | GET | `/finance/kpis/monthly-revenue` | Admin | `getMonthlyRevenue(range)` | `usp_Report_MonthlyRevenue` | `v_monthly_revenue` | |
| 6 | GET | `/finance/kpis/monthly-expenses` | Admin | `getMonthlyExpenses(range)` | `usp_Report_MonthlyExpenses` | `v_monthly_expenses` | |
| 7 | GET | `/finance/kpis/operating-surplus` | Admin | `getOperatingSurplus(range)` | `usp_Report_OperatingSurplus` | `v_operating_surplus` | Cash-collected basis, not invoiced — see note below |
| 8 | GET | `/finance/kpis/revenue-per-learner` | Admin | `getRevenuePerLearner(range)` | `usp_Report_RevenuePerLearner` | `v_revenue_per_learner` | |
| 9 | GET | `/finance/kpis/attendance-rate` | Admin | `getAttendanceRate(range)` | `usp_Report_AttendanceRate` | `v_attendance` + `v_attendance_rate` | Unions class and programme attendance |
| 10 | GET | `/finance/kpis/assessment-improvement` | Admin | `getAssessmentImprovement()` | `usp_Report_AssessmentImprovement` | `v_assessment_improvement` | Per learner, per domain |
| 11 | GET | `/finance/kpis/learner-counts` | Admin | `getLearnerCounts(range)` | `usp_Report_LearnerCounts` | `v_learner_counts` | Monthly spine already built on native `generate_series` inside the view |
| 12 | GET | `/finance/kpis/learner-retention` | Admin | `getLearnerRetention(range)` | `usp_Report_LearnerRetention` | `v_learner_retention` | Derived from #11 |
| 13 | GET | `/finance/kpis/enquiry-funnel` | Admin | `getEnquiryFunnel(range)` | `usp_Report_EnquiryFunnel` | `v_enquiry_funnel` | |
| 14 | GET | `/finance/kpis/tutor-session-load` | Admin | `getTutorSessionLoad(tutorId?, range)` | `usp_Report_TutorSessionLoad` | `v_tutor_session_load` | Feeds per-session/per-hour pay review |
| 15 | GET | `/finance/kpis/break-even` | Admin | `getBreakEven(range)` | `usp_Report_BreakEven` | `v_break_even` | Composes #7, #8, #11 |

(`v_outstanding_fees` and `v_account_statement` are listed under the `billing` module in
`03-endpoints-and-business-rules.md` rather than here, since they're invoice/account detail
reports a specific guardian or admin looks at, not centre-wide KPIs — keep that split rather
than moving them here "for consistency", the audience is genuinely different.)

## Business rules

- `v_operating_surplus`'s port must stay on a **cash-collected basis** (`settled_cents` from
  `usp_Invoice_GetStatus`), not invoiced — the Postgres comment is explicit that an
  invoiced-basis surplus would flatter the picture given non-payment is the business plan's
  top-named risk (BP §22). Do not "simplify" this to sum of invoice totals during
  implementation; that changes what the number means.
- Every KPI here is **read-only and admin-only** — this module owns no write path except the
  two expense-recording endpoints, and never writes to another module's tables.
- Cacheable: every KPI endpoint, 5–15 minute TTL (these are dashboard reads, not real-time
  figures, and the underlying data changes at most daily) — key format
  `skolopals:finance:kpi:<name>:<rangeHash>`, invalidated on a time-based TTL only (not on
  write — the write paths live in other modules and invalidating cross-module on every
  `billing`/`attendance` write would cost more than the staleness this module can tolerate;
  state this explicitly as a deliberate choice, not an oversight, since it differs from every
  other cacheable list in this plan).

## Verify

- `pnpm lint && pnpm test && pnpm test:e2e` pass.
- Each `usp_Report_*` SP's output matches its source view's output on the same seeded fixture
  data used in Phase 3b/3d/3c's e2e tests — run the same fixtures through both the module's own
  e2e assertions and this module's KPI endpoints and cross-check the numbers agree (e.g. the
  billing module's worked-example fixture from `10-phase3d-billing.md` should produce a
  `getMonthlyRevenue` figure that matches the invoice totals asserted there).
- `getBreakEven` composes three other reports' output correctly for at least one fixture month
  with non-zero expenses and non-zero learners.
