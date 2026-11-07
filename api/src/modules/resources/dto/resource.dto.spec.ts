import { validate } from 'class-validator';
import { CreateResourceDto } from './resource.dto';

/**
 * `MatchesAudienceType` ports `resource_audiences`' own CHECK constraint
 * (`db/migrations/20261020000012_communication.sql`) into the DTO — the
 * plan's own task 3 explicitly asks for a class-validator custom validator
 * here, not a Manager-level check, so it is worth exercising directly
 * rather than only through an HTTP-level test nothing in this codebase has
 * (every other module's DTO validation is only ever exercised implicitly,
 * through the global `ValidationPipe`).
 */
describe('CreateResourceDto — MatchesAudienceType', () => {
  async function errorsFor(input: Partial<CreateResourceDto>): Promise<string[]> {
    const dto = new CreateResourceDto();
    Object.assign(dto, { title: 'Worksheet', audienceType: 'learner', ...input });
    const errors = await validate(dto);
    return errors.map((e) => e.property);
  }

  const LEARNER_ID = '11111111-3c00-4000-8000-000000000001';
  const CLASS_GROUP_ID = '11111111-3c00-4000-8000-000000000002';

  it('accepts audienceType=learner with only learnerId set', async () => {
    expect(await errorsFor({ audienceType: 'learner', learnerId: LEARNER_ID })).toEqual([]);
  });

  it('accepts audienceType=all with no targeting field set', async () => {
    expect(await errorsFor({ audienceType: 'all' })).toEqual([]);
  });

  it('rejects audienceType=learner with no learnerId set', async () => {
    expect(await errorsFor({ audienceType: 'learner' })).toContain('audienceType');
  });

  it('rejects audienceType=learner with classGroupId ALSO set (two targeting fields)', async () => {
    expect(
      await errorsFor({ audienceType: 'learner', learnerId: LEARNER_ID, classGroupId: CLASS_GROUP_ID }),
    ).toContain('audienceType');
  });

  it('rejects audienceType=all with a targeting field set anyway', async () => {
    expect(await errorsFor({ audienceType: 'all', learnerId: LEARNER_ID })).toContain('audienceType');
  });

  it('rejects audienceType=class_group with gradeCode set instead of classGroupId', async () => {
    expect(await errorsFor({ audienceType: 'class_group', gradeCode: 'grade_8' })).toContain(
      'audienceType',
    );
  });
});
