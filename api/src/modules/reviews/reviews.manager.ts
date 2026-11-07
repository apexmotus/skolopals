import { Injectable, NotFoundException } from '@nestjs/common';
import { CacheService } from '../../common/cache/cache.service';
import type { AuthUser } from '../../common/types/auth-user';
import { ModerateReviewDto, ReviewDto, SubmitReviewDto } from './dto/review.dto';
import { reviewsCacheKeys, REVIEWS_CACHE_TTL_SECONDS } from './reviews-cache-keys';
import { ReviewsMapper } from './reviews.mapper';
import { ReviewsRepository } from './reviews.repository';

@Injectable()
export class ReviewsManager {
  constructor(
    private readonly repo: ReviewsRepository,
    private readonly cache: CacheService,
  ) {}

  async listPublished(tutorId: string): Promise<ReviewDto[]> {
    const cached = await this.cache.get<ReviewDto[]>(reviewsCacheKeys.listPublished(tutorId));
    if (cached) return cached;
    const dtos = (await this.repo.listPublished(tutorId)).map((row) => ReviewsMapper.toDto(row));
    await this.cache.set(reviewsCacheKeys.listPublished(tutorId), dtos, REVIEWS_CACHE_TTL_SECONDS);
    return dtos;
  }

  async listMine(actor: AuthUser): Promise<ReviewDto[]> {
    const rows = await this.repo.listMine(actor.id);
    return rows.map((row) => ReviewsMapper.toDto(row));
  }

  async submit(tutorId: string, actor: AuthUser, dto: SubmitReviewDto): Promise<ReviewDto> {
    const row = await this.repo.submit({
      tutorId,
      guardianId: actor.id,
      learnerId: dto.learnerId,
      rating: dto.rating,
      comment: dto.comment,
    });
    return ReviewsMapper.toDto(row);
  }

  async moderate(id: string, dto: ModerateReviewDto, actor: AuthUser): Promise<ReviewDto> {
    const row = await this.repo.moderate(id, dto.status, actor.id);
    if (!row) throw new NotFoundException('Review not found.');
    await this.cache.del(reviewsCacheKeys.listPublished(row.tutor_id));
    return ReviewsMapper.toDto(row);
  }
}
