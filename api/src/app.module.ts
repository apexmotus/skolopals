import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import type { EnvConfig } from './config/env.schema';
import { AppConfigModule } from './config/config.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { CommonModule } from './common/common.module';
import { DatabaseModule } from './database/database.module';
import { EnrolmentModule } from './modules/enrolment/enrolment.module';
import { HealthModule } from './modules/health/health.module';
import { PackagesModule } from './modules/packages/packages.module';
import { PeopleModule } from './modules/people/people.module';
import { ProgrammesModule } from './modules/programmes/programmes.module';
import { ReferenceModule } from './modules/reference/reference.module';
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
  ],
})
export class AppModule {}
