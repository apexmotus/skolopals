-- The centre no longer collects health notes (20261125000007), so the learner
-- records retention class, shown to parents on the privacy page, stops listing
-- them.

update public.data_retention_policies
   set description = 'Learner identity, academic records, reports, attendance and authorised collectors'
 where record_class = 'learner_records';
