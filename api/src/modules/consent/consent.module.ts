import { Module } from '@nestjs/common';
import { ConsentController } from './consent.controller.js';
import { ConsentManager } from './consent.manager.js';
import { ConsentRepository } from './consent.repository.js';

@Module({
  controllers: [ConsentController],
  providers: [ConsentManager, ConsentRepository],
})
export class ConsentModule {}
