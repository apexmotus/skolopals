import { Global, Module } from '@nestjs/common';
import { DatabaseShutdownService } from './database-shutdown.service';
import { pgPoolProvider } from './database.providers';
import { StoredProcRunner } from './stored-proc.runner';
import { TransactionContext } from './transaction.context';
import { UnitOfWork } from './unit-of-work';

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
