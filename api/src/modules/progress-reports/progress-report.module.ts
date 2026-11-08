import { Module } from '@nestjs/common';
import { ProgressReportController } from './progress-report.controller.js';
import { ProgressReportManager } from './progress-report.manager.js';
import { ProgressReportRepository } from './progress-report.repository.js';

@Module({
  controllers: [ProgressReportController],
  providers: [ProgressReportManager, ProgressReportRepository],
})
export class ProgressReportModule {}
