import { Module } from '@nestjs/common';
import { FileStorageModule } from '../../common/file-storage/file-storage.module.js';
import { PaymentsController } from './payments.controller.js';
import { PaymentsManager } from './payments.manager.js';
import { PaymentsRepository } from './payments.repository.js';

@Module({
  imports: [FileStorageModule],
  controllers: [PaymentsController],
  providers: [PaymentsManager, PaymentsRepository],
})
export class PaymentsModule {}
