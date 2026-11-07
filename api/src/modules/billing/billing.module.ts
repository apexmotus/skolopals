import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingManager } from './billing.manager';
import { BillingRepository } from './billing.repository';

@Module({
  controllers: [BillingController],
  providers: [BillingManager, BillingRepository],
})
export class BillingModule {}
