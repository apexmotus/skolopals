import type { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';
import type { EnvConfig } from '../../config/env.schema.js';
import { SUPABASE_ADMIN_CLIENT } from './supabase-admin.constants.js';

export const supabaseAdminClientProvider: Provider = {
  provide: SUPABASE_ADMIN_CLIENT,
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
