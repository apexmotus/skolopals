import { Injectable, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '../../common/types/auth-user.js';
import { ProgressReportMapper } from './progress-report.mapper.js';
import { ProgressReportRepository } from './progress-report.repository.js';
import type {
  AcknowledgeReportDto,
  ProgressReportDto,
  SaveProgressReportDto,
} from './dto/progress-report.dto.js';

@Injectable()
export class ProgressReportManager {
  constructor(private readonly repo: ProgressReportRepository) {}

  async list(learnerId: string): Promise<ProgressReportDto[]> {
    const rows = await this.repo.listByLearner(learnerId);
    return rows.map((row) => ProgressReportMapper.toDto(row));
  }

  /**
   * RLS (`reports: parent sees published`) is what makes a draft invisible to
   * a non-teaching guardian here — a hidden report simply isn't in the result
   * set, so this surfaces as the same 404 a genuinely missing id would, by
   * design (see `09-phase3c-...md` task 3).
   */
  async getById(id: string): Promise<ProgressReportDto> {
    const row = await this.repo.getById(id);
    if (!row) throw new NotFoundException('Progress report not found.');
    return ProgressReportMapper.toDto(row);
  }

  async save(
    learnerId: string,
    termId: string,
    dto: SaveProgressReportDto,
  ): Promise<ProgressReportDto> {
    const id = await this.repo.save({
      learnerId,
      termId,
      summary: dto.summary,
      attendanceNote: dto.attendanceNote,
      publish: dto.publish ?? false,
      subjects: ProgressReportMapper.toSubjectsPayload(dto),
    });
    const row = await this.repo.getById(id);
    if (!row) throw new Error('Progress report not found immediately after saving it');
    return ProgressReportMapper.toDto(row);
  }

  async acknowledge(
    id: string,
    actor: AuthUser,
    dto: AcknowledgeReportDto,
  ): Promise<ProgressReportDto> {
    await this.repo.acknowledge(id, actor.id, dto.comment);
    const row = await this.repo.getById(id);
    if (!row) throw new Error('Progress report not found immediately after acknowledging it');
    return ProgressReportMapper.toDto(row);
  }
}
