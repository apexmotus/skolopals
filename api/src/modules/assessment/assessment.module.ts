import { Module } from '@nestjs/common';
import { AssessmentController } from './assessment.controller';
import { AssessmentManager } from './assessment.manager';
import { AssessmentRepository } from './assessment.repository';

@Module({
  controllers: [AssessmentController],
  providers: [AssessmentManager, AssessmentRepository],
})
export class AssessmentModule {}
