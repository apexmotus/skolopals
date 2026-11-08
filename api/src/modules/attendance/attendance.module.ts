import { Module } from '@nestjs/common';
import { AttendanceController } from './attendance.controller.js';
import { AttendanceManager } from './attendance.manager.js';
import { AttendanceRepository } from './attendance.repository.js';

@Module({
  controllers: [AttendanceController],
  providers: [AttendanceManager, AttendanceRepository],
  exports: [AttendanceManager],
})
export class AttendanceModule {}
