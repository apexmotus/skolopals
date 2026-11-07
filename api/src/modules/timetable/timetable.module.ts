import { Module } from '@nestjs/common';
import { CacheModule } from '../../common/cache/cache.module';
import { TimetableController } from './timetable.controller';
import { TimetableManager } from './timetable.manager';
import { TimetableRepository } from './timetable.repository';

@Module({
  imports: [CacheModule],
  controllers: [TimetableController],
  providers: [TimetableManager, TimetableRepository],
  exports: [TimetableManager],
})
export class TimetableModule {}
