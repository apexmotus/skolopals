import { Module } from '@nestjs/common';
import { FileStorageModule } from '../../common/file-storage/file-storage.module.js';
import { EnrolmentController } from './enrolment.controller.js';
import { EnrolmentManager } from './enrolment.manager.js';
import { EnrolmentRepository } from './enrolment.repository.js';

@Module({
  imports: [FileStorageModule],
  controllers: [EnrolmentController],
  providers: [EnrolmentManager, EnrolmentRepository],
})
export class EnrolmentModule {}
