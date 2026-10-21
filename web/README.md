# Skolopals

A tutoring marketplace built from the Skolopals Figma file. Students and parents find and book verified tutors, tutors apply and manage their teaching, and admins review applications.

**Stack:** Next.js 16 (App Router, Server Actions) · Tailwind CSS 4 · Supabase (Postgres, Auth, Storage, row-level security)

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in your Supabase URL and publishable key
npm run dev
```

Open http://localhost:3000.

## Project layout

| Path | What's there |
| --- | --- |
| `src/app/(public)` | Marketing pages, Find a Tutor, tutor profiles, the 3-step booking flow, the tutor application |
| `src/app/(auth)` | Login and sign-up |
| `src/app/student` | Student workspace: overview, lessons, booking details and cancellation, messages, progress, resources |
| `src/app/tutor` | Tutor workspace: overview, schedule, earnings, requests, history, messages, reviews, application status |
| `src/app/admin` | Admin workspace: dashboard, application review, tutor accounts, notifications, reports |
| `src/components/ui.tsx` | Shared design-system components (buttons, cards, fields, tables, badges, states) |
| `src/app/globals.css` | Design tokens taken from Figma |
| `src/proxy.ts` | Refreshes the Supabase session and redirects signed-out users away from protected routes |
| `supabase/migrations` | Database schema, RLS policies and RPCs, in the order they were applied |
| `supabase/seed.sql` | Demo tutors, reviews and two weeks of availability |

## How it works

- **Roles.** `profiles.role` is `student`, `tutor` or `admin`. Sign-up can only choose student or tutor. Each workspace layout checks the role, and RLS enforces it in the database.
- **Booking.** `book_lesson()` locks the slot, creates the booking and payment in one transaction, and rejects double-bookings. `cancel_booking()` refunds the payment and frees the slot.
- **Payment split.** `payments.platform_fee_cents` (40%) and `tutor_payout_cents` (60%) are generated columns.
- **Applications.** Applicants upload documents straight to the private `tutor-documents` bucket, which only admins can read. `review_application()` approves, declines or requests more information. Approval creates the tutor's public listing and notifies them.

## Not production-ready yet

- **Payments are simulated.** Card numbers never leave the browser; only the last four digits are sent. A card ending in `0002` simulates a decline. Swap in a payment provider (e.g. Stripe) before taking real money.
- **No emails are sent.** Booking confirmations and application decisions show up in the app only.
- **Making an admin.** Run this in the Supabase SQL editor:
  `update profiles set role = 'admin' where id = (select id from auth.users where email = 'you@example.com');`
- Turn on leaked-password protection under Supabase → Authentication → Passwords.
- `supabase/seed.test-users.sql` creates dev-only test accounts. It's git-ignored; never run it in production.
