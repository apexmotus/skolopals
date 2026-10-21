-- Packages and pricing. Business plan section 9.
--
-- `packages` says WHAT is sold. `package_prices` says what it costs and WHEN.
-- Price is temporal: the plan spans 2026-2030 and prices will move. Holding
-- price on the package would make the row mean two things and force rewriting
-- history on every increase.

create table public.packages (
  code              text primary key,
  name              text not null unique,
  description       text not null default '',
  service_type      text not null check (service_type in
                      ('group', 'homework', 'one_on_one', 'academic_plus',
                       'holiday_programme', 'registration')),
  billing_period    text not null check (billing_period in
                      ('monthly', 'once_off', 'per_hour', 'per_block', 'per_programme')),
  subject_allowance smallint check (subject_allowance > 0),
  is_active         boolean not null default true,
  sort_order        smallint not null
);

comment on column public.packages.subject_allowance is
  'How many subjects the package covers. NULL means all subjects, or that '
  'subjects do not apply (registration, homework assistance).';

create table public.package_prices (
  id             uuid primary key default gen_random_uuid(),
  package_code   text not null references public.packages (code) on delete cascade,
  amount_cents   integer not null check (amount_cents >= 0),
  effective_from date not null,
  effective_to   date,
  created_at     timestamptz not null default now(),
  check (effective_to is null or effective_to > effective_from)
);

-- A package cannot have two prices on the same day.
alter table public.package_prices
  add constraint package_prices_no_overlap
  exclude using gist (
    package_code with =,
    daterange(effective_from, effective_to, '[)') with &&
  );

create index on public.package_prices (package_code, effective_from desc);

-- The price of a package on a given date. One place that rule lives.
create or replace function public.package_price_on(p_package_code text, p_on date)
returns integer
language sql stable
as $fn$
  select amount_cents
  from public.package_prices
  where package_code = p_package_code
    and p_on >= effective_from
    and (effective_to is null or p_on < effective_to)
$fn$;

comment on function public.package_price_on is
  'Price of a package on a date. Returns null if nothing is in effect.';

-- Billing settings (temporal) ---------------------------------------------
-- Rules resolved 2026-10-20, see SPEC section 9.
create table public.billing_settings (
  id             uuid primary key default gen_random_uuid(),
  invoice_prefix text not null default 'SKP',
  issue_day      smallint not null check (issue_day between 1 and 28),
  due_day        smallint not null check (due_day between 1 and 28),
  grace_days     smallint not null check (grace_days >= 0),
  late_fee_cents integer not null check (late_fee_cents >= 0),
  effective_from date not null,
  effective_to   date,
  check (effective_to is null or effective_to > effective_from)
);

alter table public.billing_settings
  add constraint billing_settings_no_overlap
  exclude using gist (daterange(effective_from, effective_to, '[)') with &&);

comment on table public.billing_settings is
  'issue_day 15 of month M-1, due_day 1 of month M, 3 days grace, R150 late fee.';

-- Row level security -------------------------------------------------------
alter table public.packages         enable row level security;
alter table public.package_prices   enable row level security;
alter table public.billing_settings enable row level security;

-- Packages and their prices are public: they are the price list on the website.
create policy "packages: public read" on public.packages
  for select to anon, authenticated using (is_active);
create policy "package_prices: public read" on public.package_prices
  for select to anon, authenticated using (true);

-- Billing settings are internal. No read policy for anon/authenticated;
-- admin access is granted in the RLS migration.

grant select on public.packages, public.package_prices to anon, authenticated;
