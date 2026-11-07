import { Module } from '@nestjs/common';
import { CommunicationController } from './communication.controller';
import { CommunicationManager } from './communication.manager';
import { CommunicationRepository } from './communication.repository';

@Module({
  controllers: [CommunicationController],
  providers: [CommunicationManager, CommunicationRepository],
})
export class CommunicationModule {}
