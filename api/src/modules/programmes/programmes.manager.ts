import { Injectable, NotFoundException } from '@nestjs/common';
import { CacheService } from '../../common/cache/cache.service';
import type { AuthUser } from '../../common/types/auth-user';
import type {
  MarkProgrammeAttendanceDto,
  ProgrammeAttendanceDto,
} from './dto/programme-attendance.dto';
import type { BookProgrammeDto, ProgrammeEnrolmentDto } from './dto/programme-enrolment.dto';
import type { AddProgrammeSessionDto, ProgrammeSessionDto } from './dto/programme-session.dto';
import type { CreateProgrammeDto, ProgrammeDto, UpdateProgrammeDto } from './dto/programme.dto';
import { programmesCacheKeys, PROGRAMMES_CACHE_TTL_SECONDS } from './programmes-cache-keys';
import { ProgrammesMapper } from './programmes.mapper';
import { ProgrammesRepository } from './programmes.repository';

@Injectable()
export class ProgrammesManager {
  constructor(
    private readonly repo: ProgrammesRepository,
    private readonly cache: CacheService,
  ) {}

  /**
   * `programmes`' own RLS policy (`is_published or is_admin()`) already
   * decides whether unpublished programmes are included — no Manager branch
   * like `packages`' needed for that. Caching is still actor-gated, same
   * reasoning as `timetable`'s `listClassGroups`: an admin's response
   * includes rows a non-admin's would not, so only the non-admin shape is
   * ever cached, and only for the unfiltered query.
   */
  async listProgrammes(actor: AuthUser | undefined): Promise<ProgrammeDto[]> {
    const isAdmin = actor?.roles.includes('admin') ?? false;
    if (!isAdmin) {
      const cached = await this.cache.get<ProgrammeDto[]>(programmesCacheKeys.listPublished);
      if (cached) return cached;
    }

    const dtos = (await this.repo.listProgrammes()).map((row) => ProgrammesMapper.toDto(row));

    if (!isAdmin) {
      await this.cache.set(programmesCacheKeys.listPublished, dtos, PROGRAMMES_CACHE_TTL_SECONDS);
    }
    return dtos;
  }

  async getProgrammeById(id: string, actor: AuthUser | undefined): Promise<ProgrammeDto> {
    const isAdmin = actor?.roles.includes('admin') ?? false;
    if (!isAdmin) {
      const cached = await this.cache.get<ProgrammeDto>(programmesCacheKeys.byId(id));
      if (cached) return cached;
    }

    const row = await this.repo.getProgrammeById(id);
    if (!row) throw new NotFoundException('Programme not found.');
    const dto = ProgrammesMapper.toDto(row);

    if (!isAdmin) {
      await this.cache.set(programmesCacheKeys.byId(id), dto, PROGRAMMES_CACHE_TTL_SECONDS);
    }
    return dto;
  }

  async createProgramme(dto: CreateProgrammeDto): Promise<ProgrammeDto> {
    const row = await this.repo.createProgramme(dto);
    await this.invalidateCaches();
    return ProgrammesMapper.toDto(row);
  }

  async updateProgramme(id: string, dto: UpdateProgrammeDto): Promise<ProgrammeDto> {
    const row = await this.repo.updateProgramme(id, dto);
    if (!row) throw new NotFoundException('Programme not found.');
    await this.invalidateCaches(id);
    return ProgrammesMapper.toDto(row);
  }

  async addSession(programmeId: string, dto: AddProgrammeSessionDto): Promise<ProgrammeSessionDto> {
    const row = await this.repo.addSession(programmeId, dto);
    return ProgrammesMapper.sessionToDto(row);
  }

  async listSessions(programmeId: string): Promise<ProgrammeSessionDto[]> {
    const rows = await this.repo.listSessions(programmeId);
    return rows.map((row) => ProgrammesMapper.sessionToDto(row));
  }

  async listBookings(programmeId: string): Promise<ProgrammeEnrolmentDto[]> {
    const rows = await this.repo.listBookings(programmeId);
    return rows.map((row) => ProgrammesMapper.enrolmentToDto(row));
  }

  async book(programmeId: string, dto: BookProgrammeDto): Promise<ProgrammeEnrolmentDto> {
    const row = await this.repo.bookProgramme(programmeId, dto.learnerId);
    return ProgrammesMapper.enrolmentToDto(row);
  }

  async cancel(programmeId: string, enrolmentId: string): Promise<ProgrammeEnrolmentDto> {
    const row = await this.repo.cancelBooking(programmeId, enrolmentId);
    if (!row) throw new NotFoundException('Booking not found, or already cancelled.');
    return ProgrammesMapper.enrolmentToDto(row);
  }

  async listAttendance(programmeSessionId: string): Promise<ProgrammeAttendanceDto[]> {
    const rows = await this.repo.listAttendance(programmeSessionId);
    return rows.map((row) => ProgrammesMapper.attendanceToDto(row));
  }

  async markAttendance(
    programmeSessionId: string,
    actor: AuthUser,
    dto: MarkProgrammeAttendanceDto,
  ): Promise<ProgrammeAttendanceDto> {
    const row = await this.repo.markAttendance({
      programmeSessionId,
      learnerId: dto.learnerId,
      status: dto.status,
      markedBy: actor.id,
      note: dto.note,
    });
    return ProgrammesMapper.attendanceToDto(row);
  }

  private async invalidateCaches(programmeId?: string): Promise<void> {
    await this.cache.del(programmesCacheKeys.listPublished);
    if (programmeId) await this.cache.del(programmesCacheKeys.byId(programmeId));
  }
}
