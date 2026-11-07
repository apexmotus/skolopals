import { Module } from '@nestjs/common';
import { CacheModule } from '../../common/cache/cache.module';
import { PackagesController } from './packages.controller';
import { PackagesManager } from './packages.manager';
import { PackagesRepository } from './packages.repository';

@Module({
  imports: [CacheModule],
  controllers: [PackagesController],
  providers: [PackagesManager, PackagesRepository],
  exports: [PackagesManager],
})
export class PackagesModule {}
