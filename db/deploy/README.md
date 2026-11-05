# Deploying to Supabase

Project: `clnlvmnfhzyumykbzrjz` (eu-west-2)

The first deploy replaces the old marketplace schema. Every later deploy is
additive — migrations are append-only once anything is live.

## First deploy, once

### 1. Rehearse locally

```bash
cd db && make deploy-check
```

Builds a throwaway database with **no dev helpers**, applies every migration
and seed, and asserts the result. If this fails, stop.

### 2. Remove the old schema  ← you run this

Open the **Supabase SQL Editor** and run [`01_reset_remote.sql`](01_reset_remote.sql).

It deletes the old marketplace tables and leaves `auth` alone, so the six
existing accounts — including two real people — keep their logins.

Expected result: `tables_left = 0`, `auth_users_preserved = 6`.

### 3. Apply the migrations

Either via the Supabase CLI:

```bash
cd db && supabase link --project-ref clnlvmnfhzyumykbzrjz && supabase db push
```

…or by running each file in `db/migrations/` in filename order in the SQL
Editor. They are ordered and must be applied in sequence.

### 4. Seed

Run `db/seed/01_reference.sql` … `05_expenses.sql` in order. All are
idempotent and safe in production: CAPS curriculum, the plan's price list,
POPIA consent types and retention periods, assessment domains, expense
categories.

**Do not run** `seed/04_test_users.sql` — it is local-only and git-ignored.

### 5. Make yourself an administrator

Nobody is an admin after a fresh deploy. Sign up on the site, then:

```sql
insert into public.user_roles (user_id, role)
select id, 'admin' from auth.users where email = 'you@example.com';
```

### 6. Before go-live

- Enter the 2026 school term dates (Admin → Timetable). Reports cannot be
  produced without them.
- Add rooms, tutors and their competencies — a class cannot exist until the
  assigned tutor is recorded as teaching that subject, in that language, at
  every grade it covers.
- Turn on leaked-password protection in Supabase → Authentication → Passwords.
- **Vercel Root Directory must be `web`**, or builds fail with "no package.json".

## Later deploys

```bash
cd db && supabase db push
```

Migrations are append-only from the first deploy onward. Never edit one that
has been applied; add a new file.
