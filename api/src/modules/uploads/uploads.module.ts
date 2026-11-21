import { Module } from '@nestjs/common';
import { FileStorageModule } from '../../common/file-storage/file-storage.module.js';
import { UploadsController } from './uploads.controller.js';
import { UploadsManager } from './uploads.manager.js';

@Module({
  imports: [FileStorageModule],
  controllers: [UploadsController],
  providers: [UploadsManager],
})
export class UploadsModule {}
