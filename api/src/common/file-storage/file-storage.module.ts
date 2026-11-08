import { Module } from '@nestjs/common';
import { FileStorageService } from './file-storage.service.js';
import { supabaseStorageClientProvider } from './supabase-storage-client.provider.js';

@Module({
  providers: [supabaseStorageClientProvider, FileStorageService],
  exports: [FileStorageService],
})
export class FileStorageModule {}
