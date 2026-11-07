import { Module } from '@nestjs/common';
import { ResourcesController } from './resources.controller';
import { ResourcesManager } from './resources.manager';
import { ResourcesRepository } from './resources.repository';

@Module({
  controllers: [ResourcesController],
  providers: [ResourcesManager, ResourcesRepository],
})
export class ResourcesModule {}
