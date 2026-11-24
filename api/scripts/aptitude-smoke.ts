/**
 * Live verification for the aptitude test, same discipline as
 * `billing-smoke.ts`: drives the real `AptitudeManager` → engine →
 * `AptitudeRepository` → `private.aptitude_*` functions against the local
 * schema, through the real `StoredProcRunner`/`UnitOfWork`/`applyRlsContext`,
 * inside one transaction that is always rolled back.
 *
 * Two children sit the whole test as their guardian: one answers everything
 * right, one everything wrong. The engine unit tests prove the choices; this
 * proves the choices survive the round trip through the database.
 *
 * Usage: `DATABASE_URL=postgresql://$(whoami)@localhost:5432/skolopals_dev tsx scripts/aptitude-smoke.ts`
 */
import { randomUUID } from 'node:crypto';
import type { ClsService } from 'nestjs-cls';
import { Pool, type PoolClient } from 'pg';
import type { AppClsStore } from '../src/common/types/app-cls-store.js';
import type { AuthUser } from '../src/common/types/auth-user.js';
import '../src/database/database.providers.js';
import { applyRlsContext } from '../src/database/rls-context.js';
import { StoredProcRunner } from '../src/database/stored-proc.runner.js';
import { TransactionContext } from '../src/database/transaction.context.js';
import { UnitOfWork } from '../src/database/unit-of-work.js';
import { AptitudeManager } from '../src/modules/aptitude/aptitude.manager.js';
import { AptitudeRepository } from '../src/modules/aptitude/aptitude.repository.js';
import type { AptitudeResultDto } from '../src/modules/aptitude/dto/aptitude.dto.js';

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
    await runChecks(pool, client);
    console.log('\nAll aptitude smoke checks passed.');
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
  const manager = new AptitudeManager(new AptitudeRepository(sp), new UnitOfWork(pool, txCtx, cls));

  async function asActor<T>(who: AuthUser, fn: () => Promise<T>): Promise<T> {
    currentActor = who;
    await applyRlsContext(client, cls);
    try {
      return await txCtx.run(client, fn);
    } finally {
      // An aborted transaction rejects this until the savepoint rollback; keep the real error.
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

  const guardianId = randomUUID();
  const adminId = randomUUID();
  const parent = actor(guardianId, ['parent']);
  const admin = actor(adminId, ['admin']);

  await client.query(
    `insert into auth.users (id, email, raw_user_meta_data) values
      ($1, 'aptitude-parent@test', '{}'), ($2, 'aptitude-admin@test', '{}')`,
    [guardianId, adminId],
  );
  await client.query(`insert into public.user_roles (user_id, role) values ($1, 'admin')`, [adminId]);

  async function application(name: string, grade: string): Promise<string> {
    const learnerId = randomUUID();
    const enrolmentId = randomUUID();
    await client.query(
      `insert into public.learners (id, full_name, date_of_birth, grade_code) values ($1, $2, '2012-01-01', $3)`,
      [learnerId, name, grade],
    );
    await client.query(
      `insert into public.learner_guardians (learner_id, guardian_id, relationship, is_primary, is_billing_contact)
       values ($1, $2, 'mother', true, true)`,
      [learnerId, guardianId],
    );
    await client.query(
      `insert into public.enrolments (id, learner_id, package_code) values ($1, $2, 'group_1')`,
      [enrolmentId, learnerId],
    );
    return enrolmentId;
  }

  // The key, read as the owner: the simulated child's "knowledge".
  const key = new Map(
    (
      await client.query<{ id: string; answer_id: string; wrong_id: string }>(
        `select i.id, i.answer_id,
                (select o ->> 'id' from jsonb_array_elements(i.options) o where o ->> 'id' <> i.answer_id limit 1) as wrong_id
           from public.aptitude_items i join public.aptitude_banks b on b.version = i.bank_version
          where b.is_current`,
      )
    ).rows.map((r) => [r.id, r]),
  );

  async function sit(enrolmentId: string, right: boolean): Promise<string> {
    const { attemptId } = await asActor(parent, () => manager.start(enrolmentId));
    let step = await asActor(parent, () => manager.next(attemptId));
    let answered = 0;
    while (!step.done) {
      const q = step.question;
      if (!q) throw new Error('no question and not done');
      if (JSON.stringify(q).includes('answer')) throw new Error('a question leaked its answer');
      const k = key.get(q.itemId);
      if (!k) throw new Error(`unknown item ${q.itemId}`);
      step = await asActor(parent, () =>
        manager.answer(attemptId, { itemId: q.itemId, optionId: right ? k.answer_id : k.wrong_id, msTaken: 2000 }),
      );
      answered += 1;
      if (answered > 30) throw new Error('the test never finished');
    }
    assert(answered === 25, `${right ? 'always-right' : 'always-wrong'} child answered exactly 25 questions`);
    return attemptId;
  }

  console.log('\n=== an always-right Grade 11 learner ===');
  const strong = await application('Strong Learner', 'grade_11');
  const strongAttempt = await sit(strong, true);

  const pendingResult = await expectError(() => asActor(parent, () => manager.result(strongAttempt)));
  assert(
    pendingResult instanceof Error && /not found/.test(pendingResult.message),
    'the guardian cannot see the result while the application is pending',
  );

  const strongResult: AptitudeResultDto = await asActor(admin, () => manager.result(strongAttempt));
  const breakdown = strongResult.breakdown ?? [];
  assert(strongResult.levelLabel === 'Extending' && strongResult.finalBand === 5, 'lands on Extending, band 5');
  assert(strongResult.literacyPct === 100 && strongResult.logicPct === 100, 'scores 100% in both sections');
  assert(strongResult.lowConfidence === false, 'is not flagged low confidence');
  assert(breakdown.filter((b) => b.section === 'literacy').length === 12, 'was served 12 reading questions');
  assert(breakdown.filter((b) => b.section === 'logic').length === 13, 'was served 13 logic questions');
  assert(new Set(breakdown.map((b) => b.itemId)).size === 25, 'never saw the same question twice');
  assert(breakdown.at(-1)?.difficulty === 5, 'was being tested at the top level by the end');

  const again = await asActor(parent, () => manager.next(strongAttempt));
  assert(again.done, 'asking for the next question after finishing just says done');

  console.log('\n=== an always-wrong Grade 10 learner ===');
  const weak = await application('Weak Learner', 'grade_10');
  const weakAttempt = await sit(weak, false);
  const weakResult = await asActor(admin, () => manager.result(weakAttempt));
  assert(weakResult.levelLabel === 'Emerging' && weakResult.finalBand === 1, 'lands on Emerging, band 1');
  assert(weakResult.lowConfidence === true, 'is flagged low confidence (band 1 for a Grade 10 learner)');

  console.log('\n=== resuming and stale answers ===');
  const third = await application('Third Learner', 'grade_5');
  const { attemptId } = await asActor(parent, () => manager.start(third));
  const first = await asActor(parent, () => manager.next(attemptId));
  const reload = await asActor(parent, () => manager.next(attemptId));
  assert(
    first.question?.itemId === reload.question?.itemId && reload.question?.seq === 1,
    'reloading shows the same waiting question instead of serving another',
  );
  const stale = await expectError(() =>
    asActor(parent, () => manager.answer(attemptId, { itemId: 'LOG-IFT-05', optionId: 'A', msTaken: 10 })),
  );
  assert(
    stale instanceof Error && /already been answered/.test(stale.message),
    'answering a question that is not the waiting one is refused',
  );
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
