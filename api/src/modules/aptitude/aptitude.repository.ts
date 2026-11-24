import { Injectable } from '@nestjs/common';
import { p } from '../../database/sp-param.js';
import { StoredProcRunner } from '../../database/stored-proc.runner.js';
import type {
  AptitudeQuestionDto,
  AptitudeResultDto,
  AttemptDto,
} from './dto/aptitude.dto.js';
import type { BankShape, ServedItem, Verdict } from './aptitude.engine.js';

export interface AttemptState {
  attemptId: string;
  status: 'in_progress' | 'completed' | 'abandoned';
  gradeCode: string | null;
  bank: BankShape & { version: string };
  history: ServedItem[];
}

/**
 * Every call goes to a `private.aptitude_*` function
 * (`db/migrations/20261124000002_aptitude.sql`). They live in `private`
 * because that schema is not exposed by PostgREST: the API runs as the
 * caller's own role, so a function in `public` could equally be called by a
 * parent with the public anon key, and `aptitude_serve` would let them pick
 * their child's questions. Each function checks the caller is the learner's
 * guardian or an administrator.
 */
@Injectable()
export class AptitudeRepository {
  constructor(private readonly sp: StoredProcRunner) {}

  private async jsonb<T>(fn: string, params: Parameters<StoredProcRunner['queryOne']>[1]): Promise<T> {
    const name = fn.slice(fn.indexOf('.') + 1);
    const row = await this.sp.queryOne<Record<string, T>>(fn, params);
    return row?.[name] as T;
  }

  start(enrolmentId: string): Promise<AttemptDto> {
    return this.jsonb('private.aptitude_start', [
      p.uuid('p_enrolment_id', enrolmentId),
    ]);
  }

  state(attemptId: string): Promise<AttemptState> {
    return this.jsonb('private.aptitude_state', [
      p.uuid('p_attempt_id', attemptId),
    ]);
  }

  /** False when a question was already waiting, so nothing was served. */
  serve(attemptId: string, itemId: string, difficulty: number): Promise<boolean> {
    return this.jsonb('private.aptitude_serve', [
      p.uuid('p_attempt_id', attemptId),
      p.text('p_item_id', itemId),
      p.int('p_difficulty', difficulty),
    ]);
  }

  /** The waiting question, or null when none is waiting. */
  async currentItem(attemptId: string): Promise<AptitudeQuestionDto | null> {
    const item = await this.jsonb<AptitudeQuestionDto | null>(
      'private.aptitude_current_item',
      [p.uuid('p_attempt_id', attemptId)],
    );
    if (!item) return null;
    // jsonb null comes back as null; the DTO leaves an absent passage out.
    const { passage, ...rest } = item;
    return passage ? { ...rest, passage } : rest;
  }

  async answer(
    attemptId: string,
    itemId: string,
    optionId: string,
    msTaken: number,
  ): Promise<void> {
    await this.sp.queryOne('private.aptitude_answer', [
      p.uuid('p_attempt_id', attemptId),
      p.text('p_item_id', itemId),
      p.text('p_option_id', optionId),
      p.int('p_ms_taken', msTaken),
    ]);
  }

  async complete(attemptId: string, verdict: Verdict): Promise<void> {
    await this.sp.queryOne('private.aptitude_complete', [
      p.uuid('p_attempt_id', attemptId),
      p.int('p_final_band', verdict.finalBand),
      p.text('p_level_label', verdict.levelLabel),
      p.int('p_literacy_pct', verdict.literacyPct),
      p.int('p_logic_pct', verdict.logicPct),
      p.bool('p_low_confidence', verdict.lowConfidence),
    ]);
  }

  result(attemptId: string): Promise<AptitudeResultDto> {
    return this.jsonb('private.aptitude_result', [
      p.uuid('p_attempt_id', attemptId),
    ]);
  }

  async retake(attemptId: string): Promise<void> {
    await this.sp.queryOne('private.aptitude_retake', [
      p.uuid('p_attempt_id', attemptId),
    ]);
  }
}
