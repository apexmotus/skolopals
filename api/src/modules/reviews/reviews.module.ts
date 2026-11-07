import { Module } from '@nestjs/common';
import { CacheModule } from '../../common/cache/cache.module';
import { ReviewsController } from './reviews.controller';
import { ReviewsManager } from './reviews.manager';
import { ReviewsRepository } from './reviews.repository';

@Module({
  imports: [CacheModule],
  controllers: [ReviewsController],
  providers: [ReviewsManager, ReviewsRepository],
})
export class ReviewsModule {}
