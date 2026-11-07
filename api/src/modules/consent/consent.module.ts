import { Module } from '@nestjs/common';
import { ConsentController } from './consent.controller';
import { ConsentManager } from './consent.manager';
import { ConsentRepository } from './consent.repository';

@Module({
  controllers: [ConsentController],
  providers: [ConsentManager, ConsentRepository],
})
export class ConsentModule {}
