import { Module } from '@nestjs/common';
import { CacheModule } from '../../common/cache/cache.module.js';
import { ReferenceController } from './reference.controller.js';
import { ReferenceManager } from './reference.manager.js';
import { ReferenceRepository } from './reference.repository.js';

@Module({
  imports: [CacheModule],
  controllers: [ReferenceController],
  providers: [ReferenceManager, ReferenceRepository],
})
export class ReferenceModule {}
