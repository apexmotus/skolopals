import { Module } from '@nestjs/common';
import { SupabaseAdminAuthService } from './supabase-admin-auth.service.js';
import { supabaseAdminClientProvider } from './supabase-admin-client.provider.js';

@Module({
  providers: [supabaseAdminClientProvider, SupabaseAdminAuthService],
  exports: [SupabaseAdminAuthService],
})
export class SupabaseAdminModule {}
