import { Module } from '@nestjs/common';
import { FileStorageModule } from '../../common/file-storage/file-storage.module.js';
import { CronSecretGuard } from '../../common/guards/cron-secret.guard.js';
import { JobsController } from './jobs.controller.js';
import { JobsRepository } from './jobs.repository.js';

@Module({
  imports: [FileStorageModule],
  controllers: [JobsController],
  providers: [JobsRepository, CronSecretGuard],
})
export class JobsModule {}
