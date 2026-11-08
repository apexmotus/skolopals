import { Module } from '@nestjs/common';
import { EnrolmentController } from './enrolment.controller.js';
import { EnrolmentManager } from './enrolment.manager.js';
import { EnrolmentRepository } from './enrolment.repository.js';

@Module({
  controllers: [EnrolmentController],
  providers: [EnrolmentManager, EnrolmentRepository],
})
export class EnrolmentModule {}
