-- Learner counts that agree with the rest of the admin portal.
--
-- v_learner_counts counted every learners row that had joined before the 1st of
-- the month. So the KPI page's "Active learners" disagreed with the dashboard: it
-- counted applicants who were declined and never became learners, and it
-- measured the start of the month rather than now. October showed 0 active and
-- 11 new, because everyone joined in the middle of it.
--
-- Now applicants who never became learners (status 'prospective') are left out,
-- and active_learners is the count at the end of the month (today, for the
-- current month), which is what the dashboard and v_break_even mean. Retention
-- is the share of the learners there on the 1st who were still there at the end.
-- New columns go at the end, because a view can only gain columns there.

create or replace view public.v_learner_counts with (security_invoker = true) as
with months as (
  select m::date as month,
         least((m + interval '1 month - 1 day')::date, current_date) as month_end
  from generate_series(
         date_trunc('month', coalesce((select min(joined_on) from public.learners where status <> 'prospective'),
                                      current_date)),
         date_trunc('month', current_date),
         interval '1 month') m
)
select d.month,
       count(*) filter (where l.joined_on <= d.month_end
                          and (l.left_on is null or l.left_on > d.month_end))           as active_learners,
       count(*) filter (where date_trunc('month', l.joined_on) = d.month)                 as new_learners,
       count(*) filter (where date_trunc('month', l.left_on) = d.month)                   as departed_learners,
       count(*) filter (where l.joined_on < d.month
                          and (l.left_on is null or l.left_on >= d.month))              as learners_at_start,
       count(*) filter (where l.joined_on < d.month
                          and l.left_on >= d.month and l.left_on <= d.month_end)         as departed_from_start
from months d
cross join public.learners l
where l.status <> 'prospective'
group by d.month;

create or replace view public.v_learner_retention with (security_invoker = true) as
select month,
       active_learners,
       new_learners,
       departed_learners,
       case when learners_at_start > 0
            then round(100.0 * (learners_at_start - departed_from_start) / learners_at_start, 1)
       end as retention_pct,
       learners_at_start
from public.v_learner_counts;
