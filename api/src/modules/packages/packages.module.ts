import { Module } from '@nestjs/common';
import { CacheModule } from '../../common/cache/cache.module.js';
import { PackagesController } from './packages.controller.js';
import { PackagesManager } from './packages.manager.js';
import { PackagesRepository } from './packages.repository.js';

@Module({
  imports: [CacheModule],
  controllers: [PackagesController],
  providers: [PackagesManager, PackagesRepository],
  exports: [PackagesManager],
})
export class PackagesModule {}
