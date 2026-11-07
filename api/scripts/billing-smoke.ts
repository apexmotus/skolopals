/**
 * One-off live verification for Phase 3d (billing), same discipline as
 * `people-rls-spike.ts`: drives the real `BillingManager`/`BillingRepository`
 * classes (not reimplemented SQL) against the real local Postgres schema,
 * through the real `StoredProcRunner`/`UnitOfWork`/`applyRlsContext` code,
 * inside one transaction that is always rolled back — it leaves no trace
 * either way. `set constraints all immediate` (same trick as
 * `db/scripts/test-billing.sh`) makes the schema's deferred constraint
 * triggers (oversettlement, capacity) fire immediately rather than only at
 * COMMIT, since this script never actually commits.
 *
 * Usage: `DATABASE_URL=postgresql://$(whoami)@localhost:5432/skolopals_dev tsx scripts/billing-smoke.ts`
 */
import { NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { ClsService } from 'nestjs-cls';
import { Pool, type PoolClient } from 'pg';
import type { AppClsStore } from '../src/common/types/app-cls-store';
import { BusinessRuleException } from '../src/common/exceptions/business-rule.exception';
import type { AuthUser } from '../src/common/types/auth-user';
// Side-effecting import: registers the global `date` (OID 1082) type parser
// that makes `date` columns (issuedOn/dueOn/paidOn below) arrive as raw
// 'YYYY-MM-DD' strings instead of a local-midnight `Date` — see that file's
// own doc comment. The real app gets this for free through `DatabaseModule`'s
// bootstrap; a standalone script must trigger it explicitly. This script's
// own assertions never happened to do strict value comparisons on a bare
// `date` field, so the gap was silent here — found only while writing
// `finance-smoke.ts`, which did.
import '../src/database/database.providers';
import { applyRlsContext } from '../src/database/rls-context';
import { StoredProcRunner } from '../src/database/stored-proc.runner';
import { TransactionContext } from '../src/database/transaction.context';
import { UnitOfWork } from '../src/database/unit-of-work';
import { BillingManager } from '../src/modules/billing/billing.manager';
import { BillingRepository } from '../src/modules/billing/billing.repository';

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
    console.log('\nAll billing smoke checks passed.');
  } finally {
    await client.query('ROLLBACK').catch(() => undefined);
    client.release();
    await pool.end();
  }
}

async function runChecks(pool: Pool, client: PoolClient): Promise<void> {
  // Mutable "current actor" the fake ClsService reads — swapped between
  // calls, same trick as people-rls-spike.ts's clsFor(), but one mutable
  // object instead of a new one per call since everything here shares one
  // ambient transaction.
  let currentActor: AuthUser | undefined;
  const cls = { get: () => currentActor } as unknown as ClsService<AppClsStore>;

  const txCtx = new TransactionContext();
  const sp = new StoredProcRunner(pool, txCtx, cls);
  const uow = new UnitOfWork(pool, txCtx, cls);
  const repo = new BillingRepository(sp);
  const manager = new BillingManager(repo, uow);

  async function asActor<T>(who: AuthUser | undefined, fn: () => Promise<T>): Promise<T> {
    currentActor = who;
    await applyRlsContext(client, cls);
    const result = await txCtx.run(client, fn);
    await client.query('reset role');
    return result;
  }

  /**
   * Any call expected to fail at the SQL level (not just in application
   * code) must run inside a SAVEPOINT — a failed statement otherwise aborts
   * this whole single-transaction script, per Postgres's normal "current
   * transaction is aborted" rule. Returns the thrown error, or `undefined`
   * if `fn` unexpectedly succeeded.
   */
  async function expectDbError(fn: () => Promise<unknown>): Promise<unknown> {
    await client.query('savepoint sp');
    let caught: unknown;
    try {
      await fn();
    } catch (err) {
      caught = err;
    }
    await client.query('rollback to savepoint sp');
    return caught;
  }

  const guardianA = randomUUID();
  const guardianB = randomUUID();
  const adminId = randomUUID();
  const learnerA = randomUUID();
  const learnerB = randomUUID();

  const adminActor = actor(adminId, ['admin']);
  const guardianAActor = actor(guardianA, ['parent']);
  const guardianBActor = actor(guardianB, ['parent']);

  // --- Fixtures: `on_auth_user_created` auto-creates profiles/user_roles('parent')/guardians. ---
  await client.query(
    `insert into auth.users (id, email, raw_user_meta_data) values
      ($1, 'spike-guardian-a@test', '{}'), ($2, 'spike-guardian-b@test', '{}'), ($3, 'spike-admin@test', '{}')`,
    [guardianA, guardianB, adminId],
  );
  await client.query(`insert into public.user_roles (user_id, role) values ($1, 'admin')`, [adminId]);

  await client.query(
    `insert into public.learners (id, full_name, date_of_birth, grade_code, status) values
      ($1, 'Learner A', '2014-03-01', 'grade_8', 'active'),
      ($2, 'Learner B', '2014-03-01', 'grade_8', 'active')`,
    [learnerA, learnerB],
  );
  await client.query(
    `insert into public.learner_guardians (learner_id, guardian_id, relationship, is_primary, is_billing_contact) values
      ($1, $2, 'mother', true, true), ($3, $4, 'mother', true, true)`,
    [learnerA, guardianA, learnerB, guardianB],
  );
  // The `active`-status trigger `enrolment_requires_consent` needs every
  // `is_required` consent type on file before an enrolment can go active.
  await client.query(
    `insert into public.consents (consent_type_code, guardian_id, learner_id, granted, policy_version)
     select ct.code, g.guardian_id, g.learner_id, true, 'v1'
     from public.consent_types ct
     cross join (values ($1::uuid, $2::uuid), ($3::uuid, $4::uuid)) as g(guardian_id, learner_id)
     where ct.is_required`,
    [guardianA, learnerA, guardianB, learnerB],
  );
  await client.query(
    `insert into public.enrolments (learner_id, package_code, status, start_date) values
      ($1, 'group_2', 'active', '2026-11-01'), ($2, 'group_2', 'active', '2026-11-01')`,
    [learnerA, learnerB],
  );

  // --- Billing run, as admin ---
  const runResult = await asActor(adminActor, () => manager.runMonthly({ period: '2026-12-01' }));
  assert(runResult.length === 2, `run-monthly-invoices touched 2 invoices (one per account), got ${runResult.length}`);

  // `run_monthly_invoices` orders its result by `lg.guardian_id` (UUID
  // order), NOT by insertion order — resolve each guardian's own invoice by
  // their own billing account id (via `getMine`), the same way a real actor
  // would, rather than assuming array position.
  const accountA = await asActor(guardianAActor, () => manager.getMine(guardianAActor));
  const accountB = await asActor(guardianBActor, () => manager.getMine(guardianBActor));
  const invoiceAResult = runResult.find((r) => r.billingAccountId === accountA.id);
  const invoiceBResult = runResult.find((r) => r.billingAccountId === accountB.id);
  if (!invoiceAResult || !invoiceBResult) throw new Error('Could not resolve both guardians\' invoices from the run result');
  const invoiceA = invoiceAResult;
  const invoiceB = invoiceBResult;
  assert(invoiceA.totalCents === 150000, `account A's invoice is R1,500 (Nov R750 + Dec R750), got ${invoiceA.totalCents}`);

  // Idempotency (plan's own acceptance check): re-running the same period must not duplicate.
  const rerun = await asActor(adminActor, () => manager.runMonthly({ period: '2026-12-01' }));
  assert(rerun.length === 0, `re-running the same period touches nothing (idempotent), got ${rerun.length} rows`);

  // --- Invoice read, as the owning guardian ---
  const invoiceDto = await asActor(guardianAActor, () => manager.getInvoiceById(invoiceA.invoiceId));
  assert(invoiceDto.lines.length === 2, `invoice has 2 lines (Nov + Dec tuition), got ${invoiceDto.lines.length}`);
  assert(invoiceDto.paymentState === 'unpaid', `invoice starts unpaid, got "${invoiceDto.paymentState}"`);
  assert(
    typeof invoiceDto.totalCents === 'number' && invoiceDto.totalCents === 150000,
    'bigint total_cents parsed to a real number',
  );

  // --- Cross-guardian 404 (RLS, not a 403 — matches the established convention) ---
  let crossGuardianBlocked = false;
  try {
    await asActor(guardianBActor, () => manager.getInvoiceById(invoiceA.invoiceId));
  } catch (err) {
    crossGuardianBlocked = err instanceof NotFoundException;
  }
  assert(crossGuardianBlocked, "guardian B cannot read guardian A's invoice (RLS hides it -> 404)");

  // --- Outstanding fees, as admin, before any payment ---
  const outstandingBefore = await asActor(adminActor, () => manager.getOutstanding());
  const accountAOutstanding = outstandingBefore.find((o) => o.billingAccountId === invoiceA.billingAccountId);
  assert(
    accountAOutstanding?.outstandingCents === 150000,
    `v_outstanding_fees shows account A owing R1,500 before payment, got ${accountAOutstanding?.outstandingCents}`,
  );

  // --- Record a full payment, as admin ---
  const payment = await asActor(adminActor, () =>
    manager.recordPayment(invoiceA.billingAccountId, { amountCents: 150000, method: 'eft' }),
  );
  assert(payment.amountCents === 150000, 'payment recorded for the full invoice amount');

  const invoiceAfterPayment = await asActor(guardianAActor, () => manager.getInvoiceById(invoiceA.invoiceId));
  assert(
    invoiceAfterPayment.paymentState === 'paid',
    `invoice is paid after the full payment, got "${invoiceAfterPayment.paymentState}"`,
  );
  assert(invoiceAfterPayment.balanceCents === 0, 'invoice balance is zero after the full payment');

  // --- Statement of account, as the owning guardian ---
  const statement = await asActor(guardianAActor, () => manager.getStatement(invoiceA.billingAccountId));
  assert(
    statement.some((e) => e.entryType === 'invoice') && statement.some((e) => e.entryType === 'payment'),
    'account statement shows both the invoice and the payment',
  );

  // --- Credit note: cross-account guard, as admin ---
  let crossAccountCreditBlocked = false;
  try {
    await asActor(adminActor, () =>
      manager.issueCreditNote(
        invoiceA.billingAccountId,
        { invoiceId: invoiceB.invoiceId, amountCents: 100, reason: 'should be rejected' },
        adminActor,
      ),
    );
  } catch (err) {
    crossAccountCreditBlocked = err instanceof NotFoundException;
  }
  assert(crossAccountCreditBlocked, "issuing a credit note against account A citing account B's invoice is rejected (404)");

  // --- Credit note: oversettlement rejected (invoice A is already fully paid) ---
  const oversettlementError = await expectDbError(() =>
    asActor(adminActor, () =>
      manager.issueCreditNote(
        invoiceA.billingAccountId,
        { invoiceId: invoiceA.invoiceId, amountCents: 1000, reason: 'should be rejected, already settled' },
        adminActor,
      ),
    ),
  );
  assert(
    oversettlementError instanceof BusinessRuleException,
    'crediting an already-fully-paid invoice is rejected by the deferred oversettlement trigger (checked immediately, per `set constraints all immediate`)',
  );

  // --- Credit note: legitimate issue against invoice B, as admin ---
  const creditNote = await asActor(adminActor, () =>
    manager.issueCreditNote(
      invoiceB.billingAccountId,
      { invoiceId: invoiceB.invoiceId, amountCents: 50000, reason: 'Goodwill credit' },
      adminActor,
    ),
  );
  assert(creditNote.amountCents === 50000, 'credit note issued against invoice B');

  const invoiceBAfterCredit = await asActor(adminActor, () => manager.getInvoiceById(invoiceB.invoiceId));
  assert(
    invoiceBAfterCredit.balanceCents === invoiceB.totalCents - 50000,
    `invoice B's balance reflects the R500 credit, got ${invoiceBAfterCredit.balanceCents}`,
  );
  assert(invoiceBAfterCredit.paymentState === 'part_paid', 'invoice B is part_paid after a partial credit note');

  // --- Apply late fees: nothing overdue yet, must be a clean no-op ---
  const lateFees = await asActor(adminActor, () => manager.applyLateFees({ onDate: '2026-11-07' }));
  assert(lateFees.lateFeeCount === 0, `apply-late-fees is a no-op with nothing overdue, got ${lateFees.lateFeeCount}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
