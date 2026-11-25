-- The centre does not collect health or allergy information (decision
-- 2026-11-25), so enrolment no longer asks for consent to hold it.
--
-- The consent type is retired, not deleted: consents parents already gave under
-- it stay on record. A retired type is neither shown nor required, so
-- has_required_consents and submit_enrolment (both of which read is_required)
-- stop demanding it, and the API's consent list leaves it out.

alter table public.consent_types add column is_active boolean not null default true;

comment on column public.consent_types.is_active is
  'False for a retired purpose: no longer asked for, kept for the consents already given under it.';

update public.consent_types
   set is_active = false, is_required = false
 where code = 'health_s27';
