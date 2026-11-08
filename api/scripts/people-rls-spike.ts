/**
 * Phase 3a's explicit instruction (07-phase3a-reference-people-tutors.md task
 * 2): prove `private.can_view_learner`/`private.can_view_learner_private`
 * actually restrict results through this API's direct-Postgres connection
 * *before* writing anything else in the `people` module — these are the
 * policies every later phase's actor-scoped endpoint leans on.
 *
 * Proves, through the real `applyRlsContext` code:
 * - A guardian can view (both tiers) their own child, never another
 *   family's.
 * - A tutor who teaches a learner can view them (academic tier) but is
 *   denied the private tier (POPIA boundary — "a bug here is a compliance
 *   incident, not just a logic error") even though they teach the learner.
 * - An admin can view both tiers for anyone.
 *
 * Everything inserted lives inside one rolled-back transaction; it leaves
 * no trace in the database either way. Usage: same as rls-spike.ts.
 */
import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import type { ClsService } from 'nestjs-cls';
import { applyRlsContext } from '../src/database/rls-context.js';
import type { AppClsStore } from '../src/common/types/app-cls-store.js';
import type { AuthUser } from '../src/common/types/auth-user.js';

function clsFor(actor: AuthUser | undefined): ClsService<AppClsStore> {
  return { get: () => actor } as unknown as ClsService<AppClsStore>;
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`FAILED: ${message}`);
  console.log(`  PASS  ${message}`);
}

function actor(id: string): AuthUser {
  return { id, roles: [], claims: { sub: id, role: 'authenticated' } };
}

async function canView(
  client: PoolClient,
  who: AuthUser | undefined,
  learnerId: string,
): Promise<{ academic: boolean; private_: boolean }> {
  await applyRlsContext(client, clsFor(who));
  const academic = await client.query<{ allowed: boolean }>(
    'select private.can_view_learner($1) as allowed',
    [learnerId],
  );
  const private_ = await client.query<{ allowed: boolean }>(
    'select private.can_view_learner_private($1) as allowed',
    [learnerId],
  );
  await client.query('RESET ROLE');
  return {
    academic: academic.rows[0]?.allowed ?? false,
    private_: private_.rows[0]?.allowed ?? false,
  };
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl)
    throw new Error(
      'Set DATABASE_URL to a local skolopals_dev connection string.',
    );

  const pool = new Pool({ connectionString: databaseUrl });
  const client = await pool.connect();

  const guardianA = randomUUID();
  const guardianB = randomUUID();
  const tutorProfile = randomUUID();
  const adminId = randomUUID();
  const learnerA = randomUUID();
  const learnerB = randomUUID();
  const tutorId = randomUUID();

  try {
    await client.query('BEGIN');

    await client.query(
      `insert into auth.users (id, email, raw_user_meta_data) values
        ($1, 'spike-guardian-a@test', '{}'), ($2, 'spike-guardian-b@test', '{}'),
        ($3, 'spike-tutor@test', '{}'), ($4, 'spike-admin@test', '{}')`,
      [guardianA, guardianB, tutorProfile, adminId],
    );
    await client.query(
      `insert into public.user_roles (user_id, role) values ($1, 'tutor'), ($2, 'admin')`,
      [tutorProfile, adminId],
    );
    await client.query(
      `insert into public.tutors (id, profile_id, slug, employment_type) values ($1, $2, 'spike-tutor', 'sessional')`,
      [tutorId, tutorProfile],
    );

    await client.query(
      `insert into public.learners (id, full_name, date_of_birth, grade_code, status) values
        ($1, 'Learner A', '2013-04-02', 'grade_7', 'active'),
        ($2, 'Learner B', '2013-05-02', 'grade_7', 'active')`,
      [learnerA, learnerB],
    );
    await client.query(
      `insert into public.learner_guardians (learner_id, guardian_id, relationship, is_primary, is_billing_contact) values
        ($1, $2, 'mother', true, true), ($3, $4, 'mother', true, true)`,
      [learnerA, guardianA, learnerB, guardianB],
    );

    const term = await client.query<{ id: string }>(
      `insert into public.terms (year, term_number, starts_on, ends_on) values (2099, 1, '2099-01-12', '2099-03-20') returning id`,
    );
    const termId = term.rows[0]?.id;
    const enrolment = await client.query<{ id: string }>(
      `insert into public.enrolments (learner_id, package_code, status) values ($1, 'group_1', 'pending') returning id`,
      [learnerA],
    );
    const enrolmentId = enrolment.rows[0]?.id;
    const classGroup = await client.query<{ id: string }>(
      `insert into public.class_groups (name, subject_code, language_code, tutor_id, term_id, delivery_mode, capacity)
       values ('Spike Class', 'mathematics', 'english', $1, $2, 'online', 5) returning id`,
      [tutorId, termId],
    );
    const classGroupId = classGroup.rows[0]?.id;
    // Only learner A sits in the tutor's class — learner B is never taught by this tutor.
    await client.query(
      `insert into public.class_enrolments (class_group_id, learner_id, enrolment_id) values ($1, $2, $3)`,
      [classGroupId, learnerA, enrolmentId],
    );

    console.log(
      "=== Guardian A: sees their own child on both tiers, never B's ===",
    );
    const asGuardianA_onA = await canView(client, actor(guardianA), learnerA);
    assert(
      asGuardianA_onA.academic && asGuardianA_onA.private_,
      'guardian A sees learner A on both tiers',
    );
    const asGuardianA_onB = await canView(client, actor(guardianA), learnerB);
    assert(
      !asGuardianA_onB.academic && !asGuardianA_onB.private_,
      'guardian A is denied learner B on both tiers',
    );

    console.log(
      '\n=== Tutor (teaches A, not B): academic yes, private tier denied — the POPIA boundary ===',
    );
    const asTutor_onA = await canView(client, actor(tutorProfile), learnerA);
    assert(
      asTutor_onA.academic,
      'tutor who teaches learner A sees them on the academic tier',
    );
    assert(
      !asTutor_onA.private_,
      'tutor is DENIED the private tier for learner A even though they teach them',
    );
    const asTutor_onB = await canView(client, actor(tutorProfile), learnerB);
    assert(
      !asTutor_onB.academic && !asTutor_onB.private_,
      'tutor who does not teach learner B is denied both tiers',
    );

    console.log('\n=== Admin: sees everyone, both tiers ===');
    const asAdmin_onA = await canView(client, actor(adminId), learnerA);
    const asAdmin_onB = await canView(client, actor(adminId), learnerB);
    assert(
      asAdmin_onA.academic && asAdmin_onA.private_,
      'admin sees learner A on both tiers',
    );
    assert(
      asAdmin_onB.academic && asAdmin_onB.private_,
      'admin sees learner B on both tiers',
    );

    console.log('\n=== Anon: denied everything ===');
    const asAnon = await canView(client, undefined, learnerA);
    assert(
      !asAnon.academic && !asAnon.private_,
      'an anonymous visitor is denied both tiers',
    );

    console.log('\nAll people RLS spike assertions passed.');
  } finally {
    await client.query('ROLLBACK');
    client.release();
    await pool.end();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
