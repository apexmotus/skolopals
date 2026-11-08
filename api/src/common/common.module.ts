import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ClsModule } from 'nestjs-cls';
import { ConfigService } from '@nestjs/config';
import type { EnvConfig } from '../config/env.schema.js';
import { AuthModule } from '../modules/auth/auth.module.js';
import { AllExceptionsFilter } from './filters/all-exceptions.filter.js';
import { FileStorageModule } from './file-storage/file-storage.module.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { RolesGuard } from './guards/roles.guard.js';
import { ResponseEnvelopeInterceptor } from './interceptors/response-envelope.interceptor.js';
import { RedisModule } from './redis/redis.module.js';

@Module({
  imports: [
    ClsModule.forRoot({
      global: true,
      middleware: { mount: true, generateId: true },
    }),
    JwtModule.register({}),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvConfig, true>) => ({
        throttlers: [
          {
            ttl: config.getOrThrow('THROTTLE_TTL_MS', { infer: true }),
            limit: config.getOrThrow('THROTTLE_LIMIT', { infer: true }),
          },
        ],
      }),
    }),
    RedisModule,
    FileStorageModule,
    AuthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: ResponseEnvelopeInterceptor },
  ],
  exports: [FileStorageModule],
})
export class CommonModule {}
