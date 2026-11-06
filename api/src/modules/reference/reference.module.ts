import { Module } from '@nestjs/common';
import { CacheModule } from '../../common/cache/cache.module';
import { ReferenceController } from './reference.controller';
import { ReferenceManager } from './reference.manager';
import { ReferenceRepository } from './reference.repository';

@Module({
  imports: [CacheModule],
  controllers: [ReferenceController],
  providers: [ReferenceManager, ReferenceRepository],
})
export class ReferenceModule {}
