import type { ReviewDto } from './dto/review.dto.js';
import type { ReviewRow } from './rows/review.row.js';

export class ReviewsMapper {
  static toDto(row: ReviewRow): ReviewDto {
    return {
      id: row.id,
      tutorId: row.tutor_id,
      guardianId: row.guardian_id,
      learnerId: row.learner_id ?? undefined,
      rating: row.rating,
      comment: row.comment,
      status: row.status,
      createdAt: row.created_at,
      publishedAt: row.published_at ?? undefined,
      moderatedBy: row.moderated_by ?? undefined,
    };
  }
}
