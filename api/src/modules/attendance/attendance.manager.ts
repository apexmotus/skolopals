import { Injectable, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '../../common/types/auth-user.js';
import { AttendanceMapper } from './attendance.mapper.js';
import { AttendanceRepository } from './attendance.repository.js';
import type { AttendanceRecordDto, CorrectAttendanceDto, MarkAttendanceDto } from './dto/attendance-record.dto.js';
import type { RecordCheckInDto, SessionCheckInDto, SignOutCheckInDto } from './dto/session-check-in.dto.js';

@Injectable()
export class AttendanceManager {
  constructor(private readonly repo: AttendanceRepository) {}

  async listAttendance(classSessionId: string): Promise<AttendanceRecordDto[]> {
    const rows = await this.repo.listAttendance(classSessionId);
    return rows.map((row) => AttendanceMapper.recordToDto(row));
  }

  async markAttendance(
    classSessionId: string,
    actor: AuthUser,
    dto: MarkAttendanceDto,
  ): Promise<AttendanceRecordDto> {
    const row = await this.repo.markAttendance({
      classSessionId,
      learnerId: dto.learnerId,
      status: dto.status,
      markedBy: actor.id,
      note: dto.note,
    });
    return AttendanceMapper.recordToDto(row);
  }

  async correctAttendance(
    classSessionId: string,
    recordId: string,
    actor: AuthUser,
    dto: CorrectAttendanceDto,
  ): Promise<AttendanceRecordDto> {
    const row = await this.repo.correctAttendance(classSessionId, recordId, actor.id, dto);
    if (!row) throw new NotFoundException('Attendance record not found.');
    return AttendanceMapper.recordToDto(row);
  }

  async listCheckIns(classSessionId: string): Promise<SessionCheckInDto[]> {
    const rows = await this.repo.listCheckIns(classSessionId);
    return rows.map((row) => AttendanceMapper.checkInToDto(row));
  }

  async signIn(classSessionId: string, actor: AuthUser, dto: RecordCheckInDto): Promise<SessionCheckInDto> {
    const row = await this.repo.recordCheckIn({
      classSessionId,
      learnerId: dto.learnerId,
      signedInBy: actor.id,
      note: dto.note,
    });
    return AttendanceMapper.checkInToDto(row);
  }

  async signOut(
    classSessionId: string,
    checkInId: string,
    actor: AuthUser,
    dto: SignOutCheckInDto,
  ): Promise<SessionCheckInDto> {
    const row = await this.repo.signOutCheckIn(classSessionId, checkInId, {
      collectedBy: dto.collectedBy,
      signedOutBy: actor.id,
      note: dto.note,
    });
    if (!row) throw new NotFoundException('Check-in not found.');
    return AttendanceMapper.checkInToDto(row);
  }
}
