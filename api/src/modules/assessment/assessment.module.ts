import { Module } from '@nestjs/common';
import { AssessmentController } from './assessment.controller.js';
import { AssessmentManager } from './assessment.manager.js';
import { AssessmentRepository } from './assessment.repository.js';

@Module({
  controllers: [AssessmentController],
  providers: [AssessmentManager, AssessmentRepository],
})
export class AssessmentModule {}
