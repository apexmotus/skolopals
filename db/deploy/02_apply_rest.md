# Applying the remaining migrations

Migrations `001`–`003` are already applied and recorded. This applies `004`
onward **from the files themselves**, so nothing is retyped.

## One command

Get your database password from
**Supabase → Project Settings → Database → Connection string**, then:

```bash
cd skolopals/db
make migrate seed DATABASE_URL="postgresql://postgres.dhmjzshlznhqohvkdcpz:YOUR_PASSWORD@aws-0-eu-west-2.pooler.supabase.com:5432/postgres"
```

`migrate.sh` reads `public.schema_migrations`, sees `001`–`003` are done, and
applies `004`–`023` in order, each in its own transaction. Then `seed.sh`
applies the five idempotent seed files and skips the git-ignored test users.

Expect `migrate: 20 applied` and `seed: done`.

## Then verify

```bash
make verify DATABASE_URL="postgresql://...same..."
```

Expect **All checks passed**.

## Why not do it through the MCP connection

The MCP tool takes SQL as a string, which means retyping each migration by
hand. Migrations `008` and `014` are 38 KB of row-level security — 157
policies. A single transcription slip there is a silent authorisation hole
that no test would necessarily catch, because the policy would still *exist*.

Applying from the files removes that risk entirely. It is the same reason the
repo keeps one canonical copy of the schema rather than two.

## If you would rather not use a password

The Supabase CLI does the same thing and does **not** need Docker:

```bash
brew install supabase/tap/supabase
cd skolopals/db
supabase link --project-ref dhmjzshlznhqohvkdcpz
supabase db push
```

It will prompt for the password once and remember the link.
