import { Module } from '@nestjs/common';
import { CacheModule } from '../../common/cache/cache.module';
import { FileStorageModule } from '../../common/file-storage/file-storage.module';
import { TutorsController } from './tutors.controller';
import { TutorsManager } from './tutors.manager';
import { TutorsRepository } from './tutors.repository';

@Module({
  imports: [CacheModule, FileStorageModule],
  controllers: [TutorsController],
  providers: [TutorsManager, TutorsRepository],
})
export class TutorsModule {}
