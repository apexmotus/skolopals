import { Injectable } from '@nestjs/common';
import { StoredProcRunner } from '../../database/stored-proc.runner';
import type { ResourceRow } from './rows/resource.row';

const RESOURCE_COLUMNS_WITH_AUDIENCES = `
  r.id, r.title, r.subject_code, r.url, r.storage_path, r.created_by, r.created_at,
  coalesce(
    (select json_agg(json_build_object(
       'id', a.id, 'audience_type', a.audience_type, 'learner_id', a.learner_id,
       'class_group_id', a.class_group_id, 'grade_code', a.grade_code
     ))
     from public.resource_audiences a where a.resource_id = r.id),
    '[]'::json
  ) as audiences
`;

/**
 * `resources`' own RLS policy ("resources: read if targeted") already
 * reproduces the four-way audience check in full — `listForActor` has no
 * `WHERE` clause of its own, same pattern as `programmes`/`class_groups`.
 * No dedicated function exists for any of this (confirmed by grep); the
 * audience row is only ever created alongside its resource (one `POST
 * /resources` call, no later "add another audience" endpoint) and only
 * ever removed singly (`DELETE .../audiences/:audienceId`) — there is no
 * "replace all audiences" write to reason about here.
 */
@Injectable()
export class ResourcesRepository {
  constructor(private readonly sp: StoredProcRunner) {}

  listForActor(): Promise<ResourceRow[]> {
    return this.sp.selectMany<ResourceRow>(
      `select ${RESOURCE_COLUMNS_WITH_AUDIENCES} from public.resources r order by r.created_at desc`,
    );
  }

  getById(id: string): Promise<ResourceRow | undefined> {
    return this.sp.selectOne<ResourceRow>(
      `select ${RESOURCE_COLUMNS_WITH_AUDIENCES} from public.resources r where r.id = $1`,
      [id],
    );
  }

  /** Caller must run this and {@link createAudience} inside the same `UnitOfWork` — an orphan resource with no matching audience row would otherwise stay visible to its own creator/admin (the resources table's own RLS clause) but invisible to everyone it was meant for. */
  async create(input: {
    title: string;
    subjectCode?: string;
    url?: string;
    storagePath?: string;
    createdBy: string;
  }): Promise<string> {
    const result = await this.sp.executeRaw<{ id: string }>(
      `insert into public.resources (title, subject_code, url, storage_path, created_by)
       values ($1, $2, coalesce($3, ''), coalesce($4, ''), $5)
       returning id`,
      [input.title, input.subjectCode ?? null, input.url ?? null, input.storagePath ?? null, input.createdBy],
    );
    const row = result.rows[0];
    if (!row) throw new Error('INSERT ... RETURNING unexpectedly returned no row');
    return row.id;
  }

  async createAudience(input: {
    resourceId: string;
    audienceType: string;
    learnerId?: string;
    classGroupId?: string;
    gradeCode?: string;
  }): Promise<void> {
    await this.sp.executeRaw(
      `insert into public.resource_audiences (resource_id, audience_type, learner_id, class_group_id, grade_code)
       values ($1, $2, $3, $4, $5)`,
      [
        input.resourceId,
        input.audienceType,
        input.learnerId ?? null,
        input.classGroupId ?? null,
        input.gradeCode ?? null,
      ],
    );
  }

  async update(
    id: string,
    patch: { title?: string; subjectCode?: string; url?: string },
  ): Promise<ResourceRow | undefined> {
    const values: unknown[] = [];
    const sets: string[] = [];
    const push = (column: string, value: unknown): void => {
      values.push(value);
      sets.push(`${column} = $${values.length}`);
    };
    if (patch.title !== undefined) push('title', patch.title);
    if (patch.subjectCode !== undefined) push('subject_code', patch.subjectCode);
    if (patch.url !== undefined) push('url', patch.url);
    if (sets.length === 0) return this.getById(id);

    values.push(id);
    await this.sp.executeRaw(
      `update public.resources set ${sets.join(', ')} where id = $${values.length}`,
      values,
    );
    return this.getById(id);
  }

  async removeAudience(resourceId: string, audienceId: string): Promise<boolean> {
    const result = await this.sp.executeRaw<{ id: string }>(
      `delete from public.resource_audiences where id = $1 and resource_id = $2 returning id`,
      [audienceId, resourceId],
    );
    return result.rows.length > 0;
  }
}
