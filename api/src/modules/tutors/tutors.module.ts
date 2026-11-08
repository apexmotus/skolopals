import { Module } from '@nestjs/common';
import { CacheModule } from '../../common/cache/cache.module.js';
import { FileStorageModule } from '../../common/file-storage/file-storage.module.js';
import { TutorsController } from './tutors.controller.js';
import { TutorsManager } from './tutors.manager.js';
import { TutorsRepository } from './tutors.repository.js';

@Module({
  imports: [CacheModule, FileStorageModule],
  controllers: [TutorsController],
  providers: [TutorsManager, TutorsRepository],
})
export class TutorsModule {}
