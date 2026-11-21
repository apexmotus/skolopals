import { Module } from '@nestjs/common';
import { FileStorageService } from './file-storage.service.js';
import { ImageConverter } from './image-converter.js';
import { supabaseStorageClientProvider } from './supabase-storage-client.provider.js';

@Module({
  providers: [
    supabaseStorageClientProvider,
    FileStorageService,
    ImageConverter,
  ],
  exports: [FileStorageService, ImageConverter],
})
export class FileStorageModule {}
