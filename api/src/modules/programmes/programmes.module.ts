import { Module } from '@nestjs/common';
import { CacheModule } from '../../common/cache/cache.module';
import { ProgrammesController } from './programmes.controller';
import { ProgrammesManager } from './programmes.manager';
import { ProgrammesRepository } from './programmes.repository';

@Module({
  imports: [CacheModule],
  controllers: [ProgrammesController],
  providers: [ProgrammesManager, ProgrammesRepository],
  exports: [ProgrammesManager],
})
export class ProgrammesModule {}
