import { Injectable, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '../../common/types/auth-user';
import { ConsentMapper } from './consent.mapper';
import { ConsentRepository } from './consent.repository';
import type { ConsentDto } from './dto/consent.dto';
import type { RecordRetentionActionDto, RetentionDueDto, RetentionLogDto } from './dto/retention.dto';

/**
 * No caching anywhere — consent state gates enrolment activation and must
 * always be current. Visibility for `list` is "Guardian-of, Admin", wider
 * than `withdraw`'s "Guardian-who-granted" — the two need different checks,
 * not one shared actor param threaded through both.
 */
@Injectable()
export class ConsentManager {
  constructor(private readonly repo: ConsentRepository) {}

  /** Disambiguates "not entitled to this learner" (404) from "entitled, but zero consents on file" ([]) — same ambiguous-empty-list reasoning as `billing`. */
  async list(learnerId: string): Promise<ConsentDto[]> {
    if (!(await this.repo.isEntitledToLearner(learnerId))) {
      throw new NotFoundException('Learner not found.');
    }
    const rows = await this.repo.listForLearner(learnerId);
    return rows.map((row) => ConsentMapper.toDto(row));
  }

  async withdraw(learnerId: string, consentTypeCode: string, actor: AuthUser): Promise<ConsentDto> {
    const row = await this.repo.withdraw(learnerId, consentTypeCode, actor.id);
    if (!row) {
      throw new NotFoundException(
        'No live consent of that type, granted by you, exists for this learner.',
      );
    }
    return ConsentMapper.toDto(row);
  }

  async getDue(): Promise<RetentionDueDto[]> {
    const rows = await this.repo.getDueForRetention();
    return rows.map((row) => ConsentMapper.retentionDueToDto(row));
  }

  async recordAction(
    learnerId: string,
    actor: AuthUser,
    dto: RecordRetentionActionDto,
  ): Promise<RetentionLogDto> {
    const row = await this.repo.recordLearnerRetentionAction({
      learnerId,
      action: dto.action,
      confirmedBy: actor.id,
      note: dto.note,
    });
    return ConsentMapper.retentionLogToDto(row);
  }
}
