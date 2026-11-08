import { Module } from '@nestjs/common';
import { CacheModule } from '../../common/cache/cache.module.js';
import { FinanceController } from './finance.controller.js';
import { FinanceManager } from './finance.manager.js';
import { FinanceRepository } from './finance.repository.js';

@Module({
  imports: [CacheModule],
  controllers: [FinanceController],
  providers: [FinanceManager, FinanceRepository],
})
export class FinanceModule {}
