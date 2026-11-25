# Door sign-in/out and online attendance — Spec

**Status:** Approved 2026-11-25 · built, awaiting deploy · **Date:** 2026-11-25 · **Phase 2 of** `USER-MANUAL-PLAN.md`

How a learner's presence is recorded: at the door for classes at the centre, and through a tracked join link for online and hybrid classes. In both cases it ends on the tutor's attendance register.

---

## 1. Decisions (interview 2026-11-25)

| Topic | Decision |
| :--- | :--- |
| Who operates the door | **Tutors and admins.** The tutor teaching the session (or its substitute) and any admin |
| Device | **Phone-first, desktop too.** One row per learner with large buttons |
| Collector not on the list / ID digits don't match | **Refuse, then call the parent.** The screen shows the guardians' phone numbers. An admin can add a collector on the spot; there is no override |
| Parents | **Times plus a sign-out notification.** Arrival, departure and who collected appear on their Attendance page; they get a portal notification on sign-out |
| Guardians collecting | **A linked guardian can always collect**, whether or not they ticked "I am authorised to collect" |
| Leaving alone | **Only with guardian permission.** A guardian ticks "may leave on their own" per child; only then does the door offer "Left on their own" |
| Sign-in and the register | **Signing in marks the register:** Present, or Late if more than 10 minutes after the start. Absent and Excused stay on the register |
| Late pickup | **A "Still at the centre" list plus an alert.** 30 minutes after a class ends, anyone signed in but not out triggers a notification to admins and that learner's guardians |
| Online classes | **Tracked join link plus tutor verification.** Learners join through a Skolopals link that records the click, then redirects to Meet or Zoom. The tutor sees who joined and confirms the register at the end |
| Hybrid classes | **Treated as online.** No door screen; join link plus register |

---

## 2. Classes at the centre: the door

### 2.1 Where

- **Tutor portal → Attendance register.** For an in-centre session, each learner row gets the door controls next to the register buttons. There's one screen per session; no separate door app.
- **Admin portal → new "Today at the door" page.** Today's in-centre sessions, each opening the same per-learner controls, plus the centre-wide **Still at the centre** list.

### 2.2 Each learner row

| State | Shows | Actions |
| :--- | :--- | :--- |
| Not arrived | Name | **Sign in** → records the time, marks the register Present or Late |
| In the centre | "In since 14:02" | **Sign out** → opens the collector picker |
| Signed out | "In 14:02 · Out 15:07 · Collected by Lerato Mabaso (aunt)" | **Undo sign-out**, for a mistake within 10 minutes |

### 2.3 Collector picker (sign-out)

- The learner's **guardians**: name, relationship, phone.
- The learner's **authorised collectors**, active today: name, relationship, phone, and **"ID ends in 4821"** for staff to check against the person's ID document.
- **"Left on their own"**, only if a guardian has given permission for this child.
- **"Someone else is here"**: refuses, and shows each guardian's phone number to call, with a note that an admin can add the person to the list once a guardian agrees.

Choosing a collector records the time and who released the child, then notifies the guardians, e.g. "Lesedi was collected by Lerato Mabaso at 15:07."

### 2.4 Still at the centre

Learners signed in but not out, with how long since their class ended. At **end + 30 min**, each one triggers one notification to admins and that learner's guardians ("Lesedi is still at the centre. Her class ended at 15:00.").

---

## 3. Online and hybrid classes: the join link

1. The meeting link stays **per session**, set by the admin or tutor as today.
2. Parents and learners never see the raw link. Their Timetable and Overview show **Join**, pointing at `/join/<session>`.
3. `/join/<session>`:
   - needs a signed-in **guardian** of a placed learner, or the **learner** themselves;
   - works from **15 minutes before the start until the end** (otherwise it says when it opens, or that the session has ended);
   - if a guardian has more than one child in that session, asks which child is joining;
   - records the join (learner, who clicked, time), then redirects to the meeting.
4. **Tutor's register for an online or hybrid session:** each learner shows **"Joined 15:32"** or **"Didn't join"**. A suggested status (Present / Late / Absent) is pre-selected but not saved, and **Confirm register** saves them all at once. The tutor can change any line first.
5. A click proves the learner *opened* the link, not that they stayed. That's why the tutor confirms the register.

---

## 4. Data changes (one migration)

| Change | Why |
| :--- | :--- |
| `session_check_ins`: tutors may insert/update for sessions they teach (`coalesce(session.tutor_id, class.tutor_id)`), in-centre classes only | Tutors operate the door (today: admin only) |
| `session_check_ins.collected_by_guardian` (→ `guardians`); exactly one of collector / guardian / "left alone" on sign-out; trigger checks the guardian is linked to the learner | Guardians always collect |
| `learners.may_leave_alone` + `_set_by` + `_set_at` (guardian-only write) | Leaving-alone permission, with who gave it and when |
| Trigger: a departure with no collector and no guardian requires `may_leave_alone` | Enforced in the database, not only on screen |
| Trigger: sign-in upserts `attendance_records` (present / late at +10 min); never overwrites a register the tutor already set to Excused | One action, not two |
| New `session_joins` (session, learner, joined_by, joined_at), read by the teaching tutor, guardians and admins | Online join tracking |
| Notifications use the existing `notifications` tables | Sign-out and late-pickup messages |

---

## 5. Scheduling the late-pickup alert

**Decided 2026-11-25:** the API is on Vercel **Hobby** (daily cron only), so the 10-minute check runs in the database through **Supabase Cron** (`pg_cron`): `db/migrations/20261125000011_late_pickup_schedule.sql` schedules `private.alert_late_pickups()` every 10 minutes, 13:00–20:59 SAST, Monday to Saturday. The door screens also run it whenever they are opened. The API's `GET /internal/jobs/late-pickups` stays for a manual or external trigger.

## 6. Defaults chosen (change if you disagree)

- Late threshold: **10 minutes** after the start, for both door and online.
- Join link opens **15 minutes** before the start.
- Undo sign-out: within **10 minutes**.
- Late-pickup alert: **30 minutes** after the end, **once** per learner per session.
- Learners with no login join through their guardian's portal.

---

## 7. Manual impact

- **Tutor part:** the door on the register (sign in, sign out, collector checks, refusing someone), and confirming an online register.
- **Admin part:** Today at the door, Still at the centre, adding a collector on the spot.
- **Guardian part:** joining an online class, sign-out notifications, arrival and departure times on Attendance, giving leave-alone permission, keeping the collector list up to date.
- **Learner part:** joining an online class from their own portal.
