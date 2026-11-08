import { Module } from '@nestjs/common';
import { CommunicationController } from './communication.controller.js';
import { CommunicationManager } from './communication.manager.js';
import { CommunicationRepository } from './communication.repository.js';

@Module({
  controllers: [CommunicationController],
  providers: [CommunicationManager, CommunicationRepository],
})
export class CommunicationModule {}
