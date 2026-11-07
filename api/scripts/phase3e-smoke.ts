/**
 * One-off live verification for Phase 3e (consent, enquiries, communication,
 * resources, reviews), same discipline as `billing-smoke.ts`: drives the
 * real Manager/Repository classes against the real local Postgres schema,
 * through the real `StoredProcRunner`/`UnitOfWork`/`applyRlsContext` code,
 * inside one transaction that is always rolled back.
 *
 * Usage: `DATABASE_URL=postgresql://$(whoami)@localhost:5432/skolopals_dev tsx scripts/phase3e-smoke.ts`
 */
import { NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { ClsService } from 'nestjs-cls';
import { Pool, type PoolClient } from 'pg';
import type { AppClsStore } from '../src/common/types/app-cls-store';
import type { AuthUser } from '../src/common/types/auth-user';
// Side-effecting import: registers the global `date` type parser the real
// app gets for free through `DatabaseModule`'s bootstrap — see
// `database.providers.ts`'s own doc comment and `billing-smoke.ts`'s note
// on why a standalone script needs this explicitly.
import '../src/database/database.providers';
import { applyRlsContext } from '../src/database/rls-context';
import { StoredProcRunner } from '../src/database/stored-proc.runner';
import { TransactionContext } from '../src/database/transaction.context';
import { UnitOfWork } from '../src/database/unit-of-work';
import { CommunicationManager } from '../src/modules/communication/communication.manager';
import { CommunicationRepository } from '../src/modules/communication/communication.repository';
import { ConsentManager } from '../src/modules/consent/consent.manager';
import { ConsentRepository } from '../src/modules/consent/consent.repository';
import { EnquiriesManager } from '../src/modules/enquiries/enquiries.manager';
import { EnquiriesRepository } from '../src/modules/enquiries/enquiries.repository';
import { ResourcesManager } from '../src/modules/resources/resources.manager';
import { ResourcesRepository } from '../src/modules/resources/resources.repository';
import { ReviewsRepository } from '../src/modules/reviews/reviews.repository';

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
    console.log('\nAll Phase 3e smoke checks passed.');
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

  async function asActor<T>(who: AuthUser | undefined, fn: () => Promise<T>): Promise<T> {
    currentActor = who;
    await applyRlsContext(client, cls);
    const result = await txCtx.run(client, fn);
    await client.query('reset role');
    return result;
  }

  async function asAnon<T>(fn: () => Promise<T>): Promise<T> {
    return asActor(undefined, fn);
  }

  const guardianA = randomUUID(); // mother, guardian A
  const guardianB = randomUUID(); // father, guardian A — co-guardian of the SAME learner
  const otherGuardian = randomUUID(); // unrelated family
  const adminId = randomUUID();
  const tutorProfileId = randomUUID();
  const learnerA = randomUUID();

  const adminActor = actor(adminId, ['admin']);
  const guardianAActor = actor(guardianA, ['parent']);
  const guardianBActor = actor(guardianB, ['parent']);
  const otherGuardianActor = actor(otherGuardian, ['parent']);
  const tutorActor = actor(tutorProfileId, ['tutor']);

  // --- Fixtures ---
  await client.query(
    `insert into auth.users (id, email, raw_user_meta_data) values
      ($1, 'spike-guardian-a@test', '{}'), ($2, 'spike-guardian-b@test', '{}'),
      ($3, 'spike-other-guardian@test', '{}'), ($4, 'spike-admin@test', '{}'),
      ($5, 'spike-tutor@test', '{}')`,
    [guardianA, guardianB, otherGuardian, adminId, tutorProfileId],
  );
  await client.query(
    `insert into public.user_roles (user_id, role) values ($1, 'admin'), ($2, 'tutor')`,
    [adminId, tutorProfileId],
  );
  await client.query(
    `insert into public.learners (id, full_name, date_of_birth, grade_code, status) values
      ($1, 'Learner A', '2014-03-01', 'grade_8', 'active')`,
    [learnerA],
  );
  // Two guardians of the SAME learner — the exact scenario the consent RLS fix targets.
  await client.query(
    `insert into public.learner_guardians (learner_id, guardian_id, relationship, is_primary, is_billing_contact) values
      ($1, $2, 'mother', true, true), ($1, $3, 'father', false, false)`,
    [learnerA, guardianA, guardianB],
  );
  await client.query(
    `insert into public.tutors (id, profile_id, slug, headline, employment_type, started_on) values
      (gen_random_uuid(), $1, 'spike-tutor', 'Maths specialist', 'sessional', current_date)`,
    [tutorProfileId],
  );
  const tutorRow = await client.query<{ id: string }>(
    'select id from public.tutors where profile_id = $1',
    [tutorProfileId],
  );
  const tutorId = tutorRow.rows[0]?.id;
  if (!tutorId) throw new Error('tutor fixture insert did not produce a row');

  // =========================================================================
  // consent — the RLS fix: guardian B (co-guardian, did not grant) can now
  // read guardian A's consent for their shared child; an unrelated guardian
  // still cannot.
  // =========================================================================
  const consentRepo = new ConsentRepository(sp);
  const consentManager = new ConsentManager(consentRepo);

  await client.query(
    `insert into public.consents (consent_type_code, guardian_id, learner_id, granted, policy_version)
     values ('enrolment_s35', $1, $2, true, 'v1')`,
    [guardianA, learnerA],
  );

  const consentsForB = await asActor(guardianBActor, () => consentManager.list(learnerA));
  assert(
    consentsForB.length === 1,
    'co-guardian B (did not grant) can read the consent guardian A granted for their shared child',
  );

  let otherGuardianBlocked = false;
  try {
    await asActor(otherGuardianActor, () => consentManager.list(learnerA));
  } catch (err) {
    otherGuardianBlocked = err instanceof NotFoundException;
  }
  assert(otherGuardianBlocked, 'an unrelated guardian cannot read this learner\'s consents (404)');

  let wrongGuardianWithdrawBlocked = false;
  try {
    await asActor(guardianBActor, () => consentManager.withdraw(learnerA, 'enrolment_s35', guardianBActor));
  } catch (err) {
    wrongGuardianWithdrawBlocked = err instanceof NotFoundException;
  }
  assert(
    wrongGuardianWithdrawBlocked,
    'guardian B cannot withdraw a consent guardian A granted ("Guardian-who-granted", narrower than "Guardian-of")',
  );

  const withdrawn = await asActor(guardianAActor, () =>
    consentManager.withdraw(learnerA, 'enrolment_s35', guardianAActor),
  );
  assert(withdrawn.withdrawnAt !== undefined, 'the granting guardian can withdraw their own consent');

  // =========================================================================
  // enquiries — public submit, admin list/updateStatus/convert
  // =========================================================================
  const enquiriesRepo = new EnquiriesRepository(sp);
  const enquiriesManager = new EnquiriesManager(enquiriesRepo);

  const enquiry = await asAnon(() =>
    enquiriesManager.submit({ fullName: 'Prospective Parent', message: 'Tell me about pricing' }),
  );
  assert(enquiry.status === 'new', 'a freshly submitted enquiry is status=new with no handler');

  const listed = await asActor(adminActor, () => enquiriesManager.list());
  assert(listed.some((e) => e.id === enquiry.id), 'admin can list the submitted enquiry');

  const contacted = await asActor(adminActor, () =>
    enquiriesManager.updateStatus(enquiry.id, { status: 'contacted' }, adminActor),
  );
  assert(contacted.handledBy === adminId, 'updateStatus records the acting admin');

  const converted = await asActor(adminActor, () =>
    enquiriesManager.convert(enquiry.id, { learnerId: learnerA }, adminActor),
  );
  assert(
    converted.status === 'enrolled' && converted.convertedLearnerId === learnerA,
    'convert links the enquiry to the resulting learner',
  );

  // =========================================================================
  // communication — start_thread/mark_thread_read (real functions), plain
  // message post, participant add, notification fan-out (both shapes)
  // =========================================================================
  const commsRepo = new CommunicationRepository(sp);
  const commsManager = new CommunicationManager(commsRepo);

  const thread = await asActor(guardianAActor, () =>
    commsManager.startThread({
      subject: 'Question about homework',
      body: 'Can my daughter get extra worksheets?',
      participantIds: [tutorProfileId],
      learnerId: learnerA,
    }),
  );
  assert(thread.unreadCount === 0, "the thread creator's own first message is not unread to themselves");

  const tutorThreads = await asActor(tutorActor, () => commsManager.listMyThreads());
  const tutorView = tutorThreads.find((t) => t.id === thread.id);
  assert(tutorView?.unreadCount === 1, 'the added participant (tutor) sees 1 unread message');

  let outsiderBlocked = false;
  try {
    await asActor(otherGuardianActor, () => commsManager.listMessages(thread.id));
  } catch (err) {
    outsiderBlocked = err instanceof NotFoundException;
  }
  assert(outsiderBlocked, 'a non-participant, non-admin cannot read the thread (404)');

  await asActor(tutorActor, () =>
    commsManager.postMessage(thread.id, tutorActor, { body: 'Yes, I will prepare some.' }),
  );
  const markResult = await asActor(guardianAActor, () => commsManager.markThreadRead(thread.id));
  assert(markResult.markedCount === 1, "marking the thread read counts exactly the tutor's one reply");

  const participant = await asActor(adminActor, () =>
    commsManager.addParticipant(thread.id, { profileId: adminId }),
  );
  assert(participant.profileId === adminId, 'admin can add themselves as a participant');

  await asActor(adminActor, () => commsManager.createNotification(adminActor, { title: 'Broadcast', broadcast: true }));
  const guardianANotifications = await asActor(guardianAActor, () => commsManager.listMyNotifications(guardianAActor));
  assert(
    guardianANotifications.some((n) => n.title === 'Broadcast'),
    'a broadcast notification fans out to every profile, including guardian A',
  );

  await asActor(adminActor, () =>
    commsManager.createNotification(adminActor, { title: 'Targeted', recipientIds: [guardianA] }),
  );
  const guardianBNotifications = await asActor(guardianBActor, () => commsManager.listMyNotifications(guardianBActor));
  assert(
    !guardianBNotifications.some((n) => n.title === 'Targeted'),
    'a targeted notification to guardian A does not reach guardian B',
  );

  const targetedForA = await asActor(guardianAActor, () => commsManager.listMyNotifications(guardianAActor));
  const targetedNotif = targetedForA.find((n) => n.title === 'Targeted');
  assert(targetedNotif !== undefined && targetedNotif.readAt === undefined, 'the targeted notification starts unread');
  const readResult = await asActor(guardianAActor, () =>
    commsManager.markNotificationRead(targetedNotif!.id, guardianAActor),
  );
  assert(readResult.readAt !== undefined, 'marking a notification read sets readAt');

  // =========================================================================
  // resources — create with its one audience, four-way visibility (all,
  // learner, grade), owner-scoped removeAudience
  // =========================================================================
  const resourcesRepo = new ResourcesRepository(sp);
  const resourcesManager = new ResourcesManager(resourcesRepo, uow);

  const allResource = await asActor(tutorActor, () =>
    resourcesManager.create(tutorActor, { title: 'Everyone worksheet', audienceType: 'all' }),
  );
  const learnerResource = await asActor(tutorActor, () =>
    resourcesManager.create(tutorActor, {
      title: 'Just for Learner A',
      audienceType: 'learner',
      learnerId: learnerA,
    }),
  );
  const gradeResource = await asActor(tutorActor, () =>
    resourcesManager.create(tutorActor, { title: 'Grade 8 pack', audienceType: 'grade', gradeCode: 'grade_8' }),
  );

  const visibleToGuardianA = await asActor(guardianAActor, () => resourcesManager.listForActor());
  const visibleIds = new Set(visibleToGuardianA.map((r) => r.id));
  assert(visibleIds.has(allResource.id), 'guardian A sees the "all" resource');
  assert(visibleIds.has(learnerResource.id), 'guardian A sees the "learner"-targeted resource for their own child');
  assert(visibleIds.has(gradeResource.id), "guardian A sees the \"grade\"-targeted resource matching their child's grade");

  const visibleToOtherGuardian = await asActor(otherGuardianActor, () => resourcesManager.listForActor());
  const otherVisibleIds = new Set(visibleToOtherGuardian.map((r) => r.id));
  assert(otherVisibleIds.has(allResource.id), 'an unrelated guardian still sees the "all" resource');
  assert(
    !otherVisibleIds.has(learnerResource.id),
    "an unrelated guardian (no child in grade_8, not Learner A's guardian) does not see the learner-targeted resource",
  );

  const audienceId = learnerResource.audiences[0]?.id;
  if (!audienceId) throw new Error('learnerResource fixture has no audience row');
  let wrongTutorRemoveBlocked = false;
  try {
    await asActor(otherGuardianActor, () => resourcesManager.removeAudience(learnerResource.id, audienceId));
  } catch (err) {
    wrongTutorRemoveBlocked = err instanceof NotFoundException;
  }
  assert(wrongTutorRemoveBlocked, 'a non-owner, non-admin cannot remove a resource audience (RLS hides it -> 404)');
  await asActor(tutorActor, () => resourcesManager.removeAudience(learnerResource.id, audienceId));
  console.log('  PASS  the owning tutor can remove their own resource audience');

  // =========================================================================
  // reviews — submit forced to pending, moderate publishes, public can read
  // =========================================================================
  const reviewsRepo = new ReviewsRepository(sp);

  const review = await asActor(guardianAActor, () =>
    reviewsRepo.submit({ tutorId, guardianId: guardianA, learnerId: learnerA, rating: 5, comment: 'Excellent!' }),
  );
  assert(review.status === 'pending', 'a freshly submitted review is pending, never auto-published');

  const publicBeforeModeration = await asAnon(() => reviewsRepo.listPublished(tutorId));
  assert(
    !publicBeforeModeration.some((r) => r.id === review.id),
    'the public cannot see a pending review',
  );

  const moderated = await asActor(adminActor, () => reviewsRepo.moderate(review.id, 'published', adminId));
  assert(moderated?.published_at !== null, 'moderate(published) stamps publishedAt');

  const publicAfterModeration = await asAnon(() => reviewsRepo.listPublished(tutorId));
  assert(
    publicAfterModeration.some((r) => r.id === review.id),
    'the public can now see the published review',
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
