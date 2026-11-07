import { Module } from '@nestjs/common';
import { ProgressReportController } from './progress-report.controller';
import { ProgressReportManager } from './progress-report.manager';
import { ProgressReportRepository } from './progress-report.repository';

@Module({
  controllers: [ProgressReportController],
  providers: [ProgressReportManager, ProgressReportRepository],
})
export class ProgressReportModule {}
