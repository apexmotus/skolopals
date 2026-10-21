# Entity relationship diagram

Built incrementally. Phase 0 covers reference and curriculum only.

## Phase 0 — reference and curriculum

```mermaid
erDiagram
    SCHOOL_PHASES  ||--o{ GRADES             : "contains"
    GRADES         ||--o{ SUBJECT_OFFERINGS  : "offered at"
    SUBJECTS       ||--o{ SUBJECT_OFFERINGS  : "offered as"

    SCHOOL_PHASES {
        text     code PK
        text     name
        smallint sort_order
    }
    GRADES {
        text     code PK
        text     name
        text     phase_code FK
        smallint sort_order
    }
    SUBJECTS {
        text     code PK
        text     name
        boolean  is_language
        smallint sort_order
    }
    SUBJECT_OFFERINGS {
        text subject_code PK,FK
        text grade_code   PK,FK
    }
    LANGUAGES {
        text     code PK
        text     name
        smallint sort_order
    }
    ACHIEVEMENT_LEVELS {
        smallint code PK
        text     label
        smallint min_percent
        smallint max_percent
    }
    TERMS {
        uuid     id PK
        smallint year
        smallint term_number
        date     starts_on
        date     ends_on
    }
    CENTRE_OPERATING_HOURS {
        iso_dow day_of_week PK
        time    opens_at PK
        time    closes_at
        text    purpose
    }
    ROOMS {
        uuid     id PK
        text     name
        smallint capacity
    }
```

`LANGUAGES`, `ACHIEVEMENT_LEVELS`, `TERMS`, `CENTRE_OPERATING_HOURS` and `ROOMS` stand alone in Phase 0; they gain relationships in Phase 1.

### Notes

- **`GRADES.phase_code`** is the only place the grade→phase fact lives. Storing phase on a learner would be a transitive dependency (learner → grade → phase) and break 3NF.
- **`SUBJECT_OFFERINGS`** is a genuine binary relation, not a decomposition. Subject and grade are not independent: the centre offers Accounting only at FET and Reading only at Foundation.
- **`CENTRE_OPERATING_HOURS`** is keyed on day *plus* opening time, so a day can have more than one block.
- **`TERMS`** and **`ROOMS`** ship empty by design — see the README.


## Phase 1 — people, enrolment, timetable

```mermaid
erDiagram
    PROFILES ||--o{ USER_ROLES : holds
    PROFILES ||--o| GUARDIANS  : "is a"
    PROFILES ||--o| TUTORS     : "is a"
    PROFILES ||--o| LEARNERS   : "optional login"

    GUARDIANS ||--o{ LEARNER_GUARDIANS : "cares for"
    LEARNERS  ||--o{ LEARNER_GUARDIANS : "cared for by"
    LEARNERS  ||--o{ LEARNER_EMERGENCY_CONTACTS : has
    LEARNERS  ||--o{ AUTHORISED_COLLECTORS      : has
    LEARNERS  ||--o| LEARNER_MEDICAL_NOTES      : has
    LEARNERS  }o--|| GRADES : "is in"

    TUTORS ||--o{ TUTOR_COMPETENCIES     : "can teach"
    TUTORS ||--o{ TUTOR_SPOKEN_LANGUAGES : speaks
    TUTORS ||--o{ TUTOR_PAY_RATES        : "paid by"
    TUTOR_COMPETENCIES ||--o{ TUTOR_COMPETENCY_MEDIA : "in language"
    TUTOR_COMPETENCIES }o--|| SUBJECT_OFFERINGS      : "must be offered"

    LEARNERS  ||--o{ ENROLMENTS : has
    PACKAGES  ||--o{ ENROLMENTS : "sold as"
    PACKAGES  ||--o{ PACKAGE_PRICES : "priced by"
    ENROLMENTS ||--o{ ENROLMENT_SUBJECTS : covers

    CLASS_GROUPS ||--o{ CLASS_GROUP_GRADES : "spans"
    CLASS_GROUPS ||--o{ CLASS_SCHEDULES    : "meets on"
    CLASS_GROUPS ||--o{ CLASS_SESSIONS     : "occurs as"
    CLASS_GROUPS ||--o{ CLASS_ENROLMENTS   : "placed with"
    CLASS_GROUPS }o--|| TUTORS   : "taught by"
    CLASS_GROUPS }o--|| TERMS    : within
    LEARNERS     ||--o{ CLASS_ENROLMENTS : "placed into"

    CLASS_SESSIONS ||--o{ ATTENDANCE_RECORDS : registers
    CLASS_SESSIONS ||--o{ SESSION_CHECK_INS  : "signs in"
    AUTHORISED_COLLECTORS ||--o{ SESSION_CHECK_INS : "collected by"

    GUARDIANS ||--o{ CONSENTS : grants
    LEARNERS  ||--o{ CONSENTS : about
```

### Notes

- **`TUTOR_COMPETENCIES` → `SUBJECT_OFFERINGS`** is a composite FK on `(subject_code, grade_code)`. A tutor cannot be competent in something the centre does not offer at that grade.
- **`CLASS_GROUPS.language_code`** is the medium of instruction. A trigger requires the assigned tutor to hold a matching competency *and* medium, at every grade the class covers.
- **`CLASS_SESSIONS.meeting_url`** is per occurrence. `class_sessions` is not publicly readable; the published timetable is the `v_public_timetable` view, which omits the link.
- **`CONSENTS`** gates enrolment activation by trigger (POPIA s35).

## Phase 2 — assessment, billing, communication

```mermaid
erDiagram
    LEARNERS ||--o{ ASSESSMENTS      : "assessed by"
    ASSESSMENTS ||--o{ ASSESSMENT_SCORES : "scored per domain"
    ASSESSMENT_DOMAINS ||--o{ ASSESSMENT_SCORES : measures
    ASSESSMENTS ||--o| LEARNING_PLANS : "informs"
    LEARNING_PLANS ||--o{ LEARNING_PLAN_GOALS : "per subject"
    LEARNERS ||--o{ PROGRESS_REPORTS : receives
    PROGRESS_REPORTS ||--o{ PROGRESS_REPORT_SUBJECTS : "per subject"
    PROGRESS_REPORTS ||--o{ REPORT_ACKNOWLEDGEMENTS  : "parent feedback"

    GUARDIANS ||--|| BILLING_ACCOUNTS : owns
    BILLING_ACCOUNTS ||--o{ INVOICES : "billed by"
    BILLING_ACCOUNTS ||--o{ PAYMENTS : "settled by"
    INVOICES ||--o{ INVOICE_LINES : "made of"
    INVOICES ||--o{ PAYMENT_ALLOCATIONS : "settled by"
    PAYMENTS ||--o{ PAYMENT_ALLOCATIONS : "allocated to"
    INVOICES ||--o{ CREDIT_NOTE_ALLOCATIONS : credited
    CREDIT_NOTES ||--o{ CREDIT_NOTE_ALLOCATIONS : "allocated to"
    LEARNERS ||--o{ INVOICE_LINES : "attributed to"

    PROGRAMMES ||--o{ PROGRAMME_SESSIONS   : "occurs as"
    PROGRAMMES ||--o{ PROGRAMME_ENROLMENTS : "booked by"
    PROGRAMME_SESSIONS ||--o{ PROGRAMME_ATTENDANCE_RECORDS : registers

    MESSAGE_THREADS ||--o{ THREAD_PARTICIPANTS : includes
    MESSAGE_THREADS ||--o{ MESSAGES : contains
    MESSAGES ||--o{ MESSAGE_READS : "read by"
    NOTIFICATIONS ||--o{ NOTIFICATION_RECIPIENTS : "sent to"
    RESOURCES ||--o{ RESOURCE_AUDIENCES : "targeted at"
    TUTORS ||--o{ REVIEWS : "reviewed in"
    GUARDIANS ||--o{ REVIEWS : writes
    EXPENSE_CATEGORIES ||--o{ EXPENSES : classifies
```

### Notes

- **`PAYMENT_ALLOCATIONS`** is the many-to-many the old schema could not express. One EFT settles several invoices; one invoice takes several payments.
- **`INVOICE_LINES.learner_id`** attributes each line to a child, so one household invoice still breaks down per learner.
- **Payment state is derived** in `v_invoice_status`, never stored on `invoices`.
- **`ASSESSMENT_SCORES`** is one row per domain, which is what makes `v_assessment_improvement` possible.
- **`MESSAGE_READS`** and **`NOTIFICATION_RECIPIENTS`** carry read state per person, which a single `read_at` column cannot.
