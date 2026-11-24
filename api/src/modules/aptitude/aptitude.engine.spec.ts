import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  type BankShape,
  type ServedItem,
  LOGIC_SKILL_ROTATION,
  currentDifficulty,
  gradeBand,
  nextStep,
  sectionPlan,
  verdict,
} from './aptitude.engine.js';

/** The real bank, exactly as the seed generator loads it. */
const raw = JSON.parse(
  readFileSync(
    fileURLToPath(
      new URL('../../../../db/seed/aptitude/aptitude_test.json', import.meta.url),
    ),
    'utf8',
  ),
) as {
  test: { blueprint: BankShape['blueprint']; adaptive: BankShape['adaptive'] };
  scoring: BankShape['scoring'];
  items: {
    id: string;
    section: 'literacy' | 'logic';
    skill: string;
    difficulty: number;
    passageId?: string;
    answerId: string;
  }[];
};

const BANK: BankShape = {
  blueprint: raw.test.blueprint,
  adaptive: raw.test.adaptive,
  scoring: raw.scoring,
  items: raw.items.map((i) => ({
    id: i.id,
    section: i.section,
    skill: i.skill,
    difficulty: i.difficulty,
    passageId: i.passageId ?? null,
  })),
};
const ITEM = new Map(BANK.items.map((i) => [i.id, i]));
/** Every id in a sitting comes from the bank, so a miss is a test bug. */
const itemOf = (id: string) => {
  const item = ITEM.get(id);
  if (!item) throw new Error(`unknown item ${id}`);
  return item;
};

/** Runs a whole sitting with a simulated learner who answers by `rule`. */
function sit(
  rule: (itemId: string, index: number) => boolean,
  gradeCode = 'grade_7',
) {
  const history: ServedItem[] = [];
  const difficulties: number[] = [];
  for (let guard = 0; guard < 100; guard++) {
    const step = nextStep(BANK, history, gradeCode);
    if (step.kind === 'complete') return { history, difficulties, verdict: step.verdict };
    if (step.kind !== 'serve') throw new Error(`unexpected ${step.kind}`);
    difficulties.push(step.difficulty);
    history.push({ itemId: step.itemId, difficulty: step.difficulty, answered: false, isCorrect: null });
    const isCorrect = rule(step.itemId, history.length - 1);
    history[history.length - 1] = { itemId: step.itemId, difficulty: step.difficulty, answered: true, isCorrect };
  }
  throw new Error('attempt never completed');
}

const sections = (history: ServedItem[]) =>
  history.map((h) => itemOf(h.itemId).section);

describe('sectionPlan', () => {
  it('interleaves 12 literacy and 13 logic as L3 G3 L3 G3 L3 G3 L3 G4', () => {
    const plan = sectionPlan(BANK.blueprint, 3);
    expect(plan).toHaveLength(25);
    expect(plan.join(',')).toBe(
      [3, 3, 3, 3, 3, 3, 3, 4]
        .flatMap((n, i) => Array<string>(n).fill(i % 2 === 0 ? 'literacy' : 'logic'))
        .join(','),
    );
  });

  it('is all logic when there are no passages', () => {
    expect(
      sectionPlan({ testLength: 5, literacyItems: 0, logicItems: 5 }, 0),
    ).toEqual(Array(5).fill('logic'));
  });
});

describe('nextStep — shape of a sitting', () => {
  const { history } = sit((_, i) => i % 3 !== 0);

  it('serves exactly 25 items: 12 literacy and 13 logic', () => {
    expect(history).toHaveLength(25);
    expect(sections(history).filter((s) => s === 'literacy')).toHaveLength(12);
    expect(sections(history).filter((s) => s === 'logic')).toHaveLength(13);
  });

  it('never serves the same item twice', () => {
    expect(new Set(history.map((h) => h.itemId)).size).toBe(history.length);
  });

  it('serves each passage whole and in one run', () => {
    const runs = new Map<string, number[]>();
    history.forEach((h, i) => {
      const passage = itemOf(h.itemId).passageId;
      if (passage) runs.set(passage, [...(runs.get(passage) ?? []), i]);
    });
    expect(runs.size).toBe(4);
    for (const positions of runs.values()) {
      expect(positions).toHaveLength(3);
      expect(positions).toEqual([positions[0], (positions[0] ?? 0) + 1, (positions[0] ?? 0) + 2]);
    }
  });

  it('starts with a reading block, then rotates logic skills', () => {
    expect(sections(history).slice(0, 3)).toEqual(['literacy', 'literacy', 'literacy']);
    const logicSkills = history
      .map((h) => itemOf(h.itemId))
      .filter((i) => i.section === 'logic')
      .slice(0, 4)
      .map((i) => i.skill);
    expect(logicSkills).toEqual([...LOGIC_SKILL_ROTATION]);
  });

  it('waits while a served item is unanswered', () => {
    expect(
      nextStep(BANK, [{ itemId: 'LOG-PAT-01', difficulty: 3, answered: false, isCorrect: null }], 'grade_7'),
    ).toEqual({ kind: 'wait' });
  });

  it('is deterministic: the same history gives the same next item', () => {
    const partial = history.slice(0, 10);
    expect(nextStep(BANK, partial, 'grade_7')).toEqual(nextStep(BANK, partial, 'grade_7'));
  });
});

describe('nextStep — simulated learners', () => {
  it('always right: climbs to the top and lands on Extending', () => {
    const { verdict: v, difficulties } = sit(() => true, 'grade_11');
    expect(difficulties.at(-1)).toBe(5);
    expect(v).toMatchObject({ finalBand: 5, levelLabel: 'Extending', literacyPct: 100, logicPct: 100 });
    expect(v.lowConfidence).toBe(false);
  });

  it('always wrong: falls to the bottom and lands on Emerging', () => {
    const { verdict: v, difficulties } = sit(() => false, 'grade_1');
    expect(difficulties.at(-1)).toBe(1);
    expect(v).toMatchObject({ finalBand: 1, levelLabel: 'Emerging', literacyPct: 0, logicPct: 0 });
    expect(v.lowConfidence).toBe(false);
  });

  it('alternating: stays in the middle of the range', () => {
    const { verdict: v, difficulties } = sit((_, i) => i % 2 === 0);
    expect(Math.max(...difficulties)).toBeLessThanOrEqual(4);
    expect(Math.min(...difficulties)).toBeGreaterThanOrEqual(2);
    expect([2, 3]).toContain(v.finalBand);
  });

  it('flags low confidence for a Grade 10 learner on band 1', () => {
    const { verdict: v } = sit(() => false, 'grade_10');
    expect(v.finalBand).toBe(1);
    expect(v.lowConfidence).toBe(true);
  });

  it('starts at the bank start difficulty', () => {
    expect(currentDifficulty(BANK, [])).toBe(BANK.adaptive.startDifficulty);
  });
});

describe('currentDifficulty', () => {
  it('moves a logic answer at once, clamped to the range', () => {
    const right = (id: string): ServedItem => ({ itemId: id, difficulty: 3, answered: true, isCorrect: true });
    expect(currentDifficulty(BANK, [right('LOG-PAT-05')])).toBe(4);
    expect(
      currentDifficulty(BANK, ['LOG-PAT-05', 'LOG-ANA-05', 'LOG-ODD-05', 'LOG-IFT-05'].map(right)),
    ).toBe(5);
  });

  it('moves a passage only when its block is finished', () => {
    const [a = '', b = '', c = ''] = BANK.items.filter((i) => i.passageId === 'P2').map((i) => i.id);
    const answer = (id: string, ok: boolean): ServedItem => ({ itemId: id, difficulty: 3, answered: true, isCorrect: ok });
    expect(currentDifficulty(BANK, [answer(a, true), answer(b, true)])).toBe(3);
    expect(currentDifficulty(BANK, [answer(a, true), answer(b, true), answer(c, false)])).toBe(4);
    expect(currentDifficulty(BANK, [answer(a, true), answer(b, false), answer(c, false)])).toBe(2);
  });
});

describe('verdict', () => {
  const logic = BANK.items.filter((i) => i.section === 'logic');
  const served = (difficulty: number, isCorrect: boolean, n: number, from = 0): ServedItem[] =>
    logic.slice(from, from + n).map((i) => ({ itemId: i.id, difficulty, answered: true, isCorrect }));

  it('counts a wrong answer one band below the difficulty served, over the last ten only', () => {
    // Five early answers at 5 fall outside the window. Then eight wrong at 3
    // (each 2) and two right at 3 (each 3): (8 × 2 + 2 × 3) / 10 = 2.2 → 2.
    const history = [...served(5, true, 5), ...served(3, false, 8, 5), ...served(3, true, 2, 13)];
    expect(verdict(BANK, history, 'grade_5')).toMatchObject({
      finalBand: 2,
      levelLabel: 'Emerging',
      logicPct: 47, // 7 of 15
      lowConfidence: false,
    });
  });

  it('scores the level tested at, not the label of an easy leftover item', () => {
    // A strong learner handed the easiest logic items while being tested at 5.
    const easy = logic.filter((i) => i.difficulty === 1).slice(0, 10);
    const history = easy.map((i) => ({ itemId: i.id, difficulty: 5, answered: true, isCorrect: true }));
    expect(verdict(BANK, history, 'grade_11').finalBand).toBe(5);
  });
});

describe('gradeBand', () => {
  it.each([
    ['grade_r', 1],
    ['grade_2', 1],
    ['grade_3', 2],
    ['grade_6', 3],
    ['grade_9', 4],
    ['grade_12', 5],
  ])('%s → band %i', (code, band) => {
    expect(gradeBand(code)).toBe(band);
  });

  it('is null for an unknown grade', () => {
    expect(gradeBand('year_3')).toBeNull();
    expect(gradeBand(null)).toBeNull();
  });
});
