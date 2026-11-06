import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ClsModule } from 'nestjs-cls';
import { ConfigService } from '@nestjs/config';
import type { EnvConfig } from '../config/env.schema';
import { AllExceptionsFilter } from './filters/all-exceptions.filter';
import { FileStorageModule } from './file-storage/file-storage.module';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { ResponseEnvelopeInterceptor } from './interceptors/response-envelope.interceptor';
import { RedisModule } from './redis/redis.module';

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
