import { Module } from '@nestjs/common';
import { FileStorageModule } from '../../common/file-storage/file-storage.module.js';
import { LearnerDocumentsController } from './learner-documents.controller.js';
import { LearnerDocumentsManager } from './learner-documents.manager.js';
import { LearnerDocumentsRepository } from './learner-documents.repository.js';

@Module({
  imports: [FileStorageModule],
  controllers: [LearnerDocumentsController],
  providers: [LearnerDocumentsManager, LearnerDocumentsRepository],
})
export class LearnerDocumentsModule {}
