/**
 * Live verification for Phases B–E, same discipline as `aptitude-smoke.ts`:
 * the real Enrolment, Payments, LearnerDocuments and Jobs managers and
 * repositories against the local schema, through the real
 * `StoredProcRunner`/`UnitOfWork`/`applyRlsContext`, inside one transaction
 * that is always rolled back. Only file storage is faked (it records moves
 * and signs nothing), so the API ↔ SQL contract is what is under test:
 * parameter names, jsonb shapes, the private-schema calls and RLS.
 *
 * Usage: `DATABASE_URL=postgresql://$(whoami)@localhost:5432/skolopals_dev tsx scripts/applications-smoke.ts`
 */
import { randomUUID } from 'node:crypto';
import type { ClsService } from 'nestjs-cls';
import { Pool, type PoolClient } from 'pg';
import type { FileStorageService } from '../src/common/file-storage/file-storage.service.js';
import type { AppClsStore } from '../src/common/types/app-cls-store.js';
import type { AuthUser } from '../src/common/types/auth-user.js';
import '../src/database/database.providers.js';
import { applyRlsContext } from '../src/database/rls-context.js';
import { StoredProcRunner } from '../src/database/stored-proc.runner.js';
import { TransactionContext } from '../src/database/transaction.context.js';
import { UnitOfWork } from '../src/database/unit-of-work.js';
import { EnrolmentManager } from '../src/modules/enrolment/enrolment.manager.js';
import { EnrolmentRepository } from '../src/modules/enrolment/enrolment.repository.js';
import { JobsRepository } from '../src/modules/jobs/jobs.repository.js';
import { LearnerDocumentsManager } from '../src/modules/learner-documents/learner-documents.manager.js';
import { LearnerDocumentsRepository } from '../src/modules/learner-documents/learner-documents.repository.js';
import { PaymentsManager } from '../src/modules/payments/payments.manager.js';
import { PaymentsRepository } from '../src/modules/payments/payments.repository.js';

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
    console.log('\nAll applications smoke checks passed.');
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
  const uow = new UnitOfWork(pool, txCtx, cls);

  const moves: [string, string, string][] = [];
  const storage = {
    move: (bucket: string, from: string, to: string) => {
      moves.push([bucket, from, to]);
      return Promise.resolve();
    },
    createDownloadUrl: (bucket: string, path: string) => Promise.resolve(`https://signed.test/${bucket}/${path}`),
  } as unknown as FileStorageService;

  const enrolments = new EnrolmentManager(new EnrolmentRepository(sp), uow, storage);
  const payments = new PaymentsManager(new PaymentsRepository(sp), uow, storage);
  const documents = new LearnerDocumentsManager(new LearnerDocumentsRepository(sp), storage);
  const jobs = new JobsRepository(sp);

  async function as<T>(who: AuthUser | undefined, fn: () => Promise<T>): Promise<T> {
    currentActor = who;
    await applyRlsContext(client, cls);
    try {
      return await txCtx.run(client, fn);
    } finally {
      // After a failed statement the transaction is aborted until expectError's
      // rollback-to-savepoint, which also undoes the role switch; don't let this
      // cleanup replace the real error.
      await client.query('reset role').catch(() => undefined);
    }
  }

  async function expectError(fn: () => Promise<unknown>): Promise<unknown> {
    await client.query('savepoint sp');
    try {
      await fn();
      return undefined;
    } catch (err) {
      return err;
    } finally {
      await client.query('rollback to savepoint sp');
    }
  }

  const parentId = randomUUID();
  const adminId = randomUUID();
  const parent = actor(parentId, ['parent']);
  const admin = actor(adminId, ['admin']);
  await client.query(
    `insert into auth.users (id, email, raw_user_meta_data) values
      ($1, 'smoke-parent@test', '{"full_name":"Smoke Parent"}'), ($2, 'smoke-admin@test', '{"full_name":"Smoke Admin"}')`,
    [parentId, adminId],
  );
  await client.query(`insert into public.user_roles (user_id, role) values ($1, 'admin')`, [adminId]);
  await client.query(
    `insert into public.payment_settings (payshap_id, account_name, effective_from)
     select '0821234567', 'Skolopals', current_date
      where not exists (select 1 from public.payment_settings where effective_to is null)`,
  );
  const consents = (
    await client.query<{ code: string }>('select code from public.consent_types where is_required')
  ).rows.map((r) => ({ consentTypeCode: r.code, granted: true }));

  console.log('\n=== C: submit with a report card ===');
  const staging = `staging/${parentId}/${randomUUID()}.pdf`;
  const enrolment = await as(parent, () =>
    enrolments.submit(parent, {
      learner: { fullName: 'Smoke Learner', dateOfBirth: '2013-04-02', gradeCode: 'grade_7', relationship: 'mother' },
      packageCode: 'group_1',
      subjects: [{ subjectCode: 'mathematics', preferredLanguageCode: 'english' }],
      emergencyContacts: [{ fullName: 'Aunt', relationship: 'aunt', phone: '0820000000' }],
      consents,
      policyVersion: '1.0',
      reportCard: { path: staging, mimeType: 'application/pdf', sizeBytes: 1000, originalName: 'r.pdf', year: 2026, term: 3 },
    }),
  );
  assert(enrolment.status === 'pending', 'submit returns the pending enrolment');
  assert(
    moves.length === 1 && moves[0]?.[0] === 'learner-documents' && moves[0][1] === staging && moves[0][2].startsWith(`learners/${enrolment.learnerId}/`),
    'the report card is moved from staging to learners/<id>/ in the learner-documents bucket',
  );

  const progress = await as(parent, () => enrolments.progress(enrolment.id));
  assert(progress.stage === 'assessment', 'progress: assessment');

  const quote = await as(parent, () => enrolments.quote({ packageCode: 'group_1', on: '2026-11-21' }));
  assert(quote.totalCents === 30000 && quote.daysCharged === 10, 'quote for 21 Nov: R300, 10 days');

  const docId = (
    await client.query<{ id: string }>('select id from public.learner_documents where learner_id = $1', [enrolment.learnerId])
  ).rows[0]?.id ?? '';
  const link = await as(parent, () => documents.download(enrolment.learnerId, docId));
  assert(link.url.includes(`learners/${enrolment.learnerId}/`), 'the guardian gets a signed link to the report card');
  const wrongLearner = await expectError(() => as(parent, () => documents.download(randomUUID(), docId)));
  assert(wrongLearner instanceof Error && /Document not found/.test(wrongLearner.message), 'a document id under another learner\'s URL is refused');

  console.log('\n=== D: accept (after the test), decline needs a reason ===');
  const early = await expectError(() => as(admin, () => enrolments.accept(enrolment.id)));
  assert(early instanceof Error && /aptitude test/.test(early.message), 'accept is refused before the aptitude test is finished');
  await client.query(
    `insert into public.aptitude_attempts
       (learner_id, enrolment_id, bank_version, status, current_difficulty, completed_at, final_band, level_label, literacy_pct, logic_pct, low_confidence)
     select $1, $2, version, 'completed', 3, now(), 3, 'Developing', 60, 60, false from public.aptitude_banks where is_current`,
    [enrolment.learnerId, enrolment.id],
  );
  const accepted = await as(admin, () => enrolments.accept(enrolment.id));
  assert(accepted.amountDueCents > 0 && Boolean(accepted.invoiceId), `accept raises the offer invoice (${accepted.amountDueCents / 100} rand)`);
  assert((await as(parent, () => enrolments.progress(enrolment.id))).stage === 'payment', 'progress: payment');

  console.log('\n=== E: PayShap proof, verify, activation ===');
  const started = await as(parent, () => payments.start(accepted.invoiceId));
  assert(started.status === 'awaiting_proof' && !started.requoted, '"I have made the payment" opens a submission');
  const proofStaging = `staging/${parentId}/${randomUUID()}.jpg`;
  await as(parent, () =>
    payments.attachProof(started.submissionId, {
      path: proofStaging,
      mimeType: 'image/jpeg',
      claimedAmountCents: accepted.amountDueCents,
      payerReference: 'SMOKE',
    }),
  );
  const proofMove = moves.at(-1);
  assert(
    proofMove?.[0] === 'payment-proofs' && proofMove[1] === proofStaging && proofMove[2].includes(`/${started.submissionId}/`),
    'the proof is moved into payment-proofs under the submission',
  );
  assert((await as(parent, () => enrolments.progress(enrolment.id))).stage === 'verification', 'progress: verification');

  const proofLink = await as(admin, () => payments.proofLink(started.submissionId));
  assert(proofLink.url.includes('payment-proofs/'), 'the admin gets a signed link to the proof');

  const verified = await as(admin, () =>
    payments.verify(started.submissionId, { amountCents: accepted.amountDueCents }),
  );
  assert(verified.activated, 'verifying the full amount activates the enrolment');
  assert(Array.isArray(verified.placement?.placed) && Array.isArray(verified.placement.unplaced), 'placement result comes back');
  const after = await as(parent, () => enrolments.getById(enrolment.id));
  assert(after.status === 'active', 'the enrolment is active');

  const twice = await expectError(() => as(admin, () => payments.verify(started.submissionId, { amountCents: 100 })));
  assert(twice instanceof Error && /Already verified/.test(twice.message), 'a second verify is refused');

  console.log('\n=== D: the offer job runs without a user (cron) ===');
  const run = await as(undefined, () => jobs.processEnrolmentOffers());
  assert(typeof run.reminded === 'number' && typeof run.lapsed === 'number', 'the job runs as anon and reports its counts');
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
