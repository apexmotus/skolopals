import { Module } from '@nestjs/common';
import { CacheModule } from '../../common/cache/cache.module.js';
import { TimetableController } from './timetable.controller.js';
import { TimetableManager } from './timetable.manager.js';
import { TimetableRepository } from './timetable.repository.js';

@Module({
  imports: [CacheModule],
  controllers: [TimetableController],
  providers: [TimetableManager, TimetableRepository],
  exports: [TimetableManager],
})
export class TimetableModule {}
