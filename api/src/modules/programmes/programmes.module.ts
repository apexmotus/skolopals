import { Module } from '@nestjs/common';
import { CacheModule } from '../../common/cache/cache.module.js';
import { ProgrammesController } from './programmes.controller.js';
import { ProgrammesManager } from './programmes.manager.js';
import { ProgrammesRepository } from './programmes.repository.js';

@Module({
  imports: [CacheModule],
  controllers: [ProgrammesController],
  providers: [ProgrammesManager, ProgrammesRepository],
  exports: [ProgrammesManager],
})
export class ProgrammesModule {}
