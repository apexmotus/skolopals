import { Module } from '@nestjs/common';
import { EnquiriesController } from './enquiries.controller';
import { EnquiriesManager } from './enquiries.manager';
import { EnquiriesRepository } from './enquiries.repository';

@Module({
  controllers: [EnquiriesController],
  providers: [EnquiriesManager, EnquiriesRepository],
})
export class EnquiriesModule {}
