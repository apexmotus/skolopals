import { z } from 'zod';

/**
 * Single source of truth for environment variables. Validated once at boot;
 * the process exits with a readable message if validation fails.
 *
 * Adapted from the generic spec's §8.1 table for Postgres/Supabase (see
 * docs/nestjs-api-plan/04-phase0-schema-port-and-cutover-strategy.md and
 * 05-phase1-scaffold-infrastructure.md task 2): no DB_SERVER/DB_NAME/SQL-auth
 * vars, no JWT_ACCESS_SECRET/JWT_REFRESH_TTL_DAYS (Supabase Auth issues
 * tokens, this API only verifies them), no SENDGRID_* vars, no TZ_DEFAULT.
 */
const booleanString = (fallback: 'true' | 'false') =>
  z
    .enum(['true', 'false'])
    .default(fallback)
    .transform((v) => v === 'true');

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
    .default('info'),

  // Supabase's DIRECT connection string (port 5432, session mode) by default —
  // see phase0 §1. Swapping to the 6543 Supavisor transaction pooler is a
  // same-shape connection string, no code change required (rls-context.ts's
  // set_config(..., true)/SET LOCAL ROLE are already transaction-scoped);
  // switch if Supabase's dashboard shows this project approaching its
  // connection limit under real Vercel traffic.
  DATABASE_URL: z.string().min(1),
  DB_POOL_MAX: z.coerce.number().int().positive().default(20),
  DB_POOL_MIN: z.coerce.number().int().nonnegative().default(2),
  DB_CONNECTION_TIMEOUT_MS: z.coerce.number().int().positive().default(15_000),
  DB_STATEMENT_TIMEOUT_MS: z.coerce.number().int().positive().default(15_000),
  DB_SSL: booleanString('true'),

  // Verifies Supabase-issued access tokens (JwtAuthGuard). HS256 by default;
  // see 06-phase2-auth.md if this project's Supabase instance uses JWKS instead.
  SUPABASE_JWT_SECRET: z.string().min(32),

  // Same Supabase project as DATABASE_URL. Scoped to common/file-storage/
  // (signed URLs for the tutor-documents bucket) and one-off admin scripts only.
  SUPABASE_URL: z.url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  CORS_ORIGINS: z.string().min(1),

  THROTTLE_TTL_MS: z.coerce.number().int().positive().default(60_000),
  THROTTLE_LIMIT: z.coerce.number().int().positive().default(120),

  SWAGGER_ENABLED: booleanString('false'),

  // Caching is enabled per 01-app-definition.md §1.2; required.
  REDIS_URL: z.string().min(1),
});

export type EnvConfig = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): EnvConfig {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    console.error(`Invalid environment configuration:\n${issues}`);
    process.exit(1);
  }
  return result.data;
}
