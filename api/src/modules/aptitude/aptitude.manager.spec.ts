import { BusinessRuleException } from '../../common/exceptions/business-rule.exception.js';
import type { UnitOfWork } from '../../database/unit-of-work.js';
import { AptitudeManager } from './aptitude.manager.js';
import type { AptitudeRepository, AttemptState } from './aptitude.repository.js';

function makeUow(): UnitOfWork {
  return {
    run: vi.fn((fn: () => Promise<unknown>) => fn()),
  } as unknown as UnitOfWork;
}

/** A two-item bank: one logic item, test length 1. */
function stateWith(overrides: Partial<AttemptState> = {}): AttemptState {
  return {
    attemptId: 'a1',
    status: 'in_progress',
    gradeCode: 'grade_7',
    bank: {
      version: '1.0.0',
      blueprint: { testLength: 1, literacyItems: 0, logicItems: 1 },
      adaptive: { startDifficulty: 3, minDifficulty: 1, maxDifficulty: 5, stepSize: 1 },
      scoring: {
        levels: [
          { label: 'Emerging', bands: [1, 2] },
          { label: 'Developing', bands: [3] },
          { label: 'Secure', bands: [4] },
          { label: 'Extending', bands: [5] },
        ],
      },
      items: [
        { id: 'LOG-PAT-03', section: 'logic', skill: 'pattern', difficulty: 3, passageId: null },
        { id: 'LOG-PAT-04', section: 'logic', skill: 'pattern', difficulty: 4, passageId: null },
      ],
    },
    history: [],
    ...overrides,
  };
}

const QUESTION = {
  seq: 1, total: 1, itemId: 'LOG-PAT-03', section: 'logic', stem: '?', options: [],
};

function makeRepo(state: AttemptState) {
  return {
    state: vi.fn().mockResolvedValue(state),
    serve: vi.fn().mockResolvedValue(true),
    currentItem: vi.fn().mockResolvedValue(QUESTION),
    answer: vi.fn().mockResolvedValue(undefined),
    complete: vi.fn().mockResolvedValue(undefined),
  };
}

describe('AptitudeManager.next', () => {
  it('serves the engine’s choice at the current difficulty, then returns it', async () => {
    const repo = makeRepo(stateWith());
    const manager = new AptitudeManager(repo as unknown as AptitudeRepository, makeUow());

    await expect(manager.next('a1')).resolves.toEqual({ done: false, question: QUESTION });
    expect(repo.serve).toHaveBeenCalledWith('a1', 'LOG-PAT-03', 3);
  });

  it('re-shows a waiting question without serving another', async () => {
    const repo = makeRepo(
      stateWith({ history: [{ itemId: 'LOG-PAT-03', difficulty: 3, answered: false, isCorrect: null }] }),
    );
    const manager = new AptitudeManager(repo as unknown as AptitudeRepository, makeUow());

    await manager.next('a1');
    expect(repo.serve).not.toHaveBeenCalled();
    expect(repo.currentItem).toHaveBeenCalledWith('a1');
  });

  it('records the verdict once every question is answered', async () => {
    const repo = makeRepo(
      stateWith({ history: [{ itemId: 'LOG-PAT-03', difficulty: 3, answered: true, isCorrect: true }] }),
    );
    const manager = new AptitudeManager(repo as unknown as AptitudeRepository, makeUow());

    await expect(manager.next('a1')).resolves.toEqual({ done: true });
    expect(repo.complete).toHaveBeenCalledWith('a1', {
      finalBand: 3,
      levelLabel: 'Developing',
      literacyPct: 0,
      logicPct: 100,
      lowConfidence: false,
    });
  });

  it('reports done for a completed attempt without touching it', async () => {
    const repo = makeRepo(stateWith({ status: 'completed' }));
    const manager = new AptitudeManager(repo as unknown as AptitudeRepository, makeUow());

    await expect(manager.next('a1')).resolves.toEqual({ done: true });
    expect(repo.serve).not.toHaveBeenCalled();
    expect(repo.complete).not.toHaveBeenCalled();
  });

  it('refuses an attempt the centre set aside', async () => {
    const repo = makeRepo(stateWith({ status: 'abandoned' }));
    const manager = new AptitudeManager(repo as unknown as AptitudeRepository, makeUow());

    await expect(manager.next('a1')).rejects.toBeInstanceOf(BusinessRuleException);
  });
});

describe('AptitudeManager.answer', () => {
  it('saves the answer and advances in the same unit of work', async () => {
    const repo = makeRepo(stateWith());
    const uow = makeUow();
    const manager = new AptitudeManager(repo as unknown as AptitudeRepository, uow);

    await manager.answer('a1', { itemId: 'LOG-PAT-03', optionId: 'B', msTaken: 1500 });
    expect(uow.run).toHaveBeenCalledTimes(1);
    expect(repo.answer).toHaveBeenCalledWith('a1', 'LOG-PAT-03', 'B', 1500);
    const [answeredAt = Infinity] = repo.answer.mock.invocationCallOrder;
    const [readStateAt = -Infinity] = repo.state.mock.invocationCallOrder;
    expect(answeredAt).toBeLessThan(readStateAt);
  });
});
