import { Injectable } from '@nestjs/common';
import { StoredProcRunner } from '../../database/stored-proc.runner.js';

interface UserRoleRow {
  role: string;
}

/**
 * Backs `JwtAuthGuard`'s role lookup — not a Controller-facing module.
 *
 * There is no Postgres auth hook injecting roles into the JWT (confirmed by
 * grepping `db/migrations/` for one; see 06-phase2-auth.md item 1) and no
 * dedicated "get my roles" function either: `web/src/lib/auth.ts` reads
 * `public.user_roles` as a plain PostgREST table read today, and
 * `02-sp-catalogue.md`'s Auth section says exactly that — "the ordinary
 * people/users read path... not a special auth-module SP." This repository
 * does the same read, through `StoredProcRunner.selectMany` so it still
 * goes through the same transaction + RLS pattern as everything else
 * (phase0 §1) — the `"user_roles: read self or admin"` policy is what
 * actually restricts this to the caller's own rows (or an admin's).
 */
@Injectable()
export class UserRolesRepository {
  constructor(private readonly sp: StoredProcRunner) {}

  async listForUser(userId: string): Promise<string[]> {
    const rows = await this.sp.selectMany<UserRoleRow>(
      'select role from public.user_roles where user_id = $1',
      [userId],
    );
    return rows.map((row) => row.role);
  }
}
