import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ClsModule } from 'nestjs-cls';
import { AuthModule } from '../modules/auth/auth.module.js';
import { AllExceptionsFilter } from './filters/all-exceptions.filter.js';
import { FileStorageModule } from './file-storage/file-storage.module.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { RolesGuard } from './guards/roles.guard.js';
import { ThrottleGuard } from './guards/throttle.guard.js';
import { ResponseEnvelopeInterceptor } from './interceptors/response-envelope.interceptor.js';
import { RedisModule } from './redis/redis.module.js';

/**
 * Rate limiting lives in `main.ts` as a plain Fastify plugin
 * (`@fastify/rate-limit`), not `@nestjs/throttler`/`APP_GUARD` here.
 * `@nestjs/throttler`'s compiled output still does `require('@nestjs/common')`,
 * which is ESM-only as of Nest v12 — Vercel's Node Functions runtime (unlike a
 * plain local `node`) does not support that CJS-requires-ESM interop, so every
 * request crashed with `ERR_REQUIRE_ESM` in production. `@fastify/rate-limit`
 * has no Nest-ecosystem dependency at all, so it can't hit the same wall.
 */
@Module({
  imports: [
    ClsModule.forRoot({
      global: true,
      middleware: { mount: true, generateId: true },
    }),
    JwtModule.register({}),
    RedisModule,
    FileStorageModule,
    AuthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: ThrottleGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: ResponseEnvelopeInterceptor },
  ],
  exports: [FileStorageModule],
})
export class CommonModule {}
