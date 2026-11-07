import { Injectable } from '@nestjs/common';
import { StoredProcRunner } from '../../database/stored-proc.runner';
import type { ReviewRow } from './rows/review.row';

const REVIEW_COLUMNS =
  'id, tutor_id, guardian_id, learner_id, rating, comment, status, created_at, published_at, moderated_by';

/**
 * Plain table reads/writes (confirmed by grep — no dedicated function).
 * `submit`'s INSERT omits `status` entirely rather than passing `'pending'`
 * explicitly: the table's own default is already `'pending'`, which is
 * exactly what the RLS INSERT policy's `WITH CHECK` requires — same
 * reasoning as `enquiries`' submit. `tutor_rating_summary` (a derived view,
 * never a stored column) is read by the `tutors` module's `getRating`,
 * already built in Phase 3a — this module never duplicates that read or
 * writes anything resembling a `rating`/`review_count` column.
 */
@Injectable()
export class ReviewsRepository {
  constructor(private readonly sp: StoredProcRunner) {}

  listPublished(tutorId: string): Promise<ReviewRow[]> {
    return this.sp.selectMany<ReviewRow>(
      `select ${REVIEW_COLUMNS} from public.reviews where tutor_id = $1 and status = 'published' order by created_at desc`,
      [tutorId],
    );
  }

  listMine(guardianId: string): Promise<ReviewRow[]> {
    return this.sp.selectMany<ReviewRow>(
      `select ${REVIEW_COLUMNS} from public.reviews where guardian_id = $1 order by created_at desc`,
      [guardianId],
    );
  }

  async submit(input: {
    tutorId: string;
    guardianId: string;
    learnerId?: string;
    rating: number;
    comment?: string;
  }): Promise<ReviewRow> {
    const result = await this.sp.executeRaw<ReviewRow>(
      `insert into public.reviews (tutor_id, guardian_id, learner_id, rating, comment)
       values ($1, $2, $3, $4, coalesce($5, ''))
       returning ${REVIEW_COLUMNS}`,
      [input.tutorId, input.guardianId, input.learnerId ?? null, input.rating, input.comment ?? null],
    );
    const row = result.rows[0];
    if (!row) throw new Error('INSERT ... RETURNING unexpectedly returned no row');
    return row;
  }

  /** `publishedAt` is set once, the first time a review is published, and never cleared or overwritten by a later re-moderation. */
  async moderate(
    id: string,
    status: string,
    moderatedBy: string,
  ): Promise<ReviewRow | undefined> {
    const result = await this.sp.executeRaw<ReviewRow>(
      `update public.reviews
       set status = $2, moderated_by = $3,
           published_at = case when $2 = 'published' then coalesce(published_at, now()) else published_at end
       where id = $1
       returning ${REVIEW_COLUMNS}`,
      [id, status, moderatedBy],
    );
    return result.rows[0];
  }
}
