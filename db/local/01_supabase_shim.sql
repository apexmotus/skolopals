-- Local only. Recreates the parts of Supabase that migrations depend on, so the
-- SAME migration files run against bare Postgres and against Supabase.
--
-- On Supabase these objects already exist and this file is never applied.
-- Nothing here may be relied on by a migration beyond what real Supabase offers.

create schema if not exists auth;
create schema if not exists storage;
create schema if not exists extensions;

grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema storage to anon, authenticated, service_role;

-- auth.users ---------------------------------------------------------------
-- Minimal stand-in. Real GoTrue has many more columns; migrations must only
-- ever reference id, email and raw_user_meta_data.
create table if not exists auth.users (
  id                 uuid primary key default gen_random_uuid(),
  email              text unique,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now()
);

-- auth helpers -------------------------------------------------------------
-- Bodies copied from Supabase so local RLS behaves identically. They read the
-- request GUCs that PostgREST sets per request; locally dev.login_as() sets them.
create or replace function auth.uid()
returns uuid
language sql stable
as $fn$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$fn$;

create or replace function auth.role()
returns text
language sql stable
as $fn$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$fn$;

create or replace function auth.email()
returns text
language sql stable
as $fn$
  select coalesce(
    nullif(current_setting('request.jwt.claim.email', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email')
  )::text
$fn$;

-- storage ------------------------------------------------------------------
create table if not exists storage.buckets (
  id                 text primary key,
  name               text not null,
  public             boolean not null default false,
  file_size_limit    bigint,
  allowed_mime_types text[],
  created_at         timestamptz not null default now()
);

create table if not exists storage.objects (
  id         uuid primary key default gen_random_uuid(),
  bucket_id  text not null references storage.buckets (id) on delete cascade,
  name       text not null,
  owner      uuid,
  metadata   jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (bucket_id, name)
);

alter table storage.objects enable row level security;

comment on schema auth is 'LOCAL SHIM - provided by Supabase in deployed environments';
comment on schema storage is 'LOCAL SHIM - provided by Supabase in deployed environments';
