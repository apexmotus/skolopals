-- Expenses and the KPI views. BP sections 17, 19 and 24.
--
-- Capturing expenses is what turns the plan's "illustrative" operating
-- surplus into a computed figure.

create table public.expense_categories (
  code          text primary key,
  name          text not null unique,
  budget_cents  integer check (budget_cents >= 0),
  sort_order    smallint not null
);

comment on column public.expense_categories.budget_cents is
  'Monthly planning budget from BP section 17, for variance reporting.';

create table public.expenses (
  id            uuid primary key default gen_random_uuid(),
  category_code text not null references public.expense_categories (code),
  incurred_on   date not null,
  amount_cents  integer not null check (amount_cents > 0),
  description   text not null default '',
  recorded_by   uuid references public.profiles (id),
  created_at    timestamptz not null default now()
);

create index on public.expenses (incurred_on);
create index on public.expenses (category_code);

-- Financial KPIs -----------------------------------------------------------
create or replace view public.v_monthly_revenue with (security_invoker = true) as
select date_trunc('month', i.issued_on)::date as month,
       sum(v.total_cents)                      as invoiced_cents,
       sum(v.settled_cents)                    as collected_cents
from public.invoices i
join public.v_invoice_status v on v.id = i.id
where i.status not in ('draft', 'cancelled')
group by 1;

create or replace view public.v_monthly_expenses with (security_invoker = true) as
select date_trunc('month', incurred_on)::date as month,
       sum(amount_cents)                       as expense_cents
from public.expenses
group by 1;

create or replace view public.v_operating_surplus with (security_invoker = true) as
select coalesce(r.month, e.month)                        as month,
       coalesce(r.invoiced_cents, 0)                     as invoiced_cents,
       coalesce(r.collected_cents, 0)                    as collected_cents,
       coalesce(e.expense_cents, 0)                      as expense_cents,
       coalesce(r.collected_cents, 0) - coalesce(e.expense_cents, 0) as surplus_cents
from public.v_monthly_revenue r
full outer join public.v_monthly_expenses e on e.month = r.month;

comment on view public.v_operating_surplus is
  'Surplus on CASH COLLECTED, not invoiced. BP section 22 names non-payment '
  'as the top risk, so an invoiced-basis surplus would flatter the picture.';

create or replace view public.v_outstanding_fees with (security_invoker = true) as
select v.billing_account_id,
       ba.guardian_id,
       p.full_name                     as guardian_name,
       count(*) filter (where v.balance_cents > 0) as open_invoices,
       sum(v.balance_cents) filter (where v.balance_cents > 0) as outstanding_cents,
       max(v.days_overdue) filter (where v.balance_cents > 0)  as max_days_overdue
from public.v_invoice_status v
join public.billing_accounts ba on ba.id = v.billing_account_id
join public.profiles p          on p.id  = ba.guardian_id
where v.status = 'issued'
group by 1, 2, 3
having sum(v.balance_cents) filter (where v.balance_cents > 0) > 0;

create or replace view public.v_revenue_per_learner with (security_invoker = true) as
select date_trunc('month', i.issued_on)::date as month,
       count(distinct il.learner_id)           as learners_billed,
       sum(il.line_total_cents)                as invoiced_cents,
       case when count(distinct il.learner_id) > 0
            then round(sum(il.line_total_cents)::numeric / count(distinct il.learner_id))
       end                                     as avg_cents_per_learner
from public.invoices i
join public.invoice_lines il on il.invoice_id = i.id
where i.status not in ('draft', 'cancelled') and il.learner_id is not null
group by 1;

-- Academic KPIs ------------------------------------------------------------
-- Unions term classes and holiday programmes; see the note on separate
-- attendance tables in the programmes migration.
create or replace view public.v_attendance with (security_invoker = true) as
select ar.learner_id, cs.session_date, ar.status, 'class'::text as context
from public.attendance_records ar
join public.class_sessions cs on cs.id = ar.class_session_id
union all
select par.learner_id, ps.session_date, par.status, 'programme'
from public.programme_attendance_records par
join public.programme_sessions ps on ps.id = par.programme_session_id;

create or replace view public.v_attendance_rate with (security_invoker = true) as
select date_trunc('month', session_date)::date as month,
       count(*)                                 as sessions_recorded,
       count(*) filter (where status in ('present', 'late')) as attended,
       round(100.0 * count(*) filter (where status in ('present', 'late'))
             / nullif(count(*), 0), 1)          as attendance_rate_pct
from public.v_attendance
group by 1;

create or replace view public.v_assessment_improvement with (security_invoker = true) as
select a.learner_id,
       s.domain_code,
       min(s.percent) filter (where a.assessment_type_code = 'initial') as initial_pct,
       (array_agg(s.percent order by a.assessed_on desc))[1]            as latest_pct,
       (array_agg(s.percent order by a.assessed_on desc))[1]
         - min(s.percent) filter (where a.assessment_type_code = 'initial') as change_pct
from public.assessments a
join public.assessment_scores s on s.assessment_id = a.id
where s.percent is not null
group by 1, 2;

comment on view public.v_assessment_improvement is
  'Latest score against the initial assessment, per learner per domain. '
  'Drives the plan''s reading-improvement KPI (BP section 24).';

-- Business KPIs ------------------------------------------------------------
create or replace view public.v_learner_counts with (security_invoker = true) as
select date_trunc('month', d.month)::date as month,
       count(*) filter (where l.joined_on <  d.month
                          and (l.left_on is null or l.left_on >= d.month)) as active_learners,
       count(*) filter (where date_trunc('month', l.joined_on) = d.month)  as new_learners,
       count(*) filter (where date_trunc('month', l.left_on)   = d.month)  as departed_learners
from (select generate_series(
        date_trunc('month', coalesce((select min(joined_on) from public.learners), current_date)),
        date_trunc('month', current_date),
        interval '1 month') as month) d
cross join public.learners l
group by 1;

create or replace view public.v_learner_retention with (security_invoker = true) as
select month,
       active_learners,
       new_learners,
       departed_learners,
       case when active_learners + departed_learners > 0
            then round(100.0 * active_learners / (active_learners + departed_learners), 1)
       end as retention_pct
from public.v_learner_counts;

create or replace view public.v_enquiry_funnel with (security_invoker = true) as
select date_trunc('month', created_at)::date as month,
       source,
       count(*)                               as enquiries,
       count(*) filter (where status = 'enrolled') as converted,
       round(100.0 * count(*) filter (where status = 'enrolled')
             / nullif(count(*), 0), 1)        as conversion_pct
from public.contact_enquiries
group by 1, 2;

create or replace view public.v_tutor_session_load with (security_invoker = true) as
select coalesce(cs.tutor_id, cg.tutor_id)        as tutor_id,
       date_trunc('month', cs.session_date)::date as month,
       count(*)                                   as sessions,
       sum(extract(epoch from (cs.ends_at - cs.starts_at)) / 3600)::numeric(8,2) as hours
from public.class_sessions cs
join public.class_groups cg on cg.id = cs.class_group_id
where cs.status = 'held'
group by 1, 2;

comment on view public.v_tutor_session_load is
  'Sessions and hours actually taught. Feeds per-session and per-hour pay.';

-- Break-even (BP section 19) ----------------------------------------------
create or replace view public.v_break_even with (security_invoker = true) as
select s.month,
       s.expense_cents,
       r.avg_cents_per_learner,
       case when r.avg_cents_per_learner > 0
            then ceil(s.expense_cents::numeric / r.avg_cents_per_learner)
       end as learners_needed_to_break_even,
       l.active_learners
from public.v_operating_surplus s
left join public.v_revenue_per_learner r on r.month = s.month
left join public.v_learner_counts l      on l.month = s.month;

alter table public.expense_categories enable row level security;
alter table public.expenses           enable row level security;
