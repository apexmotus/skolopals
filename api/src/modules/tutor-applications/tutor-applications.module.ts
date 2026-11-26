import { Module } from '@nestjs/common';
import { FileStorageModule } from '../../common/file-storage/file-storage.module.js';
import { TutorApplicationsController } from './tutor-applications.controller.js';
import { TutorApplicationsManager } from './tutor-applications.manager.js';
import { TutorApplicationsRepository } from './tutor-applications.repository.js';

@Module({
  imports: [FileStorageModule],
  controllers: [TutorApplicationsController],
  providers: [TutorApplicationsManager, TutorApplicationsRepository],
})
export class TutorApplicationsModule {}
