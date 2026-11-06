import type { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';
import type { EnvConfig } from '../../config/env.schema';
import { SUPABASE_STORAGE_CLIENT } from './file-storage.constants';

/**
 * Service-role client, scoped to Storage only — per
 * docs/nestjs-api-plan/04-phase0-schema-port-and-cutover-strategy.md §3,
 * this is one of only two places in the whole API allowed to use the
 * service-role key (the other is the one-off first-admin-grant script,
 * which lives outside this API entirely).
 */
export const supabaseStorageClientProvider: Provider = {
  provide: SUPABASE_STORAGE_CLIENT,
  inject: [ConfigService],
  useFactory: (config: ConfigService<EnvConfig, true>) =>
    createClient(
      config.getOrThrow('SUPABASE_URL', { infer: true }),
      config.getOrThrow('SUPABASE_SERVICE_ROLE_KEY', { infer: true }),
      {
        auth: { persistSession: false, autoRefreshToken: false },
      },
    ),
};
