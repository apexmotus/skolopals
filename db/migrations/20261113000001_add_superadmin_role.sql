-- Add superadmin to app_role enum in its own migration so subsequent
-- migrations can reference the committed enum value inside single-transaction runs.
alter type public.app_role add value if not exists 'superadmin';
