import { Module } from '@nestjs/common';
import { AttendanceController } from './attendance.controller';
import { AttendanceManager } from './attendance.manager';
import { AttendanceRepository } from './attendance.repository';

@Module({
  controllers: [AttendanceController],
  providers: [AttendanceManager, AttendanceRepository],
  exports: [AttendanceManager],
})
export class AttendanceModule {}
