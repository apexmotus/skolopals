import { Global, Module } from '@nestjs/common';
import { DatabaseShutdownService } from './database-shutdown.service.js';
import { pgPoolProvider } from './database.providers.js';
import { StoredProcRunner } from './stored-proc.runner.js';
import { TransactionContext } from './transaction.context.js';
import { UnitOfWork } from './unit-of-work.js';

@Global()
@Module({
  providers: [
    pgPoolProvider,
    DatabaseShutdownService,
    StoredProcRunner,
    TransactionContext,
    UnitOfWork,
  ],
  exports: [pgPoolProvider, StoredProcRunner, TransactionContext, UnitOfWork],
})
export class DatabaseModule {}
