import { Injectable } from '@nestjs/common';
import { BusinessRuleException } from '../../common/exceptions/business-rule.exception.js';
import { ERROR_CODES } from '../../common/error-codes.js';
import { UnitOfWork } from '../../database/unit-of-work.js';
import type {
  AptitudeResultDto,
  AttemptDto,
  NextQuestionDto,
  SubmitAnswerDto,
} from './dto/aptitude.dto.js';
import { nextStep } from './aptitude.engine.js';
import { AptitudeRepository } from './aptitude.repository.js';

/**
 * Runs the adaptive test: the engine (`aptitude.engine.ts`) decides, the
 * repository's `private.aptitude_*` functions record. Reading the state,
 * serving and answering happen in one transaction, and `aptitude_state`
 * locks the attempt row, so two tabs on the same test take turns instead of
 * serving two different questions.
 */
@Injectable()
export class AptitudeManager {
  constructor(
    private readonly repo: AptitudeRepository,
    private readonly uow: UnitOfWork,
  ) {}

  start(enrolmentId: string): Promise<AttemptDto> {
    return this.repo.start(enrolmentId);
  }

  next(attemptId: string): Promise<NextQuestionDto> {
    return this.uow.run(() => this.advance(attemptId));
  }

  /** Saves the answer and returns what comes next, in one round trip. */
  answer(attemptId: string, dto: SubmitAnswerDto): Promise<NextQuestionDto> {
    return this.uow.run(async () => {
      await this.repo.answer(attemptId, dto.itemId, dto.optionId, dto.msTaken);
      return this.advance(attemptId);
    });
  }

  result(attemptId: string): Promise<AptitudeResultDto> {
    return this.repo.result(attemptId);
  }

  retake(attemptId: string): Promise<void> {
    return this.repo.retake(attemptId);
  }

  private async advance(attemptId: string): Promise<NextQuestionDto> {
    const state = await this.repo.state(attemptId);
    if (state.status === 'completed') return { done: true };
    if (state.status === 'abandoned') {
      throw new BusinessRuleException(
        ERROR_CODES.BUSINESS_RULE_VIOLATION,
        'This test was set aside by the centre. Start it again from your portal.',
      );
    }

    const step = nextStep(state.bank, state.history, state.gradeCode);
    if (step.kind === 'complete') {
      await this.repo.complete(attemptId, step.verdict);
      return { done: true };
    }
    if (step.kind === 'serve') {
      await this.repo.serve(attemptId, step.itemId, step.difficulty);
    }

    const question = await this.repo.currentItem(attemptId);
    if (!question) {
      throw new Error(`Aptitude attempt ${attemptId} has no waiting question after serving`);
    }
    return { done: false, question };
  }
}
