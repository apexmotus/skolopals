/**
 * One-off live verification for Phase 3f (finance/KPIs), same discipline as
 * `billing-smoke.ts`/`phase3e-smoke.ts`. The KPI views themselves
 * (`v_monthly_revenue`, `v_operating_surplus`, etc.) are already proven
 * correct by `db/scripts/test-month-close.sh` (part of `make test`) against
 * real fixture data — this script's job is narrower: confirm this module's
 * own hand-written wrapper SQL (`FinanceRepository`'s range filters, column
 * lists) actually runs against the real schema and returns numbers that
 * agree with a manually-computed expectation, through the real
 * `StoredProcRunner`/`applyRlsContext` code, inside one rolled-back
 * transaction.
 *
 * Usage: `DATABASE_URL=postgresql://$(whoami)@localhost:5432/skolopals_dev tsx scripts/finance-smoke.ts`
 */
import { randomUUID } from 'node:crypto';
import type { ClsService } from 'nestjs-cls';
import { Pool, type PoolClient } from 'pg';
import type { AppClsStore } from '../src/common/types/app-cls-store.js';
import type { AuthUser } from '../src/common/types/auth-user.js';
// Side-effecting import: registers the global `date` (OID 1082) type parser
// that makes `date` columns arrive as raw 'YYYY-MM-DD' strings instead of a
// local-midnight `Date` (see that file's own doc comment). The real app
// gets this for free through `DatabaseModule`'s normal bootstrap; a
// standalone script must trigger it explicitly, or `month`/`issuedOn`-style
// columns silently come back as `Date` objects here even though production
// never sees that.
import '../src/database/database.providers.js';
import { applyRlsContext } from '../src/database/rls-context.js';
import { StoredProcRunner } from '../src/database/stored-proc.runner.js';
import { TransactionContext } from '../src/database/transaction.context.js';
import { FinanceMapper } from '../src/modules/finance/finance.mapper.js';
import { FinanceRepository } from '../src/modules/finance/finance.repository.js';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`FAILED: ${message}`);
  console.log(`  PASS  ${message}`);
}

function actor(id: string, roles: string[]): AuthUser {
  return { id, roles, claims: { sub: id, role: 'authenticated' } };
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('Set DATABASE_URL to a local skolopals_dev connection string.');

  const pool = new Pool({ connectionString: databaseUrl });
  const client: PoolClient = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query('set constraints all immediate');
    await runChecks(pool, client);
    console.log('\nAll finance smoke checks passed.');
  } finally {
    await client.query('ROLLBACK').catch(() => undefined);
    client.release();
    await pool.end();
  }
}

async function runChecks(pool: Pool, client: PoolClient): Promise<void> {
  let currentActor: AuthUser | undefined;
  const cls = { get: () => currentActor } as unknown as ClsService<AppClsStore>;
  const txCtx = new TransactionContext();
  const sp = new StoredProcRunner(pool, txCtx, cls);
  const repo = new FinanceRepository(sp);

  async function asActor<T>(who: AuthUser, fn: () => Promise<T>): Promise<T> {
    currentActor = who;
    await applyRlsContext(client, cls);
    const result = await txCtx.run(client, fn);
    await client.query('reset role');
    return result;
  }

  const adminId = randomUUID();
  const guardianId = randomUUID();
  const learnerId = randomUUID();
  const adminActor = actor(adminId, ['admin']);

  // --- Fixtures: one billed, paid learner (reuses the billing-smoke shape), one expense, one converted enquiry ---
  await client.query(`insert into auth.users (id, email) values ($1, 'spike-admin-finance@test'), ($2, 'spike-guardian-finance@test')`, [
    adminId,
    guardianId,
  ]);
  await client.query(`insert into public.user_roles (user_id, role) values ($1, 'admin')`, [adminId]);
  await client.query(
    `insert into public.learners (id, full_name, date_of_birth, grade_code, status, joined_on) values
      ($1, 'Finance Smoke Learner', '2014-03-01', 'grade_8', 'active', '2026-11-01')`,
    [learnerId],
  );
  await client.query(
    `insert into public.learner_guardians (learner_id, guardian_id, relationship, is_primary, is_billing_contact) values
      ($1, $2, 'mother', true, true)`,
    [learnerId, guardianId],
  );
  await client.query(
    `insert into public.consents (consent_type_code, guardian_id, learner_id, granted, policy_version)
     select code, $1, $2, true, 'v1' from public.consent_types where is_required`,
    [guardianId, learnerId],
  );
  await client.query(
    `insert into public.enrolments (learner_id, package_code, status, start_date) values ($1, 'group_2', 'active', '2026-11-01')`,
    [learnerId],
  );

  const runResult = await asActor(adminActor, () =>
    sp.queryMany<{ invoice_id: string; billing_account_id: string; total_cents: string }>(
      'public.run_monthly_invoices',
      [{ name: 'p_period', value: '2026-11-01' }],
    ),
  );
  const invoice = runResult[0];
  if (!invoice) throw new Error('billing fixture produced no invoice');
  await asActor(adminActor, () =>
    sp.queryOne('public.record_payment', [
      { name: 'p_billing_account_id', value: invoice.billing_account_id },
      { name: 'p_amount_cents', value: Number(invoice.total_cents) },
      { name: 'p_method', value: 'eft' },
    ]),
  );

  // `run_monthly_invoices('2026-11-01')` issues on the 15th of the PRECEDING
  // month (billing in advance) -- the invoice's own `issued_on` is October,
  // not November. The expense is dated into that same October month so
  // `v_operating_surplus`/`v_break_even` (both keyed by month) compose a
  // single row with both revenue and expenses, instead of two separate
  // sparse rows that would make "surplus = collected - expenses" untestable
  // in one assertion.
  await client.query(
    `insert into public.expense_categories (code, name, sort_order) values ('finance_smoke_rent', 'Finance Smoke Rent', 1)`,
  );
  await client.query(
    `insert into public.expenses (category_code, incurred_on, amount_cents, recorded_by) values
      ('finance_smoke_rent', '2026-10-20', 400000, $1)`,
    [adminId],
  );

  await client.query(
    `insert into public.contact_enquiries (full_name, message, source, status, converted_learner_id) values
      ('Finance Smoke Enquiry', 'test', 'website', 'enrolled', $1)`,
    [learnerId],
  );

  // --- Checks, all as admin. A wide range + match-by-value, rather than a
  // pinpointed month: the DB is empty apart from this script's own fixtures
  // (confirmed before running), so there is exactly one row that can match
  // each of these value checks. ---
  const wideRange = { from: '2026-01-01', to: '2026-12-31' };

  const revenue = await asActor(adminActor, () => repo.getMonthlyRevenue(wideRange));
  const octRevenue = revenue.find((r) => Number(r.invoiced_cents) === Number(invoice.total_cents));
  assert(octRevenue !== undefined, "getMonthlyRevenue returns a row matching the fixture invoice's total");
  const octRevenueDto = octRevenue ? FinanceMapper.monthlyRevenueToDto(octRevenue) : undefined;
  assert(
    octRevenueDto?.collectedCents === octRevenueDto?.invoicedCents,
    `getMonthlyRevenue's collected cents equal invoiced (fully paid), got ${JSON.stringify(octRevenueDto)}`,
  );
  const revenueMonth = octRevenue!.month;

  const expenses = await asActor(adminActor, () => repo.getMonthlyExpenses(wideRange));
  const expenseRow = expenses.find((e) => Number(e.expense_cents) === 400000);
  assert(
    expenseRow !== undefined && expenseRow.month === revenueMonth,
    `getMonthlyExpenses sums the fixture expense into the same month as the invoice (${revenueMonth}), got ${JSON.stringify(expenseRow)}`,
  );

  const surplus = await asActor(adminActor, () => repo.getOperatingSurplus(wideRange));
  const surplusRow = surplus.find((s) => s.month === revenueMonth);
  const expectedSurplus = Number(invoice.total_cents) - 400000;
  assert(
    surplusRow !== undefined && Number(surplusRow.surplus_cents) === expectedSurplus,
    `getOperatingSurplus is collected (${invoice.total_cents}) minus expenses (400000) = ${expectedSurplus}, got ${surplusRow ? Number(surplusRow.surplus_cents) : 'undefined'}`,
  );

  const revPerLearner = await asActor(adminActor, () => repo.getRevenuePerLearner(wideRange));
  assert(
    revPerLearner.some((r) => r.month === revenueMonth && Number(r.learners_billed) === 1),
    'getRevenuePerLearner counts exactly 1 billed learner for the invoice month',
  );

  const learnerCounts = await asActor(adminActor, () => repo.getLearnerCounts(wideRange));
  const novCounts = learnerCounts.find((c) => c.month === '2026-11-01');
  assert(
    novCounts !== undefined && Number(novCounts.new_learners) >= 1,
    "getLearnerCounts' new_learners includes the fixture learner who joined in November",
  );

  const breakEven = await asActor(adminActor, () => repo.getBreakEven(wideRange));
  const breakEvenRow = breakEven.find((b) => b.month === revenueMonth);
  assert(
    breakEvenRow !== undefined &&
      Number(breakEvenRow.expense_cents) === 400000 &&
      breakEvenRow.avg_cents_per_learner !== null,
    `getBreakEven composes v_operating_surplus (expense_cents) with v_revenue_per_learner (avg_cents_per_learner), got ${JSON.stringify(breakEvenRow)}`,
  );

  const funnel = await asActor(adminActor, () => repo.getEnquiryFunnel(wideRange));
  const websiteFunnel = funnel.find((f) => f.source === 'website' && Number(f.converted) >= 1);
  assert(websiteFunnel !== undefined, 'getEnquiryFunnel counts the converted fixture enquiry');

  const categories = await asActor(adminActor, () => repo.listExpenseCategories());
  assert(
    categories.some((c) => c.code === 'finance_smoke_rent'),
    'listExpenseCategories returns the fixture category',
  );
  const expensesList = await asActor(adminActor, () => repo.listExpenses({ categoryCode: 'finance_smoke_rent' }));
  assert(expensesList.length === 1, 'listExpenses filters by categoryCode correctly');

  const recorded = await asActor(adminActor, () =>
    repo.recordExpense({
      categoryCode: 'finance_smoke_rent',
      incurredOn: '2026-11-06',
      amountCents: 1500,
      recordedBy: adminId,
    }),
  );
  assert(recorded.amount_cents === 1500, 'recordExpense inserts and returns the new row');
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
