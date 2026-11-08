import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller.js';
import { BillingManager } from './billing.manager.js';
import { BillingRepository } from './billing.repository.js';

@Module({
  controllers: [BillingController],
  providers: [BillingManager, BillingRepository],
})
export class BillingModule {}
