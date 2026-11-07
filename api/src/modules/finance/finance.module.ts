import { Module } from '@nestjs/common';
import { CacheModule } from '../../common/cache/cache.module';
import { FinanceController } from './finance.controller';
import { FinanceManager } from './finance.manager';
import { FinanceRepository } from './finance.repository';

@Module({
  imports: [CacheModule],
  controllers: [FinanceController],
  providers: [FinanceManager, FinanceRepository],
})
export class FinanceModule {}
