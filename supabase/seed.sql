-- Demo marketplace data for Skolopals (safe to re-run).
insert into public.tutors (slug, full_name, headline, bio, qualifications, subjects, topics, grades, languages, hourly_rate_cents, photo_url, status)
values
  ('maya-thompson', 'Maya Thompson', 'Mathematics • Grades 7–12',
   'Patient mathematics specialist with 8 years'' experience helping students build confidence and exam fluency.',
   'MSc Mathematics · Qualified Teacher Status',
   '{Mathematics}', '{Algebra,Geometry,Calculus,GCSE,A-Level}', 'Grades 7–12', '{English}', 4200,
   '/images/tutor-maya.png', 'approved'),
  ('daniel-okafor', 'Daniel Okafor', 'Physics • GCSE & A-Level',
   'Physics tutor who turns tricky concepts into clear, practical steps.',
   'BSc Physics · PGCE',
   '{Physics,Science}', '{Mechanics,Electricity,Waves,GCSE,A-Level}', 'GCSE & A-Level', '{English}', 4200,
   '/images/tutor-daniel.png', 'approved'),
  ('sofia-reyes', 'Sofia Reyes', 'English • Grades 5–10',
   'English tutor focused on reading comprehension and confident, structured writing.',
   'BA English Literature · CELTA',
   '{English,Languages}', '{Reading,Writing,Grammar,Spanish}', 'Grades 5–10', '{English,Spanish}', 4200,
   '/images/tutor-sofia.png', 'approved')
on conflict (slug) do nothing;

insert into public.reviews (tutor_id, author_name, rating, comment)
select t.id, r.author_name, 5, r.comment
from public.tutors t
join (values
  ('maya-thompson', 'Priya, Grade 10', 'Maya explains difficult ideas in a way that finally makes sense.'),
  ('daniel-okafor', 'Tom, Year 12', 'Daniel made electricity click for me before my mocks.'),
  ('sofia-reyes', 'Helena, parent', 'The right tutor changed how confident Sam feels at school.')
) as r(slug, author_name, comment) on r.slug = t.slug
where not exists (select 1 from public.reviews x where x.tutor_id = t.id);

-- Marketplace totals shown in the design (demo values).
update public.tutors set rating = 4.9, review_count = 128
where slug in ('maya-thompson', 'daniel-okafor', 'sofia-reyes');

-- Two weeks of weekday slots in Europe/London.
insert into public.availability_slots (tutor_id, starts_at)
select t.id, ((d::date + s.t) at time zone 'Europe/London')
from public.tutors t
cross join generate_series(current_date + 1, current_date + 14, interval '1 day') d
cross join (values (time '09:00'), (time '11:30'), (time '14:00'), (time '16:30'), (time '18:00')) s(t)
where extract(isodow from d) < 6
on conflict (tutor_id, starts_at) do nothing;
