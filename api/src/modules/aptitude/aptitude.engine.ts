/**
 * The adaptive aptitude engine — SPEC-2026-11-enrolment-payments-ux.md §4.3.
 *
 * Pure functions over the bank's shape and the attempt's history: no I/O,
 * no clock, no randomness, so the same history always yields the same next
 * item. Nothing here sees an answer key; correctness arrives from the
 * database already worked out (`private.aptitude_answer`).
 *
 * The current difficulty is replayed from the history on every call rather
 * than trusted from storage, so a bug can never leave an attempt stuck on a
 * stale estimate.
 */

export type Section = 'literacy' | 'logic';

export interface BankItem {
  id: string;
  section: Section;
  skill: string;
  difficulty: number;
  passageId: string | null;
}

export interface ScoringLevel {
  label: string;
  bands: number[];
  tutorNote?: string;
}

export interface BankShape {
  blueprint: { testLength: number; literacyItems: number; logicItems: number };
  adaptive: {
    startDifficulty: number;
    minDifficulty: number;
    maxDifficulty: number;
    stepSize: number;
  };
  scoring: { levels: ScoringLevel[] };
  items: BankItem[];
}

/**
 * One served item, in the order served. `difficulty` is the estimate the
 * engine was testing at when it served the item. `isCorrect` is null until
 * answered.
 */
export interface ServedItem {
  itemId: string;
  difficulty: number;
  answered: boolean;
  isCorrect: boolean | null;
}

export interface Verdict {
  finalBand: number;
  levelLabel: string;
  literacyPct: number;
  logicPct: number;
  lowConfidence: boolean;
}

export type NextStep =
  | { kind: 'wait' }
  | { kind: 'serve'; itemId: string; difficulty: number }
  | { kind: 'complete'; verdict: Verdict };

/** pattern → analogy → odd-one-out → if-then, then round again (§4.3 step 2). */
export const LOGIC_SKILL_ROTATION = [
  'pattern',
  'analogy',
  'odd-one-out',
  'if-then',
] as const;

/** Items averaged for the final band (§4.3 step 5). */
export const BAND_WINDOW = 10;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

function indexItems(bank: BankShape): Map<string, BankItem> {
  return new Map(bank.items.map((item) => [item.id, item]));
}

function passageItems(bank: BankShape, passageId: string): BankItem[] {
  return bank.items
    .filter((item) => item.passageId === passageId)
    .sort((a, b) => a.difficulty - b.difficulty || a.id.localeCompare(b.id));
}

/**
 * Which section each position in the test belongs to: a passage block, then
 * a run of logic items, repeated, so a young child never faces all the
 * reading at once (§4.3 step 1). Logic items are spread over the gaps after
 * each block, with any remainder going to the last gaps: for 12 + 13 in
 * blocks of 3 that is L3 G3 L3 G3 L3 G3 L3 G4.
 */
export function sectionPlan(
  blueprint: BankShape['blueprint'],
  passageSize: number,
): Section[] {
  const blocks =
    passageSize > 0 ? Math.floor(blueprint.literacyItems / passageSize) : 0;
  if (blocks === 0) return Array<Section>(blueprint.logicItems).fill('logic');

  const base = Math.floor(blueprint.logicItems / blocks);
  const extra = blueprint.logicItems % blocks;
  const plan: Section[] = [];
  for (let block = 0; block < blocks; block++) {
    plan.push(...Array<Section>(passageSize).fill('literacy'));
    const gap = base + (block >= blocks - extra ? 1 : 0);
    plan.push(...Array<Section>(gap).fill('logic'));
  }
  return plan;
}

/**
 * Replays the answers to find the current difficulty estimate (§4.3 steps
 * 2–3). A logic item moves it at once; a passage moves it once its whole
 * block is answered: two thirds or more right goes up, one third or fewer
 * goes down.
 */
export function currentDifficulty(
  bank: BankShape,
  history: readonly ServedItem[],
): number {
  const { startDifficulty, minDifficulty, maxDifficulty, stepSize } =
    bank.adaptive;
  const items = indexItems(bank);
  const blocks = new Map<string, { answered: number; correct: number }>();
  let difficulty = startDifficulty;

  for (const served of history) {
    if (!served.answered) continue;
    const item = items.get(served.itemId);
    if (!item) continue;

    if (item.section === 'logic') {
      difficulty += served.isCorrect ? stepSize : -stepSize;
    } else if (item.passageId) {
      const block = blocks.get(item.passageId) ?? { answered: 0, correct: 0 };
      block.answered += 1;
      if (served.isCorrect) block.correct += 1;
      blocks.set(item.passageId, block);

      if (block.answered === passageItems(bank, item.passageId).length) {
        const share = block.correct / block.answered;
        if (share >= 2 / 3) difficulty += stepSize;
        else if (share <= 1 / 3) difficulty -= stepSize;
      }
    }
    difficulty = clamp(difficulty, minDifficulty, maxDifficulty);
  }
  return difficulty;
}

/** 0 when `d` falls inside the passage's difficulty range, else how far outside it. */
function passageDistance(items: BankItem[], d: number): number {
  const lo = Math.min(...items.map((i) => i.difficulty));
  const hi = Math.max(...items.map((i) => i.difficulty));
  return d < lo ? lo - d : d > hi ? d - hi : 0;
}

function passageMidpoint(items: BankItem[]): number {
  const lo = Math.min(...items.map((i) => i.difficulty));
  const hi = Math.max(...items.map((i) => i.difficulty));
  return (lo + hi) / 2;
}

/** The unused passage closest to the estimate; ties go to the nearer midpoint, then the lower id. */
function pickPassage(
  bank: BankShape,
  used: Set<string>,
  d: number,
): BankItem | undefined {
  const passageIds = [
    ...new Set(
      bank.items.flatMap((i) =>
        i.section === 'literacy' && i.passageId ? [i.passageId] : [],
      ),
    ),
  ];
  const candidates = passageIds
    .map((id) => passageItems(bank, id))
    .filter((items) => items.every((i) => !used.has(i.id)))
    .sort(
      (a, b) =>
        passageDistance(a, d) - passageDistance(b, d) ||
        Math.abs(passageMidpoint(a) - d) - Math.abs(passageMidpoint(b) - d) ||
        (a[0]?.passageId ?? '').localeCompare(b[0]?.passageId ?? ''),
    );
  return candidates[0]?.[0];
}

/**
 * An unused logic item at the estimate, in the skill whose turn it is.
 * Difficulty matters more than skill: with no item left at the estimate in
 * that skill, another skill at the estimate comes before a different level.
 */
function pickLogic(
  bank: BankShape,
  used: Set<string>,
  d: number,
  logicServed: number,
): BankItem | undefined {
  const skill = LOGIC_SKILL_ROTATION[logicServed % LOGIC_SKILL_ROTATION.length];
  return bank.items
    .filter((i) => i.section === 'logic' && !used.has(i.id))
    .sort(
      (a, b) =>
        Math.abs(a.difficulty - d) - Math.abs(b.difficulty - d) ||
        Number(a.skill !== skill) - Number(b.skill !== skill) ||
        a.id.localeCompare(b.id),
    )[0];
}

/** CAPS grade → the bank's difficulty band (R–2, 3–4, 5–6, 7–9, 10–12). Null if unknown. */
export function gradeBand(gradeCode: string | null | undefined): number | null {
  if (!gradeCode) return null;
  const grade = gradeCode === 'grade_r' ? 0 : Number(gradeCode.replace('grade_', ''));
  if (!Number.isInteger(grade) || grade < 0 || grade > 12) return null;
  if (grade <= 2) return 1;
  if (grade <= 4) return 2;
  if (grade <= 6) return 3;
  if (grade <= 9) return 4;
  return 5;
}

/**
 * The result of a finished attempt (§4.3 steps 5–6). Final band: the mean
 * over the last ten items of the difficulty served if right, or one less if
 * wrong, rounded and clamped to the bank's range. "Difficulty served" is the
 * level the engine was testing at, not the item's own label: the literacy
 * bank is thin, so by the last block a strong learner may be handed an easy
 * leftover passage, and scoring that passage's label would cap them at
 * Secure (and floor a struggling learner at band 2). Sub-scores: percent right
 * per section. Low confidence: more than two bands from the learner's grade.
 */
export function verdict(
  bank: BankShape,
  history: readonly ServedItem[],
  gradeCode: string | null | undefined,
): Verdict {
  const { minDifficulty, maxDifficulty } = bank.adaptive;
  const items = indexItems(bank);
  const answered = history.filter((h) => h.answered && items.has(h.itemId));

  const window = answered.slice(-BAND_WINDOW);
  const values = window.map((h) =>
    clamp(h.isCorrect ? h.difficulty : h.difficulty - 1, minDifficulty, maxDifficulty),
  );
  const mean = values.length
    ? values.reduce((sum, v) => sum + v, 0) / values.length
    : minDifficulty;
  const finalBand = clamp(Math.round(mean), minDifficulty, maxDifficulty);

  const pct = (section: Section) => {
    const inSection = answered.filter(
      (h) => items.get(h.itemId)?.section === section,
    );
    if (inSection.length === 0) return 0;
    const right = inSection.filter((h) => h.isCorrect).length;
    return Math.round((100 * right) / inSection.length);
  };

  const level = bank.scoring.levels.find((l) => l.bands.includes(finalBand));
  const learnerBand = gradeBand(gradeCode);

  return {
    finalBand,
    levelLabel: level?.label ?? `Band ${finalBand}`,
    literacyPct: pct('literacy'),
    logicPct: pct('logic'),
    lowConfidence:
      learnerBand !== null && Math.abs(finalBand - learnerBand) > 2,
  };
}

/**
 * What happens next for this attempt:
 * - `wait`: a served item is still unanswered, show it again;
 * - `serve`: this item is next, at this difficulty estimate;
 * - `complete`: every item is answered, here is the result.
 *
 * A passage once started is served to the end, so its items stay together.
 * If the planned section has nothing left, the other section fills in.
 */
export function nextStep(
  bank: BankShape,
  history: readonly ServedItem[],
  gradeCode: string | null | undefined,
): NextStep {
  if (history.some((h) => !h.answered)) return { kind: 'wait' };
  if (history.length >= bank.blueprint.testLength) {
    return { kind: 'complete', verdict: verdict(bank, history, gradeCode) };
  }

  const items = indexItems(bank);
  const used = new Set(history.map((h) => h.itemId));
  const d = currentDifficulty(bank, history);

  const last = history.at(-1);
  const lastItem = last ? items.get(last.itemId) : undefined;
  if (lastItem?.passageId) {
    const rest = passageItems(bank, lastItem.passageId).filter(
      (i) => !used.has(i.id),
    );
    if (rest[0]) return { kind: 'serve', itemId: rest[0].id, difficulty: d };
  }

  const firstPassage = bank.items.find((i) => i.passageId)?.passageId;
  const passageSize = firstPassage ? passageItems(bank, firstPassage).length : 0;
  const planned = sectionPlan(bank.blueprint, passageSize)[history.length] ?? 'logic';
  const logicServed = history.filter(
    (h) => items.get(h.itemId)?.section === 'logic',
  ).length;

  const literacy = () => pickPassage(bank, used, d);
  const logic = () => pickLogic(bank, used, d, logicServed);
  const item =
    planned === 'literacy' ? (literacy() ?? logic()) : (logic() ?? literacy());

  if (!item) {
    // The bank ran out before the blueprint did. The seed generator's checks
    // make this unreachable for a valid bank; finish with what was answered.
    return { kind: 'complete', verdict: verdict(bank, history, gradeCode) };
  }
  return { kind: 'serve', itemId: item.id, difficulty: d };
}
