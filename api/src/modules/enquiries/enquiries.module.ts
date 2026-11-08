import { Module } from '@nestjs/common';
import { EnquiriesController } from './enquiries.controller.js';
import { EnquiriesManager } from './enquiries.manager.js';
import { EnquiriesRepository } from './enquiries.repository.js';

@Module({
  controllers: [EnquiriesController],
  providers: [EnquiriesManager, EnquiriesRepository],
})
export class EnquiriesModule {}
