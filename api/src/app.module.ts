import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import type { EnvConfig } from './config/env.schema.js';
import { AppConfigModule } from './config/config.module.js';
import { AssessmentModule } from './modules/assessment/assessment.module.js';
import { AttendanceModule } from './modules/attendance/attendance.module.js';
import { BillingModule } from './modules/billing/billing.module.js';
import { CommonModule } from './common/common.module.js';
import { CommunicationModule } from './modules/communication/communication.module.js';
import { ConsentModule } from './modules/consent/consent.module.js';
import { DatabaseModule } from './database/database.module.js';
import { EnquiriesModule } from './modules/enquiries/enquiries.module.js';
import { EnrolmentModule } from './modules/enrolment/enrolment.module.js';
import { FinanceModule } from './modules/finance/finance.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { PackagesModule } from './modules/packages/packages.module.js';
import { PeopleModule } from './modules/people/people.module.js';
import { ProgrammesModule } from './modules/programmes/programmes.module.js';
import { ProgressReportModule } from './modules/progress-reports/progress-report.module.js';
import { ReferenceModule } from './modules/reference/reference.module.js';
import { ResourcesModule } from './modules/resources/resources.module.js';
import { ReviewsModule } from './modules/reviews/reviews.module.js';
import { TimetableModule } from './modules/timetable/timetable.module.js';
import { TutorsModule } from './modules/tutors/tutors.module.js';

@Module({
  imports: [
    AppConfigModule,
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvConfig, true>) => ({
        pinoHttp: {
          level: config.getOrThrow('LOG_LEVEL', { infer: true }),
          transport:
            config.getOrThrow('NODE_ENV', { infer: true }) === 'development'
              ? { target: 'pino-pretty' }
              : undefined,
          redact: {
            paths: [
              'req.headers.authorization',
              'req.headers.cookie',
              '*.password',
              '*.passwordHash',
              '*.refreshToken',
            ],
            censor: '[redacted]',
          },
        },
      }),
    }),
    DatabaseModule,
    CommonModule,
    HealthModule,
    ReferenceModule,
    PeopleModule,
    TutorsModule,
    PackagesModule,
    EnrolmentModule,
    TimetableModule,
    AttendanceModule,
    ProgrammesModule,
    AssessmentModule,
    ProgressReportModule,
    BillingModule,
    ConsentModule,
    EnquiriesModule,
    CommunicationModule,
    ResourcesModule,
    ReviewsModule,
    FinanceModule,
  ],
})
export class AppModule {}
