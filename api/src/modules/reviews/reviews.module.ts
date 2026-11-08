import { Module } from '@nestjs/common';
import { CacheModule } from '../../common/cache/cache.module.js';
import { ReviewsController } from './reviews.controller.js';
import { ReviewsManager } from './reviews.manager.js';
import { ReviewsRepository } from './reviews.repository.js';

@Module({
  imports: [CacheModule],
  controllers: [ReviewsController],
  providers: [ReviewsManager, ReviewsRepository],
})
export class ReviewsModule {}
