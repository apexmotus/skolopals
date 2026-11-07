import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import type { EnvConfig } from './config/env.schema';
import { AppConfigModule } from './config/config.module';
import { AssessmentModule } from './modules/assessment/assessment.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { BillingModule } from './modules/billing/billing.module';
import { CommonModule } from './common/common.module';
import { CommunicationModule } from './modules/communication/communication.module';
import { ConsentModule } from './modules/consent/consent.module';
import { DatabaseModule } from './database/database.module';
import { EnquiriesModule } from './modules/enquiries/enquiries.module';
import { EnrolmentModule } from './modules/enrolment/enrolment.module';
import { FinanceModule } from './modules/finance/finance.module';
import { HealthModule } from './modules/health/health.module';
import { PackagesModule } from './modules/packages/packages.module';
import { PeopleModule } from './modules/people/people.module';
import { ProgrammesModule } from './modules/programmes/programmes.module';
import { ProgressReportModule } from './modules/progress-reports/progress-report.module';
import { ReferenceModule } from './modules/reference/reference.module';
import { ResourcesModule } from './modules/resources/resources.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { TimetableModule } from './modules/timetable/timetable.module';
import { TutorsModule } from './modules/tutors/tutors.module';

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
