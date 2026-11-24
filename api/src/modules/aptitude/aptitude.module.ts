import { Module } from '@nestjs/common';
import { AptitudeController } from './aptitude.controller.js';
import { AptitudeManager } from './aptitude.manager.js';
import { AptitudeRepository } from './aptitude.repository.js';

@Module({
  controllers: [AptitudeController],
  providers: [AptitudeManager, AptitudeRepository],
})
export class AptitudeModule {}
