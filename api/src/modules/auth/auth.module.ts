import { Module } from '@nestjs/common';
import { UserRolesRepository } from './user-roles.repository';

/**
 * Per docs/nestjs-api-plan/06-phase2-auth.md: no `/auth/register`,
 * `/auth/login`, `/auth/refresh`, etc. — Supabase Auth owns those, called
 * directly by `web/`. This module exists only to provide `JwtAuthGuard`
 * with its role lookup. `GET /auth/me` is optional and not built unless
 * `web/` actually asks for it.
 */
@Module({
  providers: [UserRolesRepository],
  exports: [UserRolesRepository],
})
export class AuthModule {}
