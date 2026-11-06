import { Module } from '@nestjs/common';
import { FileStorageService } from './file-storage.service';
import { supabaseStorageClientProvider } from './supabase-storage-client.provider';

@Module({
  providers: [supabaseStorageClientProvider, FileStorageService],
  exports: [FileStorageService],
})
export class FileStorageModule {}
