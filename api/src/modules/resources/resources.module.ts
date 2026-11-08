import { Module } from '@nestjs/common';
import { ResourcesController } from './resources.controller.js';
import { ResourcesManager } from './resources.manager.js';
import { ResourcesRepository } from './resources.repository.js';

@Module({
  controllers: [ResourcesController],
  providers: [ResourcesManager, ResourcesRepository],
})
export class ResourcesModule {}
