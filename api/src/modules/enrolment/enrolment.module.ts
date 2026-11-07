import { Module } from '@nestjs/common';
import { EnrolmentController } from './enrolment.controller';
import { EnrolmentManager } from './enrolment.manager';
import { EnrolmentRepository } from './enrolment.repository';

@Module({
  controllers: [EnrolmentController],
  providers: [EnrolmentManager, EnrolmentRepository],
})
export class EnrolmentModule {}
