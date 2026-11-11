import type { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, type JWTVerifyGetKey } from 'jose';
import type { EnvConfig } from '../../config/env.schema.js';

/** Injection token for the key resolver `JwtAuthGuard` verifies asymmetric tokens with. */
export const SUPABASE_JWKS = Symbol('SUPABASE_JWKS');

/** `SUPABASE_URL` without a trailing slash; the issuer Supabase stamps on every token is `<this>/auth/v1`. */
export function supabaseAuthIssuer(supabaseUrl: string): string {
  return `${supabaseUrl.replace(/\/+$/, '')}/auth/v1`;
}

/**
 * Supabase publishes the public half of its JWT signing keys at
 * `<SUPABASE_URL>/auth/v1/.well-known/jwks.json`. `createRemoteJWKSet` fetches
 * that document lazily on first use, caches it, and re-fetches when it sees a
 * `kid` it does not know — so a key rotation in the dashboard needs no
 * redeploy here. One instance per process; the guard is request-scoped only
 * in the sense that each request calls it.
 */
export const supabaseJwksProvider: Provider = {
  provide: SUPABASE_JWKS,
  inject: [ConfigService],
  useFactory: (config: ConfigService<EnvConfig, true>): JWTVerifyGetKey =>
    createRemoteJWKSet(
      new URL(
        `${supabaseAuthIssuer(config.getOrThrow('SUPABASE_URL', { infer: true }))}/.well-known/jwks.json`,
      ),
    ),
};
