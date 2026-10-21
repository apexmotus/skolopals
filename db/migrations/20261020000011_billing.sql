-- Billing. Invoice and record only - there is no payment gateway.
-- Rules resolved 2026-10-20, SPEC section 9:
--   SKP-2026-0001, resetting yearly; issued 15th of M-1, due 1st of M;
--   3 days grace, then R150; registration invoiced immediately on enrolment.

create table public.billing_accounts (
  id          uuid primary key default gen_random_uuid(),
  guardian_id uuid not null unique references public.guardians (profile_id) on delete restrict,
  status      text not null default 'active'
    check (status in ('active', 'suspended', 'closed')),
  created_at  timestamptz not null default now()
);

comment on table public.billing_accounts is
  'One account per paying guardian. A parent with three children receives one '
  'bill, which the old per-booking payment model could not express.';

-- Invoice numbering --------------------------------------------------------
create table public.invoice_sequences (
  year        smallint primary key check (year between 2020 and 2100),
  last_number integer not null default 0 check (last_number >= 0)
);

-- Allocates the next number under a row lock, so two concurrent invoice runs
-- cannot produce the same one.
create or replace function private.next_invoice_number(p_issued_on date)
returns text language plpgsql security definer set search_path = ''
as $fn$
declare
  v_year   smallint := extract(year from p_issued_on)::smallint;
  v_prefix text;
  v_next   integer;
begin
  select invoice_prefix into v_prefix
  from public.billing_settings
  where p_issued_on >= effective_from
    and (effective_to is null or p_issued_on < effective_to);
  v_prefix := coalesce(v_prefix, 'SKP');

  insert into public.invoice_sequences (year, last_number)
  values (v_year, 1)
  on conflict (year) do update
    set last_number = public.invoice_sequences.last_number + 1
  returning last_number into v_next;

  return format('%s-%s-%s', v_prefix, v_year, lpad(v_next::text, 4, '0'));
end;
$fn$;

-- Invoices -----------------------------------------------------------------
-- `status` holds WORKFLOW state only. Whether an invoice is paid, part paid
-- or overdue is DERIVED from its allocations in v_invoice_status - a stored
-- payment status would drift the moment a payment is edited.
create table public.invoices (
  id                 uuid primary key default gen_random_uuid(),
  billing_account_id uuid not null references public.billing_accounts (id) on delete restrict,
  invoice_number     text not null unique,
  period_start       date,
  period_end         date,
  issued_on          date not null default current_date,
  due_on             date not null,
  status             text not null default 'draft'
    check (status in ('draft', 'issued', 'cancelled', 'written_off')),
  notes              text not null default '',
  created_at         timestamptz not null default now(),
  check (period_end is null or period_start is null or period_end >= period_start)
);

create index on public.invoices (billing_account_id, issued_on desc);
create index on public.invoices (due_on);

create table public.invoice_lines (
  id                      uuid primary key default gen_random_uuid(),
  invoice_id              uuid not null references public.invoices (id) on delete cascade,
  line_type               text not null check (line_type in
                            ('package', 'addon', 'registration', 'programme',
                             'late_fee', 'discount', 'adjustment')),
  description             text not null,
  enrolment_id            uuid references public.enrolments (id) on delete set null,
  programme_enrolment_id  uuid references public.programme_enrolments (id) on delete set null,
  package_code            text references public.packages (code),
  learner_id              uuid references public.learners (id) on delete set null,
  quantity                numeric(6,2) not null default 1 check (quantity > 0),
  unit_amount_cents       integer not null,
  line_total_cents        integer generated always as
                            (round(quantity * unit_amount_cents)::integer) stored,
  -- Only a discount or an adjustment may be negative.
  check (unit_amount_cents >= 0 or line_type in ('discount', 'adjustment'))
);

create index on public.invoice_lines (invoice_id);
create index on public.invoice_lines (learner_id);

comment on column public.invoice_lines.learner_id is
  'Which child this line is for. A parent with three children gets one '
  'invoice with lines attributable per learner.';

-- Payments -----------------------------------------------------------------
create table public.payments (
  id                 uuid primary key default gen_random_uuid(),
  billing_account_id uuid not null references public.billing_accounts (id) on delete restrict,
  paid_on            date not null default current_date,
  amount_cents       integer not null check (amount_cents > 0),
  method             text not null check (method in ('eft', 'cash', 'card_offline', 'other')),
  reference          text not null default '',
  recorded_by        uuid references public.profiles (id),
  created_at         timestamptz not null default now()
);

create index on public.payments (billing_account_id, paid_on desc);

-- The many-to-many the old schema could not express. One payment may settle
-- several invoices; one invoice may be settled by several payments.
create table public.payment_allocations (
  payment_id   uuid not null references public.payments (id) on delete cascade,
  invoice_id   uuid not null references public.invoices (id) on delete restrict,
  amount_cents integer not null check (amount_cents > 0),
  primary key (payment_id, invoice_id)
);

create index on public.payment_allocations (invoice_id);

create table public.credit_notes (
  id                 uuid primary key default gen_random_uuid(),
  billing_account_id uuid not null references public.billing_accounts (id) on delete restrict,
  issued_on          date not null default current_date,
  amount_cents       integer not null check (amount_cents > 0),
  reason             text not null,
  issued_by          uuid references public.profiles (id)
);

create table public.credit_note_allocations (
  credit_note_id uuid not null references public.credit_notes (id) on delete cascade,
  invoice_id     uuid not null references public.invoices (id) on delete restrict,
  amount_cents   integer not null check (amount_cents > 0),
  primary key (credit_note_id, invoice_id)
);

-- A payment cannot be allocated beyond its own value.
create or replace function private.check_payment_allocation()
returns trigger language plpgsql security definer set search_path = ''
as $fn$
declare v_payment integer; v_allocated integer;
begin
  select amount_cents into v_payment from public.payments where id = new.payment_id;
  select coalesce(sum(amount_cents), 0) into v_allocated
    from public.payment_allocations where payment_id = new.payment_id;
  if v_allocated > v_payment then
    raise exception 'Allocated % exceeds the payment of %', v_allocated, v_payment
      using errcode = 'check_violation';
  end if;
  return null;
end;
$fn$;

create constraint trigger payment_allocation_within_payment
  after insert or update on public.payment_allocations
  deferrable initially deferred
  for each row execute function private.check_payment_allocation();

-- An invoice cannot be over-settled by payments plus credits.
create or replace function private.check_invoice_not_oversettled()
returns trigger language plpgsql security definer set search_path = ''
as $fn$
declare v_invoice uuid; v_total integer; v_settled integer;
begin
  v_invoice := new.invoice_id;
  select coalesce(sum(line_total_cents), 0) into v_total
    from public.invoice_lines where invoice_id = v_invoice;
  select coalesce((select sum(amount_cents) from public.payment_allocations where invoice_id = v_invoice), 0)
       + coalesce((select sum(amount_cents) from public.credit_note_allocations where invoice_id = v_invoice), 0)
    into v_settled;
  if v_settled > v_total then
    raise exception 'Invoice settled % exceeds its total of %', v_settled, v_total
      using errcode = 'check_violation';
  end if;
  return null;
end;
$fn$;

create constraint trigger payment_not_oversettling_invoice
  after insert or update on public.payment_allocations
  deferrable initially deferred
  for each row execute function private.check_invoice_not_oversettled();

create constraint trigger credit_not_oversettling_invoice
  after insert or update on public.credit_note_allocations
  deferrable initially deferred
  for each row execute function private.check_invoice_not_oversettled();

-- Derived payment state ----------------------------------------------------
create or replace view public.v_invoice_status with (security_invoker = true) as
select
  i.id,
  i.billing_account_id,
  i.invoice_number,
  i.issued_on,
  i.due_on,
  i.status,
  coalesce(l.total_cents, 0)                                   as total_cents,
  coalesce(p.paid_cents, 0) + coalesce(c.credit_cents, 0)      as settled_cents,
  coalesce(l.total_cents, 0)
    - coalesce(p.paid_cents, 0) - coalesce(c.credit_cents, 0)  as balance_cents,
  case
    when i.status in ('draft', 'cancelled', 'written_off') then i.status
    when coalesce(l.total_cents, 0)
         - coalesce(p.paid_cents, 0) - coalesce(c.credit_cents, 0) <= 0 then 'paid'
    when coalesce(p.paid_cents, 0) + coalesce(c.credit_cents, 0) > 0     then 'part_paid'
    when i.due_on < current_date                                        then 'overdue'
    else 'unpaid'
  end as payment_state,
  greatest(0, current_date - i.due_on) as days_overdue
from public.invoices i
left join (select invoice_id, sum(line_total_cents) as total_cents
             from public.invoice_lines group by invoice_id) l on l.invoice_id = i.id
left join (select invoice_id, sum(amount_cents) as paid_cents
             from public.payment_allocations group by invoice_id) p on p.invoice_id = i.id
left join (select invoice_id, sum(amount_cents) as credit_cents
             from public.credit_note_allocations group by invoice_id) c on c.invoice_id = i.id;

comment on view public.v_invoice_status is
  'Payment state DERIVED from allocations. Never stored - a stored status '
  'drifts the moment a payment is corrected.';

-- Is this invoice past its grace period and therefore liable for a late fee?
create or replace function public.invoice_late_fee_due(p_invoice_id uuid, p_on date default current_date)
returns boolean language sql stable
as $fn$
  select exists (
    select 1
    from public.v_invoice_status v
    join public.billing_settings b
      on v.issued_on >= b.effective_from
     and (b.effective_to is null or v.issued_on < b.effective_to)
    where v.id = p_invoice_id
      and v.status = 'issued'
      and v.balance_cents > 0
      and p_on > v.due_on + b.grace_days
  )
$fn$;

create or replace view public.v_account_statement with (security_invoker = true) as
select
  ba.id                        as billing_account_id,
  ba.guardian_id,
  'invoice'                    as entry_type,
  i.invoice_number             as reference,
  i.issued_on                  as entry_date,
  v.total_cents                as debit_cents,
  0                            as credit_cents
from public.billing_accounts ba
join public.invoices i        on i.billing_account_id = ba.id
join public.v_invoice_status v on v.id = i.id
where i.status not in ('draft', 'cancelled')
union all
select ba.id, ba.guardian_id, 'payment', p.reference, p.paid_on, 0, p.amount_cents
from public.billing_accounts ba
join public.payments p on p.billing_account_id = ba.id
union all
select ba.id, ba.guardian_id, 'credit', cn.reason, cn.issued_on, 0, cn.amount_cents
from public.billing_accounts ba
join public.credit_notes cn on cn.billing_account_id = ba.id;

comment on view public.v_account_statement is
  'Parent statement of account: invoices, payments and credits in date order.';

alter table public.billing_accounts        enable row level security;
alter table public.invoice_sequences       enable row level security;
alter table public.invoices                enable row level security;
alter table public.invoice_lines           enable row level security;
alter table public.payments                enable row level security;
alter table public.payment_allocations     enable row level security;
alter table public.credit_notes            enable row level security;
alter table public.credit_note_allocations enable row level security;
